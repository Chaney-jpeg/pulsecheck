from datetime import datetime

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    url: AnyHttpUrl
    interval_seconds: int = Field(default=300, ge=30, le=86400)


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    url: AnyHttpUrl | None = None
    interval_seconds: int | None = Field(default=None, ge=30, le=86400)
    is_active: bool | None = None


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    url: str
    interval_seconds: int
    is_active: bool
    created_at: datetime
    status: str = "unknown"


class CheckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    service_id: int
    checked_at: datetime
    is_success: bool
    status_code: int | None
    response_time_ms: int
    error: str | None


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    service_id: int
    status: str
    started_at: datetime
    resolved_at: datetime | None
    summary: str
