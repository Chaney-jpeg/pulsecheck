import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .checks import check_service
from .database import create_db_and_tables, get_session
from .models import CheckResult, Incident, IncidentStatus, Service
from .scheduler import (
    get_scheduler,
    schedule_service,
    start_scheduler_with_existing_services,
    unschedule_service,
)
from .schemas import (
    CheckRead,
    IncidentRead,
    ServiceCreate,
    ServiceRead,
    ServiceUpdate,
    StatsRead,
    UptimeDayBucket,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# App lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    start_scheduler_with_existing_services()
    yield
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="PulseCheck API",
    version="2.0.0",
    description="Lightweight HTTP uptime monitoring and incident management.",
    lifespan=lifespan,
)

allowed_origins = os.getenv(
    "PULSECHECK_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins if o.strip()],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _latest_status(session: Session, service_id: int) -> str:
    latest = session.exec(
        select(CheckResult)
        .where(CheckResult.service_id == service_id)
        .order_by(CheckResult.checked_at.desc())
    ).first()
    if latest is None:
        return "unknown"
    if latest.is_success:
        return "operational"
    if latest.status_code is not None and 400 <= latest.status_code < 500:
        return "degraded"
    return "down"


def _uptime_percent(session: Session, service_id: int, days: int = 7) -> Optional[float]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    checks = session.exec(
        select(CheckResult).where(
            CheckResult.service_id == service_id,
            CheckResult.checked_at >= since,
        )
    ).all()
    if not checks:
        return None
    return round(sum(c.is_success for c in checks) / len(checks) * 100, 2)


def _avg_response_ms(session: Session, service_id: int, days: int = 7) -> Optional[float]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    checks = session.exec(
        select(CheckResult).where(
            CheckResult.service_id == service_id,
            CheckResult.checked_at >= since,
            CheckResult.is_success.is_(True),
        )
    ).all()
    if not checks:
        return None
    return round(sum(c.response_time_ms for c in checks) / len(checks), 1)


def _build_service_read(session: Session, service: Service) -> ServiceRead:
    base = ServiceRead.model_validate(service)
    return base.model_copy(update={
        "status": _latest_status(session, service.id),
        "uptime_percent": _uptime_percent(session, service.id),
        "avg_response_ms": _avg_response_ms(session, service.id),
    })


def _build_incident_read(incident: Incident) -> IncidentRead:
    base = IncidentRead.model_validate(incident)
    duration = None
    if incident.resolved_at and incident.started_at:
        duration = int((incident.resolved_at - incident.started_at).total_seconds())
    return base.model_copy(update={"duration_seconds": duration})


# ---------------------------------------------------------------------------
# Routes — meta
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/stats", response_model=StatsRead, tags=["meta"])
def global_stats(session: Session = Depends(get_session)) -> StatsRead:
    services = session.exec(select(Service)).all()
    statuses = [_latest_status(session, s.id) for s in services]

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_checks = session.exec(
        select(CheckResult).where(CheckResult.checked_at >= since_24h)
    ).all()
    successful_recent = [c for c in recent_checks if c.is_success]

    open_incidents = session.exec(
        select(Incident).where(Incident.status == IncidentStatus.open)
    ).all()

    avg_ms = None
    if successful_recent:
        avg_ms = round(sum(c.response_time_ms for c in successful_recent) / len(successful_recent), 1)

    return StatsRead(
        total_services=len(services),
        active_services=sum(1 for s in services if s.is_active),
        operational_services=statuses.count("operational"),
        degraded_services=statuses.count("degraded"),
        down_services=statuses.count("down"),
        unknown_services=statuses.count("unknown"),
        open_incidents=len(open_incidents),
        checks_last_24h=len(recent_checks),
        avg_response_ms_last_24h=avg_ms,
    )


# ---------------------------------------------------------------------------
# Routes — services
# ---------------------------------------------------------------------------

@app.post("/api/services", response_model=ServiceRead, status_code=status.HTTP_201_CREATED, tags=["services"])
def create_service(payload: ServiceCreate, session: Session = Depends(get_session)) -> ServiceRead:
    name = payload.name.strip()
    if not name:
        raise HTTPException(422, "Name cannot be blank")
    service = Service(
        name=name,
        url=str(payload.url),
        interval_seconds=payload.interval_seconds,
        tags=payload.tags.strip(),
    )
    session.add(service)
    session.commit()
    session.refresh(service)
    schedule_service(service)
    return _build_service_read(session, service)


@app.get("/api/services", response_model=list[ServiceRead], tags=["services"])
def list_services(
    tag: Optional[str] = Query(default=None, description="Filter by tag"),
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filter by status"),
    session: Session = Depends(get_session),
) -> list[ServiceRead]:
    services = session.exec(select(Service).order_by(Service.created_at.desc())).all()

    results = []
    for svc in services:
        # Tag filtering — any tag in the CSV list matches
        if tag:
            svc_tags = [t.strip().lower() for t in svc.tags.split(",") if t.strip()]
            if tag.lower() not in svc_tags:
                continue
        sr = _build_service_read(session, svc)
        if status_filter and sr.status != status_filter:
            continue
        results.append(sr)
    return results


@app.get("/api/services/{service_id}", response_model=ServiceRead, tags=["services"])
def get_service(service_id: int, session: Session = Depends(get_session)) -> ServiceRead:
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")
    return _build_service_read(session, service)


@app.patch("/api/services/{service_id}", response_model=ServiceRead, tags=["services"])
def update_service(
    service_id: int, payload: ServiceUpdate, session: Session = Depends(get_session)
) -> ServiceRead:
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        if key == "url" and value is not None:
            value = str(value)
        if key == "name" and value is not None:
            value = value.strip()
            if not value:
                raise HTTPException(422, "Name cannot be blank")
        if key == "tags" and value is not None:
            value = value.strip()
        setattr(service, key, value)

    session.add(service)
    session.commit()
    session.refresh(service)

    # Re-schedule or remove job depending on new active state and interval
    if service.is_active:
        schedule_service(service)
    else:
        unschedule_service(service.id)

    return _build_service_read(session, service)


@app.delete("/api/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["services"])
def delete_service(service_id: int, session: Session = Depends(get_session)) -> None:
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")

    unschedule_service(service_id)

    for row in session.exec(select(CheckResult).where(CheckResult.service_id == service_id)).all():
        session.delete(row)
    for row in session.exec(select(Incident).where(Incident.service_id == service_id)).all():
        session.delete(row)
    session.delete(service)
    session.commit()


# ---------------------------------------------------------------------------
# Routes — checks
# ---------------------------------------------------------------------------

@app.post("/api/services/{service_id}/checks", response_model=CheckRead, tags=["checks"])
async def run_service_check(service_id: int, session: Session = Depends(get_session)) -> CheckRead:
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")
    if not service.is_active:
        raise HTTPException(409, "Service is paused")
    return await check_service(session, service)


@app.post("/api/checks/run", response_model=list[CheckRead], tags=["checks"])
async def run_all_checks(session: Session = Depends(get_session)) -> list[CheckRead]:
    services = session.exec(select(Service).where(Service.is_active.is_(True))).all()
    results = []
    for service in services:
        results.append(await check_service(session, service))
    return results


@app.get("/api/services/{service_id}/checks", response_model=list[CheckRead], tags=["checks"])
def list_checks(
    service_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    session: Session = Depends(get_session),
) -> list[CheckRead]:
    if session.get(Service, service_id) is None:
        raise HTTPException(404, "Service not found")
    return session.exec(
        select(CheckResult)
        .where(CheckResult.service_id == service_id)
        .order_by(CheckResult.checked_at.desc())
        .limit(limit)
    ).all()


# ---------------------------------------------------------------------------
# Routes — uptime
# ---------------------------------------------------------------------------

@app.get("/api/services/{service_id}/uptime", tags=["uptime"])
def uptime(
    service_id: int,
    days: int = Query(default=7, ge=1, le=90),
    session: Session = Depends(get_session),
) -> dict:
    if session.get(Service, service_id) is None:
        raise HTTPException(404, "Service not found")
    since = datetime.now(timezone.utc) - timedelta(days=days)
    checks = session.exec(
        select(CheckResult).where(
            CheckResult.service_id == service_id,
            CheckResult.checked_at >= since,
        )
    ).all()
    total = len(checks)
    successes = sum(c.is_success for c in checks)
    return {
        "service_id": service_id,
        "period_days": days,
        "total_checks": total,
        "successful_checks": successes,
        "uptime_percent": round(successes / total * 100, 2) if total else None,
    }


@app.get(
    "/api/services/{service_id}/uptime/history",
    response_model=list[UptimeDayBucket],
    tags=["uptime"],
)
def uptime_history(
    service_id: int,
    days: int = Query(default=30, ge=1, le=90),
    session: Session = Depends(get_session),
) -> list[UptimeDayBucket]:
    """Return per-day uptime buckets for rendering a history bar in the UI."""
    if session.get(Service, service_id) is None:
        raise HTTPException(404, "Service not found")

    now_utc = datetime.now(timezone.utc)
    buckets: list[UptimeDayBucket] = []

    for offset in range(days - 1, -1, -1):
        day_start = (now_utc - timedelta(days=offset)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_end = day_start + timedelta(days=1)

        day_checks = session.exec(
            select(CheckResult).where(
                CheckResult.service_id == service_id,
                CheckResult.checked_at >= day_start,
                CheckResult.checked_at < day_end,
            )
        ).all()

        total = len(day_checks)
        successes = sum(c.is_success for c in day_checks)
        buckets.append(
            UptimeDayBucket(
                date=day_start.strftime("%Y-%m-%d"),
                uptime_percent=round(successes / total * 100, 2) if total else None,
                total_checks=total,
            )
        )

    return buckets


# ---------------------------------------------------------------------------
# Routes — incidents
# ---------------------------------------------------------------------------

@app.get("/api/incidents", response_model=list[IncidentRead], tags=["incidents"])
def list_incidents(
    state: Optional[IncidentStatus] = None,
    service_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> list[IncidentRead]:
    query = select(Incident).order_by(Incident.started_at.desc()).limit(limit)
    if state:
        query = query.where(Incident.status == state)
    if service_id:
        query = query.where(Incident.service_id == service_id)
    incidents = session.exec(query).all()
    return [_build_incident_read(i) for i in incidents]


@app.get("/api/incidents/{incident_id}", response_model=IncidentRead, tags=["incidents"])
def get_incident(incident_id: int, session: Session = Depends(get_session)) -> IncidentRead:
    incident = session.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(404, "Incident not found")
    return _build_incident_read(incident)
