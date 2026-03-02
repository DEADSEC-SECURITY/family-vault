"""
seed_demo.py -- Populate FamilyVault with realistic demo data.

Usage:
    python -m scripts.seed_demo          (from backend/ directory)
    VS Code task: "Dev: Seed Demo Data"

Creates:
  - 1 demo user  (demo@familyvault.local / demo1234)
  - 1 organization ("Smith Family Vault")
  - 4 people, 2 vehicles, 3 saved contacts
  - ~15 items across ids, insurance, business
  - Coverage data, contacts, reminders, links

WARNING: This script DELETES all existing data before seeding.
"""

import os
import sys
from datetime import date, datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Bootstrap: load .env.development before any app imports
# ---------------------------------------------------------------------------
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_project_root = os.path.dirname(_backend_dir)
_env_file = os.path.join(_project_root, ".env.development")

if not os.environ.get("DATABASE_URL") and os.path.exists(_env_file):
    with open(_env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# ---------------------------------------------------------------------------
# App imports (after env is loaded)
# ---------------------------------------------------------------------------
from app.auth.models import Session, User  # noqa: E402
from app.auth.service import hash_password  # noqa: E402
from app.categories.definitions import CATEGORIES  # noqa: E402
from app.contacts.models import ItemContact  # noqa: E402
from app.coverage.models import CoveragePlanLimit, CoverageRow, InNetworkProvider  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.files.encryption import encrypt_field  # noqa: E402
from app.files.models import FileAttachment  # noqa: E402
from app.invitations.models import InvitationToken  # noqa: E402
from app.item_links.models import ItemLink  # noqa: E402
from app.items.models import Item, ItemFieldValue  # noqa: E402
from app.orgs.models import OrgMemberKey, OrgMembership, Organization  # noqa: E402
from app.orgs.service import _encrypt_org_key  # noqa: E402
from app.people.models import ItemPerson, Person  # noqa: E402
from app.reminders.models import CustomReminder  # noqa: E402
from app.saved_contacts.models import ItemSavedContact, SavedContact  # noqa: E402
from app.vehicles.models import ItemVehicle, Vehicle  # noqa: E402

try:
    from app.audit.models import AuditLog  # noqa: E402
except Exception:
    AuditLog = None

# ---------------------------------------------------------------------------
# Delete order (leaves first, roots last)
# ---------------------------------------------------------------------------
DELETE_ORDER = [
    model
    for model in [
        AuditLog,
        InvitationToken,
        ItemLink,
        ItemSavedContact,
        ItemPerson,
        ItemVehicle,
        ItemContact,
        CustomReminder,
        InNetworkProvider,
        CoveragePlanLimit,
        CoverageRow,
        FileAttachment,
        ItemFieldValue,
        SavedContact,
        Item,
        Vehicle,
        Person,
        Session,
        OrgMemberKey,
        OrgMembership,
        Organization,
        User,
    ]
    if model is not None
]


# ═══════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════


def delete_all_data(db):
    """Delete all rows from every table in FK-safe order."""
    for model in DELETE_ORDER:
        count = db.query(model).delete()
        if count:
            print(f"  Deleted {count} rows from {model.__tablename__}")
    db.flush()


def get_encrypted_keys(category: str, subcategory: str) -> set[str]:
    """Return field keys that need encryption for a subcategory."""
    sub = CATEGORIES[category]["subcategories"][subcategory]
    fields = []
    if "field_groups" in sub:
        for group in sub["field_groups"]:
            fields.extend(group["fields"])
    else:
        fields = sub["fields"]
    return {f["key"] for f in fields if f.get("encrypted")}


def get_field_types(category: str, subcategory: str) -> dict[str, str]:
    """Return {field_key: field_type} for a subcategory."""
    sub = CATEGORIES[category]["subcategories"][subcategory]
    fields = []
    if "field_groups" in sub:
        for group in sub["field_groups"]:
            fields.extend(group["fields"])
    else:
        fields = sub["fields"]
    return {f["key"]: f["type"] for f in fields}


def make_item(db, org_id, user_id, org_key, category, subcategory, name, data, notes=None):
    """Create an Item with encrypted field values. Returns the Item."""
    enc_keys = get_encrypted_keys(category, subcategory)
    ftypes = get_field_types(category, subcategory)

    item = Item(
        org_id=org_id,
        created_by=user_id,
        category=category,
        subcategory=subcategory,
        name=name,
        notes=notes,
        encryption_version=1,
    )
    db.add(item)
    db.flush()

    for key, value in data.items():
        if value is None:
            continue
        stored = encrypt_field(str(value), org_key) if key in enc_keys else str(value)
        db.add(ItemFieldValue(
            item_id=item.id,
            field_key=key,
            field_value=stored,
            field_type=ftypes.get(key, "text"),
        ))

    return item


# ═══════════════════════════════════════════════════════════════════════════
#  Create functions
# ═══════════════════════════════════════════════════════════════════════════


def create_user_and_org(db):
    """Create demo user + org (inlined to avoid premature commit)."""
    user = User(
        email="demo@familyvault.local",
        password_hash=hash_password("demo1234"),
        full_name="John Smith",
    )
    db.add(user)
    db.flush()

    org_key = os.urandom(32)
    org = Organization(
        name="Smith Family Vault",
        encryption_key_enc=_encrypt_org_key(org_key),
        created_by=user.id,
    )
    db.add(org)
    db.flush()

    db.add(OrgMembership(org_id=org.id, user_id=user.id, role="owner"))
    db.flush()

    return user, org, org_key


def create_people(db, org_id, user):
    """Create family members. Returns dict[name] -> Person."""
    people_data = [
        ("John", "Smith", date(1985, 4, 12), "Self", "demo@familyvault.local", "(310) 555-0101", True, user.id),
        ("Sarah", "Smith", date(1987, 8, 23), "Spouse", "sarah@familyvault.local", "(310) 555-0102", False, None),
        ("Emma", "Smith", date(2019, 9, 14), "Child", None, None, False, None),
        ("Liam", "Smith", date(2022, 3, 7), "Child", None, None, False, None),
    ]
    people = {}
    for first, last, dob, rel, email, phone, can_login, uid in people_data:
        p = Person(
            org_id=org_id,
            first_name=first,
            last_name=last,
            date_of_birth=dob,
            relationship=rel,
            email=email,
            phone=phone,
            can_login=can_login,
            user_id=uid,
        )
        db.add(p)
        db.flush()
        people[first] = p
    return people


def create_vehicles(db, org_id, people):
    """Create vehicles. Returns dict[name] -> Vehicle."""
    vehicles_data = [
        ("2023 Toyota Camry", "8ABC123", "1HGCG5655WA041389", date(2023, 1, 15), "John", "John"),
        ("2021 Honda CR-V", "7XYZ789", "2HKRW1H53MH123456", date(2021, 6, 20), "Sarah", "Sarah"),
    ]
    vehicles = {}
    for name, plate, vin, acquired, owner, driver in vehicles_data:
        v = Vehicle(
            org_id=org_id,
            name=name,
            license_plate=plate,
            vin=vin,
            acquired_date=acquired,
            owner_id=people[owner].id,
            primary_driver_id=people[driver].id,
        )
        db.add(v)
        db.flush()
        vehicles[name] = v
    return vehicles


def create_saved_contacts(db, org_id):
    """Create saved contacts. Returns dict[name] -> SavedContact."""
    data = [
        ("Robert Chen", "Chen & Associates", "Accountant", "robert@chenaccounting.com", "(310) 555-2001"),
        ("Maria Rodriguez", "Rodriguez Law Group", "Attorney", "maria@rodriguezlaw.com", "(310) 555-2002"),
        ("David Park", "Premiere Financial", "Financial Advisor", "david@premierefinancial.com", "(310) 555-2003"),
    ]
    contacts = {}
    for name, company, role, email, phone in data:
        sc = SavedContact(org_id=org_id, name=name, company=company, role=role, email=email, phone=phone)
        db.add(sc)
        db.flush()
        contacts[name] = sc
    return contacts


# ── Items ─────────────────────────────────────────────────────────────────


def create_id_items(db, org_id, user_id, org_key):
    """Create ID category items. Returns dict[name] -> Item."""
    items = {}

    items["john_dl"] = make_item(db, org_id, user_id, org_key, "ids", "drivers_license",
        "John Smith - Driver's License", {
            "full_name": "John Michael Smith",
            "license_number": "D123-4567-8901",
            "state": "California",
            "issue_date": "2023-03-15",
            "expiration_date": "2028-03-15",
            "license_class": "C",
        })

    items["sarah_dl"] = make_item(db, org_id, user_id, org_key, "ids", "drivers_license",
        "Sarah Smith - Driver's License", {
            "full_name": "Sarah Anne Smith",
            "license_number": "D987-6543-2100",
            "state": "California",
            "issue_date": "2022-07-20",
            "expiration_date": "2027-07-20",
            "license_class": "C",
        })

    items["john_passport"] = make_item(db, org_id, user_id, org_key, "ids", "passport",
        "John Smith - Passport", {
            "full_name": "John Michael Smith",
            "passport_number": "567890123",
            "country": "United States",
            "issue_date": "2021-06-01",
            "expiration_date": "2031-06-01",
        })

    items["sarah_passport"] = make_item(db, org_id, user_id, org_key, "ids", "passport",
        "Sarah Smith - Passport", {
            "full_name": "Sarah Anne Smith",
            "passport_number": "432109876",
            "country": "United States",
            "issue_date": "2022-01-10",
            "expiration_date": "2032-01-10",
        })

    items["john_ssn"] = make_item(db, org_id, user_id, org_key, "ids", "social_security",
        "John Smith - Social Security", {
            "full_name": "John Michael Smith",
            "ssn": "123-45-6789",
        })

    items["sarah_ssn"] = make_item(db, org_id, user_id, org_key, "ids", "social_security",
        "Sarah Smith - Social Security", {
            "full_name": "Sarah Anne Smith",
            "ssn": "987-65-4321",
        })

    items["emma_bc"] = make_item(db, org_id, user_id, org_key, "ids", "birth_certificate",
        "Emma Smith - Birth Certificate", {
            "full_name": "Emma Rose Smith",
            "date_of_birth": "2019-09-14",
            "place_of_birth": "Los Angeles, CA",
            "certificate_number": "2019-LA-094521",
        })

    items["liam_bc"] = make_item(db, org_id, user_id, org_key, "ids", "birth_certificate",
        "Liam Smith - Birth Certificate", {
            "full_name": "Liam James Smith",
            "date_of_birth": "2022-03-07",
            "place_of_birth": "Los Angeles, CA",
            "certificate_number": "2022-LA-032847",
        })

    return items


def create_insurance_items(db, org_id, user_id, org_key):
    """Create insurance category items. Returns dict[name] -> Item."""
    items = {}

    items["auto"] = make_item(db, org_id, user_id, org_key, "insurance", "auto_insurance",
        "State Farm Auto Policy", {
            "provider": "State Farm",
            "policy_number": "SF-AUTO-2024-34521",
            "premium": "2400",
            "payment_frequency": "semi_annual",
            "start_date": "2025-06-01",
            "end_date": "2026-06-01",
        })

    items["health"] = make_item(db, org_id, user_id, org_key, "insurance", "health_insurance",
        "Blue Cross Family Plan", {
            "provider": "Blue Cross Blue Shield",
            "member_id": "XYZ123456789",
            "policy_number": "BCB-2025-78901",
            "group_number": "GRP-55421",
            "plan_type": "ppo",
            "plan_code": "PPO-500",
            "premium": "1850",
            "payment_frequency": "monthly",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "rxbin": "004336",
            "rxpcn": "ADV",
            "rxgrp": "RX5501",
        })

    items["home"] = make_item(db, org_id, user_id, org_key, "insurance", "homeowners_insurance",
        "Allstate Home Policy", {
            "provider": "Allstate Corp.",
            "policy_number": "ALL-HOME-789012",
            "policy_type": "ho3",
            "premium": "3200",
            "payment_frequency": "annual",
            "start_date": "2025-03-01",
            "end_date": "2026-03-01",
            "property_type": "single_family",
            "year_built": "2005",
            "square_footage": "2400",
            "construction_type": "frame",
            "roof_type": "asphalt_shingle",
            "roof_age": "8",
            "valuation_type": "replacement_cost",
            "address_line_1": "1234 Oak Lane",
            "city": "Los Angeles",
            "state": "California",
            "zip_code": "90001",
        })

    items["life"] = make_item(db, org_id, user_id, org_key, "insurance", "life_insurance",
        "Northwestern Mutual Life Policy", {
            "provider": "Northwestern Mutual",
            "policy_number": "NWM-LIFE-456789",
            "policy_type": "term",
            "premium": "85",
            "payment_frequency": "monthly",
            "underwriting_class": "preferred",
            "start_date": "2023-01-15",
            "end_date": "2043-01-15",
        })

    return items


def create_business_items(db, org_id, user_id, org_key):
    """Create business category items. Returns dict[name] -> Item."""
    items = {}

    items["llc"] = make_item(db, org_id, user_id, org_key, "business", "llc",
        "Smith Digital LLC", {
            "business_name": "Smith Digital LLC",
            "ein": "82-1234567",
            "formation_date": "2021-04-15",
            "state_of_formation": "California",
            "registered_agent": "LegalZoom Registered Agent",
            "has_employees": "yes",
            "tax_election": "s_corp",
            "address_line_1": "456 Business Park Dr",
            "city": "Los Angeles",
            "state": "California",
            "zip_code": "90015",
        })

    items["biz_license"] = make_item(db, org_id, user_id, org_key, "business", "business_license",
        "City Business License - Smith Digital", {
            "license_type": "General Business License",
            "license_number": "BL-2025-00891",
            "issuing_authority": "City of Los Angeles",
            "issue_date": "2025-01-01",
            "expiration_date": "2025-12-31",
        })

    items["gl"] = make_item(db, org_id, user_id, org_key, "business", "general_liability",
        "Hiscox GL Policy - Smith Digital", {
            "provider": "Hiscox",
            "policy_number": "HSX-GL-2025-11234",
            "premium": "1200",
            "payment_frequency": "annual",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        })

    return items


# ── Coverage ──────────────────────────────────────────────────────────────


def create_coverage(db, org_id, items):
    """Create coverage rows, plan limits, and providers for insurance items."""

    # --- Auto Insurance ---
    auto_rows = [
        ("bodily_injury", "Bodily Injury Liability", "$100,000 / $300,000", None, "Per person / per accident"),
        ("property_damage", "Property Damage Liability", "$100,000", None, None),
        ("uninsured_motorist_bi", "Uninsured Motorist BI", "$100,000 / $300,000", None, None),
        ("uninsured_motorist_pd", "Uninsured Motorist PD", "$50,000", "$250", None),
        ("collision", "Collision", "Actual Cash Value", "$500", None),
        ("comprehensive", "Comprehensive", "Actual Cash Value", "$250", None),
        ("medical_payments", "Medical Payments", "$5,000", None, "Per person"),
        ("rental", "Rental Reimbursement", "$50/day, $1,500 max", None, None),
        ("roadside", "Roadside Assistance", "Included", None, None),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(auto_rows):
        db.add(CoverageRow(
            item_id=items["auto"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- Health Insurance ---
    health_rows = [
        ("pcp", "Primary Care Visit", "$25", None, "no", None, "40%", "yes"),
        ("specialist", "Specialist Visit", "$50", None, "no", None, "40%", "yes"),
        ("urgent_care", "Urgent Care", "$75", None, "no", None, "40%", "yes"),
        ("er", "Emergency Room", "$250", None, "yes", "$250", "40%", "yes"),
        ("preventive", "Preventive Care", "$0", None, "no", None, "Not Covered", "no"),
        ("mental_health", "Mental Health (Outpatient)", "$25", None, "no", None, "40%", "yes"),
        ("physical_therapy", "Physical Therapy", "$40", None, "no", None, "40%", "yes"),
        ("lab_work", "Lab Work", "$0", None, "no", None, "40%", "yes"),
        ("imaging", "X-Ray / Imaging", "$50", None, "no", None, "40%", "yes"),
        ("inpatient", "Inpatient Hospitalization", None, "20%", "yes", None, "40%", "yes"),
        ("maternity", "Maternity & Newborn", None, "20%", "yes", None, "40%", "yes"),
        ("outpatient_surgery", "Outpatient Surgery", None, "20%", "yes", None, "40%", "yes"),
        ("generic_rx", "Generic Drugs", "$10", None, "no", None, "Not Covered", "no"),
        ("preferred_rx", "Preferred Brand Drugs", "$35", None, "no", None, "Not Covered", "no"),
        ("nonpreferred_rx", "Non-Preferred Brand Drugs", "$70", None, "yes", None, "Not Covered", "no"),
        ("specialty_rx", "Specialty Drugs", None, "30%", "yes", None, "Not Covered", "no"),
        ("dental", "Dental (Preventive)", "$0", None, "no", None, "Not Covered", "no"),
        ("vision", "Vision Exam", "$25", None, "no", None, "Not Covered", "no"),
    ]
    for i, (key, label, in_cop, in_coins, in_ded, out_cop, out_coins, out_ded) in enumerate(health_rows):
        db.add(CoverageRow(
            item_id=items["health"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            in_copay=in_cop, in_coinsurance=in_coins, in_deductible_applies=in_ded,
            out_copay=out_cop, out_coinsurance=out_coins, out_deductible_applies=out_ded,
        ))

    # Health plan limits
    health_limits = [
        ("deductible_individual_in", "Individual Deductible", "$500"),
        ("deductible_family_in", "Family Deductible", "$1,500"),
        ("oop_max_individual_in", "Individual OOP Max", "$4,000"),
        ("oop_max_family_in", "Family OOP Max", "$8,000"),
        ("deductible_individual_out", "Individual Deductible", "$2,000"),
        ("deductible_family_out", "Family Deductible", "$6,000"),
        ("oop_max_individual_out", "Individual OOP Max", "$12,000"),
        ("oop_max_family_out", "Family OOP Max", "$24,000"),
    ]
    for i, (key, label, val) in enumerate(health_limits):
        db.add(CoveragePlanLimit(
            item_id=items["health"].id, org_id=org_id,
            limit_key=key, limit_label=label, limit_value=val, sort_order=i,
        ))

    # Health providers
    providers = [
        ("Dr. Emily Tran", "Primary Care", "(310) 555-3001", "100 Medical Plaza, Suite 200, Los Angeles, CA 90024"),
        ("Dr. James Nakamura", "Pediatrics", "(310) 555-3002", "200 Children's Way, Suite 310, Los Angeles, CA 90024"),
        ("Dr. Lisa Park", "Dermatology", "(310) 555-3003", "300 Skin Center Blvd, Los Angeles, CA 90025"),
    ]
    for name, spec, phone, addr in providers:
        db.add(InNetworkProvider(
            item_id=items["health"].id, org_id=org_id,
            provider_name=name, specialty=spec, phone=phone, address=addr,
        ))

    # --- Homeowners Insurance ---
    home_rows = [
        ("dwelling", "Dwelling (Coverage A)", "$450,000", "$2,500", None),
        ("other_structures", "Other Structures (Coverage B)", "$45,000", None, "10% of dwelling"),
        ("personal_property", "Personal Property (Coverage C)", "$225,000", None, "50% of dwelling"),
        ("loss_of_use", "Loss of Use (Coverage D)", "$90,000", None, "20% of dwelling"),
        ("personal_liability", "Personal Liability (Coverage E)", "$300,000", None, None),
        ("medical_payments", "Medical Payments (Coverage F)", "$5,000", None, "Per person"),
        ("water_backup", "Water Backup", "$25,000", "$1,000", "Endorsement"),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(home_rows):
        db.add(CoverageRow(
            item_id=items["home"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- Life Insurance ---
    life_rows = [
        ("death_benefit", "Death Benefit", None, None, "$500,000"),
        ("policy_type", "Policy Type", None, None, "20-Year Level Term"),
        ("cash_value", "Cash Value", None, None, "N/A (Term)"),
        ("primary_beneficiary", "Primary Beneficiary", None, None, "Sarah Anne Smith (100%)"),
        ("contingent_beneficiary", "Contingent Beneficiary", None, None, "Emma R. Smith & Liam J. Smith (50/50)"),
        ("waiver_of_premium", "Waiver of Premium", None, None, "Included"),
        ("accidental_death", "Accidental Death Benefit", None, None, "$500,000 (Rider)"),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(life_rows):
        db.add(CoverageRow(
            item_id=items["life"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- General Liability ---
    gl_rows = [
        ("per_occurrence", "Per Occurrence Limit", "$1,000,000", "$1,000", None),
        ("aggregate", "General Aggregate", "$2,000,000", None, None),
        ("products_ops", "Products/Completed Operations", "$2,000,000", None, None),
        ("personal_injury", "Personal & Advertising Injury", "$1,000,000", None, None),
        ("damage_rented", "Damage to Rented Premises", "$100,000", None, "Per occurrence"),
        ("medical_expense", "Medical Expense", "$10,000", None, "Per person"),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(gl_rows):
        db.add(CoverageRow(
            item_id=items["gl"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    db.flush()


# ── Contacts, reminders, associations ─────────────────────────────────────


def create_item_contacts(db, org_id, items):
    """Create item contacts (phone, email, url, address)."""
    contacts = [
        # Auto insurance
        (items["auto"].id, "Customer Service", "1-800-782-8332", "phone", 0),
        (items["auto"].id, "Claims", "1-800-732-5246", "phone", 1),
        (items["auto"].id, "Online Portal", "https://www.statefarm.com", "url", 2),
        # Health insurance
        (items["health"].id, "Member Services", "1-800-262-2583", "phone", 0),
        (items["health"].id, "24/7 Nurse Line", "1-888-258-3428", "phone", 1),
        (items["health"].id, "Online Portal", "https://www.bcbs.com", "url", 2),
        # Homeowners
        (items["home"].id, "Customer Service", "1-800-255-7828", "phone", 0),
        (items["home"].id, "Claims", "1-800-547-8676", "phone", 1),
        # Life
        (items["life"].id, "Policy Services", "1-866-950-4644", "phone", 0),
    ]
    for item_id, label, value, ctype, order in contacts:
        db.add(ItemContact(
            item_id=item_id, org_id=org_id,
            label=label, value=value, contact_type=ctype, sort_order=order,
        ))

    # Address contact for health claims
    db.add(ItemContact(
        item_id=items["health"].id, org_id=org_id,
        label="Claims Address", value="PO Box 105187", contact_type="address", sort_order=3,
        address_line1="PO Box 105187", address_city="Atlanta", address_state="GA", address_zip="30348",
    ))

    db.flush()


def create_reminders(db, org_id, user_id, all_items):
    """Create custom reminders for expiring documents."""
    today = date.today()
    reminders = [
        (all_items["john_dl"].id, "Renew driver's license", date(2028, 2, 15), "none",
         "Schedule DMV appointment 2 months before expiration"),
        (all_items["sarah_dl"].id, "Renew driver's license", date(2027, 6, 20), "none",
         "Schedule DMV appointment"),
        (all_items["auto"].id, "Review auto policy rates", date(2026, 5, 1), "yearly",
         "Compare rates before renewal"),
        (all_items["home"].id, "Renew home insurance", date(2026, 2, 1), "yearly",
         "Review coverage amounts before renewal"),
        (all_items["biz_license"].id, "Renew business license", date(2025, 11, 15), "yearly",
         "Submit renewal application by mid-November"),
    ]
    for item_id, title, rdate, repeat, note in reminders:
        db.add(CustomReminder(
            item_id=item_id, org_id=org_id, created_by=user_id,
            title=title, remind_date=rdate, repeat=repeat, note=note,
        ))
    db.flush()


def create_item_people(db, org_id, all_items, people):
    """Link people to items."""
    links = [
        (all_items["john_dl"].id, people["John"].id, "Owner"),
        (all_items["sarah_dl"].id, people["Sarah"].id, "Owner"),
        (all_items["john_passport"].id, people["John"].id, "Owner"),
        (all_items["sarah_passport"].id, people["Sarah"].id, "Owner"),
        (all_items["john_ssn"].id, people["John"].id, "Owner"),
        (all_items["sarah_ssn"].id, people["Sarah"].id, "Owner"),
        (all_items["emma_bc"].id, people["Emma"].id, "Owner"),
        (all_items["liam_bc"].id, people["Liam"].id, "Owner"),
        (all_items["health"].id, people["John"].id, "Primary"),
        (all_items["health"].id, people["Sarah"].id, "Spouse"),
        (all_items["health"].id, people["Emma"].id, "Dependent"),
        (all_items["health"].id, people["Liam"].id, "Dependent"),
        (all_items["life"].id, people["John"].id, "Insured"),
        (all_items["life"].id, people["Sarah"].id, "Beneficiary"),
        (all_items["auto"].id, people["John"].id, "Primary Driver"),
        (all_items["auto"].id, people["Sarah"].id, "Secondary Driver"),
    ]
    for item_id, person_id, role in links:
        db.add(ItemPerson(item_id=item_id, person_id=person_id, role=role, org_id=org_id))
    db.flush()


def create_item_vehicles(db, org_id, all_items, vehicles):
    """Link vehicles to auto insurance."""
    for v in vehicles.values():
        db.add(ItemVehicle(item_id=all_items["auto"].id, vehicle_id=v.id, org_id=org_id))
    db.flush()


def create_item_links(db, org_id, biz_items):
    """Link business license and GL policy to LLC."""
    db.add(ItemLink(
        parent_item_id=biz_items["llc"].id,
        child_item_id=biz_items["biz_license"].id,
        link_type="business_license",
        org_id=org_id,
    ))
    db.add(ItemLink(
        parent_item_id=biz_items["llc"].id,
        child_item_id=biz_items["gl"].id,
        link_type="business_insurance",
        org_id=org_id,
    ))
    db.flush()


def create_item_saved_contacts(db, org_id, all_items, saved_contacts):
    """Link saved contacts to items."""
    links = [
        (all_items["llc"].id, saved_contacts["Robert Chen"].id),
        (all_items["llc"].id, saved_contacts["Maria Rodriguez"].id),
        (all_items["life"].id, saved_contacts["David Park"].id),
    ]
    for item_id, sc_id in links:
        db.add(ItemSavedContact(item_id=item_id, saved_contact_id=sc_id, org_id=org_id))
    db.flush()


# ═══════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════


def seed_demo():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("FamilyVault Demo Data Seeder")
        print("=" * 60)
        print()

        print("[1/8] Cleaning database...")
        delete_all_data(db)

        print("[2/8] Creating user and organization...")
        user, org, org_key = create_user_and_org(db)

        print("[3/8] Creating family members...")
        people = create_people(db, org.id, user)

        print("[4/8] Creating vehicles...")
        vehicles = create_vehicles(db, org.id, people)

        print("[5/8] Creating saved contacts...")
        saved_contacts = create_saved_contacts(db, org.id)

        print("[6/8] Creating items...")
        id_items = create_id_items(db, org.id, user.id, org_key)
        ins_items = create_insurance_items(db, org.id, user.id, org_key)
        biz_items = create_business_items(db, org.id, user.id, org_key)
        all_items = {**id_items, **ins_items, **biz_items}

        print("[7/8] Creating coverage data...")
        create_coverage(db, org.id, ins_items | biz_items)

        print("[8/8] Creating relationships...")
        create_item_contacts(db, org.id, ins_items)
        create_reminders(db, org.id, user.id, all_items)
        create_item_people(db, org.id, all_items, people)
        create_item_vehicles(db, org.id, all_items, vehicles)
        create_item_links(db, org.id, biz_items)
        create_item_saved_contacts(db, org.id, all_items, saved_contacts)

        db.commit()

        print()
        print("=" * 60)
        print("Demo data seeded successfully!")
        print()
        print(f"  Login:  demo@familyvault.local / demo1234")
        print(f"  Org:    {org.name}")
        print(f"  Items:  {len(all_items)} created")
        print(f"  People: {len(people)} family members")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\nERROR: Seed failed - {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
