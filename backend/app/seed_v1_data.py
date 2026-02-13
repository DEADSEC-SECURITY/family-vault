"""Seed v1 (server-side encrypted) items into the most recent org for migration testing."""

import sys
from uuid import uuid4

from app.database import SessionLocal
from app.files.encryption import encrypt_field
from app.items.models import Item, ItemFieldValue
from app.orgs.models import OrgMembership, Organization
from app.orgs.service import get_org_encryption_key


SAMPLE_ITEMS = [
    {
        "category": "ids",
        "subcategory": "drivers_license",
        "name": "John Smith - Driver's License",
        "fields": [
            ("full_name", "John Smith", "text", False),
            ("license_number", "D1234567", "text", True),
            ("state", "California", "text", False),
            ("issue_date", "2022-03-15", "date", False),
            ("expiration_date", "2027-03-15", "date", False),
        ],
    },
    {
        "category": "ids",
        "subcategory": "passport",
        "name": "John Smith - Passport",
        "fields": [
            ("full_name", "John Smith", "text", False),
            ("passport_number", "X12345678", "text", True),
            ("country", "United States", "text", False),
            ("issue_date", "2021-06-01", "date", False),
            ("expiration_date", "2031-06-01", "date", False),
        ],
    },
    {
        "category": "ids",
        "subcategory": "drivers_license",
        "name": "Jane Smith - Driver's License",
        "fields": [
            ("full_name", "Jane Smith", "text", False),
            ("license_number", "D9876543", "text", True),
            ("state", "California", "text", False),
            ("issue_date", "2023-01-10", "date", False),
            ("expiration_date", "2028-01-10", "date", False),
        ],
    },
    {
        "category": "ids",
        "subcategory": "passport",
        "name": "Jane Smith - Passport",
        "fields": [
            ("full_name", "Jane Smith", "text", False),
            ("passport_number", "X98765432", "text", True),
            ("country", "United States", "text", False),
            ("issue_date", "2020-09-20", "date", False),
            ("expiration_date", "2030-09-20", "date", False),
        ],
    },
]


def seed_v1_data(email: str | None = None):
    db = SessionLocal()
    try:
        if email:
            from app.auth.models import User
            user = db.query(User).filter(User.email == email.lower().strip()).first()
            if not user:
                print(f"User '{email}' not found.")
                return
            membership = (
                db.query(OrgMembership)
                .filter(OrgMembership.user_id == user.id)
                .first()
            )
            if not membership:
                print(f"User '{email}' has no org membership.")
                return
            org = db.query(Organization).filter(Organization.id == membership.org_id).first()
            user_id = user.id
        else:
            # Use the most recently created org
            org = db.query(Organization).order_by(Organization.created_at.desc()).first()
            if not org:
                print("No organizations found. Register a user first.")
                return
            membership = (
                db.query(OrgMembership)
                .filter(OrgMembership.org_id == org.id)
                .first()
            )
            user_id = membership.user_id if membership else org.created_by

        org_key = get_org_encryption_key(org)
        print(f"Seeding v1 items into org: {org.name} ({org.id})")

        for item_data in SAMPLE_ITEMS:
            item = Item(
                id=str(uuid4()),
                org_id=org.id,
                created_by=user_id,
                category=item_data["category"],
                subcategory=item_data["subcategory"],
                name=item_data["name"],
                encryption_version=1,
            )
            db.add(item)
            db.flush()

            for field_key, field_value, field_type, encrypted in item_data["fields"]:
                value = field_value
                if encrypted:
                    value = encrypt_field(field_value, org_key)
                fv = ItemFieldValue(
                    id=str(uuid4()),
                    item_id=item.id,
                    field_key=field_key,
                    field_value=value,
                    field_type=field_type,
                )
                db.add(fv)

            print(f"  Created: {item_data['name']} (v1)")

        db.commit()
        print(f"\nDone! Created {len(SAMPLE_ITEMS)} v1 items.")
        print("Visit /settings/encryption to test migration.")

    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    email_arg = sys.argv[1] if len(sys.argv) > 1 else None
    seed_v1_data(email_arg)
