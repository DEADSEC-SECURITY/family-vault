"""Create a demo user if it doesn't already exist."""

from uuid import uuid4

from app.auth.service import hash_password, get_user_by_email
from app.database import SessionLocal
from app.auth.models import User
from app.orgs.service import create_organization
from app.people.models import Person


def seed_demo_user():
    db = SessionLocal()
    try:
        existing = get_user_by_email(db, "demo@familyvault.local")
        if existing:
            print("Demo user already exists, skipping seed.")
            return

        user = User(
            id=str(uuid4()),
            email="demo@familyvault.local",
            password_hash=hash_password("demo1234"),
            full_name="Demo User",
        )
        db.add(user)
        db.flush()

        org = create_organization(db, name="Demo Vault", created_by=user.id)

        # Create person record for the user
        person = Person(
            id=str(uuid4()),
            org_id=org.id,
            first_name="Demo",
            last_name="User",
            email=user.email,
            can_login=True,
            user_id=user.id,
        )
        db.add(person)

        db.commit()
        print(f"Demo user created: demo@familyvault.local / demo1234")
        print(f"Demo org created: {org.name} ({org.id})")
        print(f"Demo person created: {person.full_name}")
    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_user()
