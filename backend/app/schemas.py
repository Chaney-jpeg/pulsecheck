from datetime import datetime
from typing import Optional

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    url: AnyHttpUrl
    interval_seconds: int = Field(default=300, ge=30, le=86400)
    tags: str = Field(default="", max_length=500)


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    url: Optional[AnyHttpUrl] = None
    interval_seconds: Optional[int] = Field(default=None, ge=30, le=86400)
    is_active: Optional[bool] = None
    tags: Optional[str] = Field(default=None, max_length=500)


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    url: str
    interval_seconds: int
    is_active: bool
    tags: str
    created_at: datetime
    status: str = "unknown"
    uptime_percent: Optional[float] = None
    avg_response_ms: Optional[float] = None


class CheckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    service_id: int
    checked_at: datetime
    is_success: bool
    status_code: Optional[int]
    response_time_ms: int
    error: Optional[str]


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    service_id: int
    status: str
    started_at: datetime
    resolved_at: Optional[datetime]
    summary: str
    duration_seconds: Optional[int] = None


class UptimeDayBucket(BaseModel):
    date: str          # ISO date string YYYY-MM-DD
    uptime_percent: Optional[float]
    total_checks: int


class StatsRead(BaseModel):
    total_services: int
    active_services: int
    operational_services: int
    degraded_services: int
    down_services: int
    unknown_services: int
    open_incidents: int
    checks_last_24h: int
    avg_response_ms_last_24h: Optional[float]
