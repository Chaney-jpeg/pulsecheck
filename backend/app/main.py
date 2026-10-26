from contextlib import asynccontextmanager
import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .checks import check_service
from .database import create_db_and_tables, get_session
from .models import CheckResult, Incident, IncidentStatus, Service
from .schemas import CheckRead, IncidentRead, ServiceCreate, ServiceRead, ServiceUpdate


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="PulseCheck API", version="0.1.0", lifespan=lifespan)
allowed_origins = os.getenv(
    "PULSECHECK_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


def latest_status(session: Session, service_id: int) -> str:
    latest = session.exec(select(CheckResult).where(CheckResult.service_id == service_id)
                          .order_by(CheckResult.checked_at.desc())).first()
    if latest is None:
        return "unknown"
    return "operational" if latest.is_success else "down"


def service_read(session: Session, service: Service) -> ServiceRead:
    return ServiceRead.model_validate(service).model_copy(update={"status": latest_status(session, service.id)})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/services", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(payload: ServiceCreate, session: Session = Depends(get_session)):
    service = Service(name=payload.name.strip(), url=str(payload.url), interval_seconds=payload.interval_seconds)
    if not service.name:
        raise HTTPException(422, "Name cannot be blank")
    session.add(service)
    session.commit()
    session.refresh(service)
    return service_read(session, service)


@app.get("/api/services", response_model=list[ServiceRead])
def list_services(session: Session = Depends(get_session)):
    services = session.exec(select(Service).order_by(Service.created_at.desc())).all()
    return [service_read(session, item) for item in services]


@app.get("/api/services/{service_id}", response_model=ServiceRead)
def get_service(service_id: int, session: Session = Depends(get_session)):
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")
    return service_read(session, service)


@app.patch("/api/services/{service_id}", response_model=ServiceRead)
def update_service(service_id: int, payload: ServiceUpdate, session: Session = Depends(get_session)):
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "url" and value is not None:
            value = str(value)
        if key == "name" and value is not None:
            value = value.strip()
            if not value:
                raise HTTPException(422, "Name cannot be blank")
        setattr(service, key, value)
    session.add(service)
    session.commit()
    session.refresh(service)
    return service_read(session, service)


@app.delete("/api/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(service_id: int, session: Session = Depends(get_session)):
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")
    for row in session.exec(select(CheckResult).where(CheckResult.service_id == service_id)).all():
        session.delete(row)
    for row in session.exec(select(Incident).where(Incident.service_id == service_id)).all():
        session.delete(row)
    session.delete(service)
    session.commit()


@app.post("/api/services/{service_id}/checks", response_model=CheckRead)
async def run_service_check(service_id: int, session: Session = Depends(get_session)):
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")
    if not service.is_active:
        raise HTTPException(409, "Service is paused")
    return await check_service(session, service)


@app.post("/api/checks/run", response_model=list[CheckRead])
async def run_all_checks(session: Session = Depends(get_session)):
    services = session.exec(select(Service).where(Service.is_active.is_(True))).all()
    results = []
    for service in services:
        results.append(await check_service(session, service))
    return results


@app.get("/api/services/{service_id}/checks", response_model=list[CheckRead])
def list_checks(service_id: int, limit: int = Query(default=50, ge=1, le=500), session: Session = Depends(get_session)):
    if session.get(Service, service_id) is None:
        raise HTTPException(404, "Service not found")
    return session.exec(select(CheckResult).where(CheckResult.service_id == service_id)
                        .order_by(CheckResult.checked_at.desc()).limit(limit)).all()


@app.get("/api/services/{service_id}/uptime")
def uptime(service_id: int, days: int = Query(default=7, ge=1, le=90), session: Session = Depends(get_session)):
    if session.get(Service, service_id) is None:
        raise HTTPException(404, "Service not found")
    since = datetime.now(timezone.utc) - timedelta(days=days)
    checks = session.exec(select(CheckResult).where(
        CheckResult.service_id == service_id, CheckResult.checked_at >= since
    )).all()
    total = len(checks)
    successes = sum(item.is_success for item in checks)
    return {"service_id": service_id, "period_days": days, "total_checks": total,
            "successful_checks": successes, "uptime_percent": round(successes / total * 100, 2) if total else None}


@app.get("/api/incidents", response_model=list[IncidentRead])
def list_incidents(state: IncidentStatus | None = None, session: Session = Depends(get_session)):
    query = select(Incident).order_by(Incident.started_at.desc())
    if state:
        query = query.where(Incident.status == state)
    return session.exec(query).all()
