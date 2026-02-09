import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logger = logging.getLogger(__name__)


def _start_scheduler():
    """Start the background scheduler for reminder email checks."""
    from apscheduler.schedulers.background import BackgroundScheduler

    def check_due_reminders():
        """Check for due custom reminders and send emails."""
        from app.database import SessionLocal
        from app.reminders.service import get_due_reminders_for_email
        from app.email.service import send_reminder_email
        from app.orgs.models import OrgMembership
        from app.auth.models import User

        db = SessionLocal()
        try:
            due = get_due_reminders_for_email(db)
            if not due:
                return

            logger.info("Found %d due reminders to email", len(due))
            for cr in due:
                # Get all org members' emails
                members = (
                    db.query(User)
                    .join(OrgMembership, OrgMembership.user_id == User.id)
                    .filter(OrgMembership.org_id == cr.org_id)
                    .all()
                )
                for member in members:
                    send_reminder_email(
                        to=member.email,
                        item_name=cr.item.name,
                        reminder_title=cr.title,
                        remind_date=cr.remind_date.isoformat(),
                        category=cr.item.category,
                        item_id=cr.item_id,
                    )

                cr.email_sent = True

            db.commit()
        except Exception:
            logger.exception("Error checking due reminders")
            db.rollback()
        finally:
            db.close()

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        check_due_reminders, "interval", hours=1, id="reminder_email_check"
    )
    scheduler.start()
    logger.info("Started reminder email scheduler (hourly)")
    return scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: import models so they're registered
    from app.auth.models import Session, User  # noqa: F401
    from app.orgs.models import OrgMembership, Organization  # noqa: F401
    from app.items.models import Item, ItemFieldValue  # noqa: F401
    from app.files.models import FileAttachment  # noqa: F401
    from app.reminders.models import CustomReminder  # noqa: F401
    from app.contacts.models import ItemContact  # noqa: F401
    from app.coverage.models import CoveragePlanLimit, CoverageRow, InNetworkProvider  # noqa: F401
    from app.vehicles.models import Vehicle, ItemVehicle  # noqa: F401
    from app.people.models import Person  # noqa: F401

    # Start background scheduler
    scheduler = _start_scheduler()

    yield

    # Shutdown: stop scheduler
    scheduler.shutdown(wait=False)
    logger.info("Stopped reminder email scheduler")


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.auth.router import router as auth_router  # noqa: E402
from app.orgs.router import router as orgs_router  # noqa: E402
from app.categories.router import router as categories_router  # noqa: E402
from app.items.router import router as items_router  # noqa: E402
from app.files.router import router as files_router  # noqa: E402
from app.reminders.router import router as reminders_router  # noqa: E402
from app.search.router import router as search_router  # noqa: E402
from app.providers.router import router as providers_router  # noqa: E402
from app.contacts.router import router as contacts_router  # noqa: E402
from app.coverage.router import router as coverage_router  # noqa: E402
from app.vehicles.router import router as vehicles_router  # noqa: E402
from app.people.router import router as people_router  # noqa: E402
from app.dashboard.router import router as dashboard_router  # noqa: E402
from app.visas.router import router as visas_router  # noqa: E402

app.include_router(auth_router)
app.include_router(orgs_router)
app.include_router(categories_router)
app.include_router(items_router)
app.include_router(files_router)
app.include_router(reminders_router)
app.include_router(search_router)
app.include_router(providers_router)
app.include_router(contacts_router)
app.include_router(coverage_router)
app.include_router(vehicles_router)
app.include_router(people_router)
app.include_router(dashboard_router)
app.include_router(visas_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
