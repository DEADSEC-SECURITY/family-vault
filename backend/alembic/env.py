from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base

# Import all models so they're registered with Base.metadata
from app.auth.models import Session, User  # noqa: F401
from app.orgs.models import OrgMembership, Organization  # noqa: F401
from app.items.models import Item, ItemFieldValue  # noqa: F401
from app.files.models import FileAttachment  # noqa: F401
from app.reminders.models import CustomReminder  # noqa: F401
from app.contacts.models import ItemContact  # noqa: F401
from app.vehicles.models import Vehicle, ItemVehicle  # noqa: F401
from app.people.models import Person, ItemPerson  # noqa: F401
from app.coverage.models import CoveragePlanLimit, CoverageRow, InNetworkProvider  # noqa: F401
from app.item_links.models import ItemLink  # noqa: F401
from app.saved_contacts.models import SavedContact, ItemSavedContact  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with the app's DATABASE_URL
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
