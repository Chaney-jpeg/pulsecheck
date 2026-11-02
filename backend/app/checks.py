from time import monotonic
from typing import Optional

import httpx
from sqlmodel import Session, select

from .models import CheckResult, Incident, IncidentStatus, Service, ServiceStatus, utc_now
from .ssrf import validate_url_for_ssrf


def _determine_status(status_code: Optional[int], is_success: bool) -> str:
    """Return a ServiceStatus string from check result details."""
    if is_success:
        return ServiceStatus.operational
    if status_code is not None and 400 <= status_code < 500:
        return ServiceStatus.degraded
    return ServiceStatus.down


async def check_service(session: Session, service: Service) -> CheckResult:
    started = monotonic()
    status_code: Optional[int] = None
    error: Optional[str] = None
    success = False

    # SSRF guard — validate before making any outbound request
    try:
        validate_url_for_ssrf(service.url)
    except ValueError as exc:
        error = f"SSRF blocked: {exc}"
        result = CheckResult(
            service_id=service.id,
            is_success=False,
            status_code=None,
            response_time_ms=0,
            error=error,
        )
        session.add(result)
        _handle_incident(session, service, success=False, error=error)
        session.commit()
        session.refresh(result)
        return result

    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            # Disable keep-alive so sockets are released promptly
            limits=httpx.Limits(max_keepalive_connections=0),
        ) as client:
            response = await client.get(service.url)
        status_code = response.status_code
        success = response.is_success
        if not success:
            error = f"HTTP {status_code}"
    except httpx.TimeoutException:
        error = "Request timed out"
    except httpx.RequestError as exc:
        error = str(exc)[:500]

    result = CheckResult(
        service_id=service.id,
        is_success=success,
        status_code=status_code,
        response_time_ms=max(0, round((monotonic() - started) * 1000)),
        error=error,
    )
    session.add(result)
    _handle_incident(session, service, success=success, error=error)
    session.commit()
    session.refresh(result)
    return result


def _handle_incident(session: Session, service: Service, *, success: bool, error: Optional[str]) -> None:
    """Open a new incident on first failure, resolve the active one on recovery."""
    active_incident = session.exec(
        select(Incident)
        .where(Incident.service_id == service.id, Incident.status == IncidentStatus.open)
        .order_by(Incident.started_at.desc())
    ).first()

    if success and active_incident:
        active_incident.status = IncidentStatus.resolved
        active_incident.resolved_at = utc_now()
        session.add(active_incident)
    elif not success and not active_incident:
        session.add(Incident(service_id=service.id, summary=error or "Health check failed"))
