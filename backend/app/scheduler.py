"""
Background scheduler that runs service checks automatically
based on each service's `interval_seconds` setting.

Uses APScheduler with a per-service job. Jobs are added, updated,
or removed as services are created / updated / deleted.
"""
import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlmodel import Session

from .checks import check_service
from .database import engine
from .models import Service

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="UTC")
    return _scheduler


def _job_id(service_id: int) -> str:
    return f"service_check_{service_id}"


async def _run_check(service_id: int) -> None:
    """Execute a single service check inside its own DB session."""
    with Session(engine) as session:
        service = session.get(Service, service_id)
        if service is None or not service.is_active:
            return
        try:
            await check_service(session, service)
        except Exception:
            logger.exception("Scheduled check failed for service %s", service_id)


def schedule_service(service: Service) -> None:
    """Add or replace the scheduled job for a service."""
    scheduler = get_scheduler()
    job_id = _job_id(service.id)
    trigger = IntervalTrigger(seconds=service.interval_seconds)

    if scheduler.get_job(job_id):
        scheduler.reschedule_job(job_id, trigger=trigger)
        logger.debug("Rescheduled job %s every %ss", job_id, service.interval_seconds)
    else:
        scheduler.add_job(
            _run_check,
            trigger=trigger,
            id=job_id,
            kwargs={"service_id": service.id},
            replace_existing=True,
            misfire_grace_time=30,
        )
        logger.debug("Scheduled job %s every %ss", job_id, service.interval_seconds)


def unschedule_service(service_id: int) -> None:
    """Remove the scheduled job for a service (e.g. on delete or pause)."""
    scheduler = get_scheduler()
    job_id = _job_id(service_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.debug("Removed job %s", job_id)


def start_scheduler_with_existing_services() -> None:
    """
    Called at app startup: schedule all currently active services and
    start the APScheduler event loop.
    """
    from .models import Service as ServiceModel

    scheduler = get_scheduler()
    with Session(engine) as session:
        services = session.exec(
            __import__("sqlmodel", fromlist=["select"]).select(ServiceModel)
            .where(ServiceModel.is_active.is_(True))
        ).all()
        for svc in services:
            schedule_service(svc)

    if not scheduler.running:
        scheduler.start()
        logger.info("APScheduler started with %d service jobs", len(services))
