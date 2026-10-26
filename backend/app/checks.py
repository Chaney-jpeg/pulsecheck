from time import monotonic

import httpx
from sqlmodel import Session, select

from .models import CheckResult, Incident, IncidentStatus, Service, utc_now


async def check_service(session: Session, service: Service) -> CheckResult:
    started = monotonic()
    status_code: int | None = None
    error: str | None = None
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(service.url)
        status_code = response.status_code
        success = response.is_success
        if not success:
            error = f"HTTP {status_code}"
    except httpx.TimeoutException:
        success = False
        error = "Request timed out"
    except httpx.RequestError as exc:
        success = False
        error = str(exc)[:500]

    result = CheckResult(
        service_id=service.id, is_success=success, status_code=status_code,
        response_time_ms=max(0, round((monotonic() - started) * 1000)), error=error,
    )
    session.add(result)

    active_incident = session.exec(select(Incident).where(
        Incident.service_id == service.id, Incident.status == IncidentStatus.open
    ).order_by(Incident.started_at.desc())).first()
    if success and active_incident:
        active_incident.status = IncidentStatus.resolved
        active_incident.resolved_at = utc_now()
        session.add(active_incident)
    elif not success and not active_incident:
        session.add(Incident(service_id=service.id, summary=error or "Health check failed"))

    session.commit()
    session.refresh(result)
    return result
