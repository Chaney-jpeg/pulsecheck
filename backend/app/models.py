from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ServiceStatus(str, Enum):
    operational = "operational"
    degraded = "degraded"
    down = "down"


class IncidentStatus(str, Enum):
    open = "open"
    resolved = "resolved"


class Service(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, min_length=1, max_length=120)
    url: str = Field(max_length=2048)
    interval_seconds: int = Field(default=300, ge=30, le=86400)
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)


class CheckResult(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    service_id: int = Field(foreign_key="service.id", index=True)
    checked_at: datetime = Field(default_factory=utc_now, index=True)
    is_success: bool
    status_code: int | None = None
    response_time_ms: int
    error: str | None = Field(default=None, max_length=500)


class Incident(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    service_id: int = Field(foreign_key="service.id", index=True)
    status: IncidentStatus = Field(default=IncidentStatus.open, index=True)
    started_at: datetime = Field(default_factory=utc_now)
    resolved_at: datetime | None = None
    summary: str = Field(max_length=500)
