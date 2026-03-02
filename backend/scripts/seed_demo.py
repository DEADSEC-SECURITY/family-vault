"""
seed_demo.py -- Populate FamilyVault with realistic demo data.

Usage:
    python -m scripts.seed_demo          (from backend/ directory)
    VS Code task: "Dev: Seed Demo Data"

Creates:
  - 1 demo user  (demo@familyvault.local / demo1234)
  - 1 organization ("Smith Family Vault")
  - 4 people, 2 vehicles, 3 saved contacts
  - ~40 items across ids, insurance, business, security_codes
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

    # --- Driver's Licenses ---
    items["john_dl"] = make_item(db, org_id, user_id, org_key, "ids", "drivers_license",
        "John Smith - Driver's License", {
            "full_name": "John Michael Smith",
            "license_number": "D123-4567-8901",
            "state": "California",
            "issue_date": "2023-03-15",
            "expiration_date": "2028-03-15",
        })

    items["sarah_dl"] = make_item(db, org_id, user_id, org_key, "ids", "drivers_license",
        "Sarah Smith - Driver's License", {
            "full_name": "Sarah Anne Smith",
            "license_number": "D987-6543-2100",
            "state": "California",
            "issue_date": "2022-07-20",
            "expiration_date": "2027-07-20",
        })

    # --- Passports ---
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

    # --- Visas ---
    items["john_visa"] = make_item(db, org_id, user_id, org_key, "ids", "visa",
        "John Smith - UK Business Visa", {
            "full_name": "John Michael Smith",
            "country": "United Kingdom",
            "visa_type": "Business (Tier 2)",
            "visa_number": "GBR-2024-V78901",
            "passport_number": "567890123",
            "issue_date": "2024-06-15",
            "expiration_date": "2026-06-15",
            "entry_type": "multiple",
        })

    # --- Social Security ---
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

    # --- Birth Certificates ---
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

    # --- Custom IDs ---
    items["john_global_entry"] = make_item(db, org_id, user_id, org_key, "ids", "custom_id",
        "John Smith - Global Entry", {
            "full_name": "John Michael Smith",
            "id_type": "Global Entry / TSA PreCheck",
            "id_number": "GE-98765432",
            "issuing_body": "U.S. Customs and Border Protection",
            "issue_date": "2023-11-01",
            "expiration_date": "2028-11-01",
        })

    items["sarah_costco"] = make_item(db, org_id, user_id, org_key, "ids", "custom_id",
        "Sarah Smith - Costco Membership", {
            "full_name": "Sarah Anne Smith",
            "id_type": "Costco Executive Membership",
            "id_number": "111-234-567-890",
            "issuing_body": "Costco Wholesale",
            "issue_date": "2024-01-15",
            "expiration_date": "2025-01-15",
        })

    # --- Personal Tax Documents ---
    items["tax_2024"] = make_item(db, org_id, user_id, org_key, "ids", "personal_tax",
        "2024 Federal Tax Return", {
            "document_type": "Form 1040 - U.S. Individual Income Tax Return",
            "tax_year": "2024",
            "filing_status": "married_filing_jointly",
        })

    items["tax_2023"] = make_item(db, org_id, user_id, org_key, "ids", "personal_tax",
        "2023 Federal Tax Return", {
            "document_type": "Form 1040 - U.S. Individual Income Tax Return",
            "tax_year": "2023",
            "filing_status": "married_filing_jointly",
        })

    return items


def create_insurance_items(db, org_id, user_id, org_key):
    """Create insurance category items. Returns dict[name] -> Item."""
    items = {}

    # --- Auto Insurance ---
    items["auto"] = make_item(db, org_id, user_id, org_key, "insurance", "auto_insurance",
        "State Farm Auto Policy", {
            "provider": "State Farm",
            "policy_number": "SF-AUTO-2024-34521",
            "premium": "2400",
            "payment_frequency": "semi_annual",
            "start_date": "2025-06-01",
            "end_date": "2026-06-01",
        })

    # --- Health Insurance ---
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

    # --- Homeowners Insurance ---
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

    # --- Renters Insurance ---
    items["renters"] = make_item(db, org_id, user_id, org_key, "insurance", "renters_insurance",
        "Lemonade Renters Policy", {
            "provider": "Lemonade",
            "policy_number": "LEM-RENT-2025-56789",
            "premium": "180",
            "payment_frequency": "annual",
            "start_date": "2025-08-01",
            "end_date": "2026-08-01",
            "rental_type": "apartment",
            "valuation_type": "replacement_cost",
            "address_line_1": "789 College Ave",
            "apt_suite_unit": "Apt 4B",
            "city": "Los Angeles",
            "state": "California",
            "zip_code": "90024",
        }, notes="Renters policy for investment property unit")

    # --- Life Insurance ---
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

    # --- Other Insurance ---
    items["umbrella"] = make_item(db, org_id, user_id, org_key, "insurance", "other_insurance",
        "USAA Personal Umbrella Policy", {
            "insurance_type": "Personal Umbrella Liability",
            "provider": "USAA",
            "policy_number": "USAA-UMB-2025-33456",
            "premium": "350",
            "payment_frequency": "annual",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        })

    return items


def create_business_items(db, org_id, user_id, org_key):
    """Create business category items. Returns dict[name] -> Item."""
    items = {}

    # --- LLC ---
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

    # --- Corporation ---
    items["corp"] = make_item(db, org_id, user_id, org_key, "business", "corporation",
        "Smith Holdings Inc.", {
            "business_name": "Smith Holdings Inc.",
            "ein": "47-9876543",
            "formation_date": "2019-08-20",
            "state_of_incorporation": "Delaware",
            "registered_agent": "Corporation Service Company",
            "has_employees": "no",
            "tax_election": "c_corp",
            "address_line_1": "1209 Orange St",
            "city": "Wilmington",
            "state": "Delaware",
            "zip_code": "19801",
        })

    # --- Partnership ---
    items["partnership"] = make_item(db, org_id, user_id, org_key, "business", "partnership",
        "Smith & Chen Consulting", {
            "business_name": "Smith & Chen Consulting",
            "ein": "61-2345678",
            "partner_names": "John Smith (60%)\nRobert Chen (40%)",
            "formation_date": "2022-03-01",
        })

    # --- Sole Proprietorship ---
    items["sole_prop"] = make_item(db, org_id, user_id, org_key, "business", "sole_proprietorship",
        "Sarah Smith Photography", {
            "business_name": "Sarah Smith Photography",
            "ein": "55-8765432",
            "owner_name": "Sarah Anne Smith",
            "start_date": "2020-06-15",
        })

    # --- Business License ---
    items["biz_license"] = make_item(db, org_id, user_id, org_key, "business", "business_license",
        "City Business License - Smith Digital", {
            "license_type": "General Business License",
            "license_number": "BL-2025-00891",
            "issuing_authority": "City of Los Angeles",
            "issue_date": "2025-01-01",
            "expiration_date": "2025-12-31",
        })

    items["biz_license_photo"] = make_item(db, org_id, user_id, org_key, "business", "business_license",
        "Home Occupation Permit - Sarah Smith Photography", {
            "license_type": "Home Occupation Permit",
            "license_number": "HOP-2024-04512",
            "issuing_authority": "City of Los Angeles - Planning Dept",
            "issue_date": "2024-06-01",
            "expiration_date": "2026-06-01",
        })

    # --- General Liability ---
    items["gl"] = make_item(db, org_id, user_id, org_key, "business", "general_liability",
        "Hiscox GL Policy - Smith Digital", {
            "provider": "Hiscox",
            "policy_number": "HSX-GL-2025-11234",
            "premium": "1200",
            "payment_frequency": "annual",
            "per_occurrence_limit": "$1,000,000",
            "aggregate_limit": "$2,000,000",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        })

    # --- Professional Liability ---
    items["prof_liability"] = make_item(db, org_id, user_id, org_key, "business", "professional_liability",
        "Hartford E&O Policy - Smith Digital", {
            "provider": "The Hartford",
            "policy_number": "HFD-PL-2025-67890",
            "premium": "1800",
            "payment_frequency": "annual",
            "coverage_basis": "claims_made",
            "retroactive_date": "2021-04-15",
            "per_claim_limit": "$1,000,000",
            "aggregate_limit": "$2,000,000",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        })

    # --- Workers Compensation ---
    items["workers_comp"] = make_item(db, org_id, user_id, org_key, "business", "workers_compensation",
        "Employers WC Policy - Smith Digital", {
            "provider": "Employers Insurance",
            "policy_number": "EMP-WC-2025-44321",
            "premium": "3200",
            "payment_frequency": "quarterly",
            "state": "California",
            "classification_code": "8810",
            "experience_mod_rate": "0.95",
            "number_of_employees": "4",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        })

    # --- Commercial Property ---
    items["comm_property"] = make_item(db, org_id, user_id, org_key, "business", "commercial_property",
        "Travelers Property Policy - Smith Digital", {
            "provider": "Travelers",
            "policy_number": "TRV-CP-2025-88901",
            "premium": "2800",
            "payment_frequency": "annual",
            "property_address": "456 Business Park Dr, Los Angeles, CA 90015",
            "building_value": "500000",
            "contents_value": "150000",
            "valuation_type": "replacement_cost",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        })

    # --- Commercial Auto ---
    items["comm_auto"] = make_item(db, org_id, user_id, org_key, "business", "commercial_auto",
        "Progressive Commercial Auto - Smith Digital", {
            "provider": "Progressive Commercial",
            "policy_number": "PRG-CA-2025-12567",
            "premium": "4200",
            "payment_frequency": "semi_annual",
            "number_of_vehicles": "2",
            "start_date": "2025-03-01",
            "end_date": "2026-03-01",
        })

    # --- Business Owners Policy (BOP) ---
    items["bop"] = make_item(db, org_id, user_id, org_key, "business", "bop",
        "Nationwide BOP - Sarah Smith Photography", {
            "provider": "Nationwide",
            "policy_number": "NW-BOP-2025-77654",
            "premium": "950",
            "payment_frequency": "annual",
            "property_address": "321 Studio Lane, Los Angeles, CA 90028",
            "property_limit": "$250,000",
            "liability_limit": "$1,000,000",
            "start_date": "2025-06-01",
            "end_date": "2026-06-01",
        })

    # --- Cyber Liability ---
    items["cyber"] = make_item(db, org_id, user_id, org_key, "business", "cyber_liability",
        "Coalition Cyber Policy - Smith Digital", {
            "provider": "Coalition",
            "policy_number": "COA-CY-2025-99012",
            "premium": "1500",
            "payment_frequency": "annual",
            "coverage_basis": "claims_made",
            "retroactive_date": "2022-01-01",
            "per_incident_limit": "$1,000,000",
            "aggregate_limit": "$2,000,000",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        })

    # --- Other Business Insurance ---
    items["other_biz_ins"] = make_item(db, org_id, user_id, org_key, "business", "other_business_insurance",
        "Chubb D&O Policy - Smith Holdings", {
            "insurance_type": "Directors & Officers Liability",
            "provider": "Chubb",
            "policy_number": "CHB-DO-2025-55678",
            "premium": "2200",
            "payment_frequency": "annual",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        })

    # --- Business Tax Documents ---
    items["biz_tax_2024"] = make_item(db, org_id, user_id, org_key, "business", "tax_document",
        "Smith Digital LLC - 2024 Tax Return", {
            "document_type": "Form 1120-S - S Corporation Return",
            "tax_year": "2024",
            "business_name": "Smith Digital LLC",
        })

    items["biz_tax_2023"] = make_item(db, org_id, user_id, org_key, "business", "tax_document",
        "Smith Digital LLC - 2023 Tax Return", {
            "document_type": "Form 1120-S - S Corporation Return",
            "tax_year": "2023",
            "business_name": "Smith Digital LLC",
        })

    return items


def create_security_code_items(db, org_id, user_id, org_key):
    """Create security_codes category items. Returns dict[name] -> Item."""
    items = {}

    items["google_codes"] = make_item(db, org_id, user_id, org_key, "security_codes", "backup_codes",
        "Google Account Backup Codes", {
            "service_name": "Google",
            "account": "john.smith@gmail.com",
            "codes": "1234 5678\n2345 6789\n3456 7890\n4567 8901\n5678 9012\n6789 0123\n7890 1234\n8901 2345\n9012 3456\n0123 4567",
            "total_codes": "10",
            "codes_remaining": "8",
            "date_generated": "2025-01-15",
        })

    items["github_codes"] = make_item(db, org_id, user_id, org_key, "security_codes", "backup_codes",
        "GitHub Recovery Codes", {
            "service_name": "GitHub",
            "account": "johnsmith-dev",
            "codes": "a1b2c-3d4e5\nf6g7h-8i9j0\nk1l2m-3n4o5\np6q7r-8s9t0\nu1v2w-3x4y5\nz6a7b-8c9d0\ne1f2g-3h4i5\nj6k7l-8m9n0",
            "total_codes": "8",
            "codes_remaining": "6",
            "date_generated": "2024-11-20",
        })

    items["chase_codes"] = make_item(db, org_id, user_id, org_key, "security_codes", "backup_codes",
        "Chase Bank Recovery Codes", {
            "service_name": "Chase Bank",
            "account": "john.smith@gmail.com",
            "codes": "847291\n613058\n295174\n738462\n501839",
            "total_codes": "5",
            "codes_remaining": "5",
            "date_generated": "2025-02-01",
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

    # --- Renters Insurance ---
    renters_rows = [
        ("personal_property", "Personal Property", "$50,000", "$500", None),
        ("personal_liability", "Personal Liability", "$100,000", None, None),
        ("medical_payments", "Medical Payments to Others", "$1,000", None, "Per person"),
        ("loss_of_use", "Loss of Use", "$15,000", None, "Additional living expenses"),
        ("water_backup", "Water Backup", "$10,000", "$250", "Endorsement"),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(renters_rows):
        db.add(CoverageRow(
            item_id=items["renters"].id, org_id=org_id,
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

    # --- Umbrella / Other Insurance ---
    umbrella_rows = [
        ("personal_liability", "Personal Liability", "$1,000,000", None, "Excess over underlying"),
        ("auto_liability", "Auto Liability (Excess)", "Included", None, "Over auto policy limits"),
        ("homeowners_liability", "Homeowners Liability (Excess)", "Included", None, "Over home policy limits"),
        ("uninsured_motorist", "Uninsured Motorist (Excess)", "$1,000,000", None, None),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(umbrella_rows):
        db.add(CoverageRow(
            item_id=items["umbrella"].id, org_id=org_id,
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

    # --- Professional Liability ---
    prof_rows = [
        ("per_claim", "Per Claim Limit", "$1,000,000", None, None),
        ("aggregate", "Annual Aggregate", "$2,000,000", None, None),
        ("defense_costs", "Defense Costs", "Outside limits", None, "Duty to defend"),
        ("cyber_supplement", "Cyber Incident Supplement", "$50,000", "$2,500", "Endorsement"),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(prof_rows):
        db.add(CoverageRow(
            item_id=items["prof_liability"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- Workers Compensation ---
    wc_rows = [
        ("part_a", "Workers Compensation (Part A)", "Statutory", None, "California statutory limits"),
        ("part_b_each", "Employers Liability - Each Accident", "$500,000", None, None),
        ("part_b_disease_employee", "Employers Liability - Disease (Employee)", "$500,000", None, None),
        ("part_b_disease_policy", "Employers Liability - Disease (Policy)", "$500,000", None, None),
        ("waiver_of_subrogation", "Waiver of Subrogation", "Included", None, "Blanket endorsement"),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(wc_rows):
        db.add(CoverageRow(
            item_id=items["workers_comp"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- Commercial Property ---
    cp_rows = [
        ("building", "Building Coverage", "$500,000", "$2,500", None),
        ("bpp", "Business Personal Property", "$150,000", "$2,500", None),
        ("business_income", "Business Income", "$100,000", "72-hour waiting", "12-month limit"),
        ("extra_expense", "Extra Expense", "$25,000", None, None),
        ("equipment_breakdown", "Equipment Breakdown", "$100,000", "$1,000", "Endorsement"),
        ("signs", "Outdoor Signs", "$10,000", "$500", None),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(cp_rows):
        db.add(CoverageRow(
            item_id=items["comm_property"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- Commercial Auto ---
    ca_rows = [
        ("liability_csl", "Bodily Injury & Property Damage", "$500,000 CSL", None, "Combined single limit"),
        ("uninsured_motorist", "Uninsured Motorist", "$500,000", None, None),
        ("collision", "Collision", "Actual Cash Value", "$1,000", None),
        ("comprehensive", "Comprehensive", "Actual Cash Value", "$500", None),
        ("hired_auto", "Hired Auto Liability", "$500,000", None, None),
        ("non_owned_auto", "Non-Owned Auto Liability", "$500,000", None, None),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(ca_rows):
        db.add(CoverageRow(
            item_id=items["comm_auto"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- BOP ---
    bop_rows = [
        ("property", "Business Property", "$250,000", "$1,000", None),
        ("general_liability", "General Liability", "$1,000,000", None, "Per occurrence"),
        ("aggregate", "General Aggregate", "$2,000,000", None, None),
        ("business_income", "Business Income", "$50,000", None, "12-month limit"),
        ("equipment_breakdown", "Equipment Breakdown", "$50,000", "$500", "Endorsement"),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(bop_rows):
        db.add(CoverageRow(
            item_id=items["bop"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- Cyber Liability ---
    cyber_rows = [
        ("data_breach", "Data Breach Response", "$1,000,000", "$5,000", "Notification & credit monitoring"),
        ("network_security", "Network Security Liability", "$1,000,000", "$5,000", None),
        ("privacy_liability", "Privacy Liability", "$1,000,000", "$5,000", None),
        ("business_interruption", "Business Interruption", "$500,000", "8-hour waiting", None),
        ("cyber_extortion", "Cyber Extortion / Ransomware", "$500,000", "$5,000", None),
        ("social_engineering", "Social Engineering Fraud", "$100,000", "$5,000", "Sublimit"),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(cyber_rows):
        db.add(CoverageRow(
            item_id=items["cyber"].id, org_id=org_id,
            service_key=key, service_label=label, sort_order=i,
            coverage_limit=limit, deductible=ded, notes=notes,
        ))

    # --- D&O / Other Business Insurance ---
    do_rows = [
        ("side_a", "Side A - Direct D&O", "$1,000,000", None, "Non-indemnifiable loss"),
        ("side_b", "Side B - Corporate Reimbursement", "$1,000,000", "$15,000", None),
        ("side_c", "Side C - Entity Coverage", "$1,000,000", "$25,000", "Securities claims"),
        ("defense_costs", "Defense Costs", "Outside limits", None, None),
    ]
    for i, (key, label, limit, ded, notes) in enumerate(do_rows):
        db.add(CoverageRow(
            item_id=items["other_biz_ins"].id, org_id=org_id,
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
        # Renters
        (items["renters"].id, "Customer Service", "1-844-733-8666", "phone", 0),
        (items["renters"].id, "App / Portal", "https://www.lemonade.com", "url", 1),
        # Life
        (items["life"].id, "Policy Services", "1-866-950-4644", "phone", 0),
        # Umbrella
        (items["umbrella"].id, "Customer Service", "1-800-531-8722", "phone", 0),
        (items["umbrella"].id, "Online Portal", "https://www.usaa.com", "url", 1),
        # General Liability
        (items["gl"].id, "Customer Service", "1-866-424-7269", "phone", 0),
        (items["gl"].id, "Claims Portal", "https://www.hiscox.com/claims", "url", 1),
        # Professional Liability
        (items["prof_liability"].id, "Customer Service", "1-800-523-5065", "phone", 0),
        (items["prof_liability"].id, "Claims", "1-800-327-3636", "phone", 1),
        # Workers Comp
        (items["workers_comp"].id, "Claims Hotline", "1-888-682-6671", "phone", 0),
        # Commercial Property
        (items["comm_property"].id, "Customer Service", "1-800-252-4633", "phone", 0),
        (items["comm_property"].id, "Claims", "1-800-238-6225", "phone", 1),
        # Commercial Auto
        (items["comm_auto"].id, "Commercial Lines", "1-800-776-4737", "phone", 0),
        # BOP
        (items["bop"].id, "Customer Service", "1-877-669-6877", "phone", 0),
        # Cyber Liability
        (items["cyber"].id, "Incident Response", "1-833-866-1337", "phone", 0),
        (items["cyber"].id, "Claims Portal", "https://claims.coalitioninc.com", "url", 1),
        # D&O
        (items["other_biz_ins"].id, "Customer Service", "1-800-252-4670", "phone", 0),
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
    reminders = [
        (all_items["john_dl"].id, "Renew driver's license", date(2028, 2, 15), "none",
         "Schedule DMV appointment 2 months before expiration"),
        (all_items["sarah_dl"].id, "Renew driver's license", date(2027, 6, 20), "none",
         "Schedule DMV appointment"),
        (all_items["john_visa"].id, "Renew UK business visa", date(2026, 4, 15), "none",
         "Start renewal application 2 months before expiry"),
        (all_items["john_global_entry"].id, "Renew Global Entry", date(2028, 9, 1), "none",
         "Can renew up to 1 year before expiration"),
        (all_items["auto"].id, "Review auto policy rates", date(2026, 5, 1), "yearly",
         "Compare rates before renewal"),
        (all_items["home"].id, "Renew home insurance", date(2026, 2, 1), "yearly",
         "Review coverage amounts before renewal"),
        (all_items["biz_license"].id, "Renew business license", date(2025, 11, 15), "yearly",
         "Submit renewal application by mid-November"),
        (all_items["tax_2024"].id, "File 2025 taxes", date(2026, 3, 15), "none",
         "Gather W-2s and 1099s, schedule with Robert Chen"),
        (all_items["biz_tax_2024"].id, "File 2025 S-Corp return", date(2026, 2, 15), "none",
         "S-Corp deadline is March 15 - file Form 1120-S"),
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
        # IDs
        (all_items["john_dl"].id, people["John"].id, "Owner"),
        (all_items["sarah_dl"].id, people["Sarah"].id, "Owner"),
        (all_items["john_passport"].id, people["John"].id, "Owner"),
        (all_items["sarah_passport"].id, people["Sarah"].id, "Owner"),
        (all_items["john_visa"].id, people["John"].id, "Owner"),
        (all_items["john_ssn"].id, people["John"].id, "Owner"),
        (all_items["sarah_ssn"].id, people["Sarah"].id, "Owner"),
        (all_items["emma_bc"].id, people["Emma"].id, "Owner"),
        (all_items["liam_bc"].id, people["Liam"].id, "Owner"),
        (all_items["john_global_entry"].id, people["John"].id, "Owner"),
        (all_items["sarah_costco"].id, people["Sarah"].id, "Owner"),
        # Tax docs
        (all_items["tax_2024"].id, people["John"].id, "Filer"),
        (all_items["tax_2024"].id, people["Sarah"].id, "Filer"),
        (all_items["tax_2023"].id, people["John"].id, "Filer"),
        (all_items["tax_2023"].id, people["Sarah"].id, "Filer"),
        # Insurance
        (all_items["health"].id, people["John"].id, "Primary"),
        (all_items["health"].id, people["Sarah"].id, "Spouse"),
        (all_items["health"].id, people["Emma"].id, "Dependent"),
        (all_items["health"].id, people["Liam"].id, "Dependent"),
        (all_items["life"].id, people["John"].id, "Insured"),
        (all_items["life"].id, people["Sarah"].id, "Beneficiary"),
        (all_items["auto"].id, people["John"].id, "Primary Driver"),
        (all_items["auto"].id, people["Sarah"].id, "Secondary Driver"),
        (all_items["umbrella"].id, people["John"].id, "Named Insured"),
        (all_items["umbrella"].id, people["Sarah"].id, "Named Insured"),
        # Business
        (all_items["llc"].id, people["John"].id, "Owner"),
        (all_items["corp"].id, people["John"].id, "Director"),
        (all_items["partnership"].id, people["John"].id, "Partner"),
        (all_items["sole_prop"].id, people["Sarah"].id, "Owner"),
        # Security codes
        (all_items["google_codes"].id, people["John"].id, "Owner"),
        (all_items["github_codes"].id, people["John"].id, "Owner"),
        (all_items["chase_codes"].id, people["John"].id, "Owner"),
    ]
    for item_id, person_id, role in links:
        db.add(ItemPerson(item_id=item_id, person_id=person_id, role=role, org_id=org_id))
    db.flush()


def create_item_vehicles(db, org_id, all_items, vehicles):
    """Link vehicles to auto insurance."""
    for v in vehicles.values():
        db.add(ItemVehicle(item_id=all_items["auto"].id, vehicle_id=v.id, org_id=org_id))
        db.add(ItemVehicle(item_id=all_items["comm_auto"].id, vehicle_id=v.id, org_id=org_id))
    db.flush()


def create_item_links(db, org_id, biz_items):
    """Link business documents to their parent entities."""
    # LLC links
    llc_children = ["biz_license", "gl", "prof_liability", "workers_comp",
                     "comm_property", "comm_auto", "cyber", "biz_tax_2024", "biz_tax_2023"]
    for child_key in llc_children:
        link_type = "business_insurance" if child_key not in ("biz_license", "biz_tax_2024", "biz_tax_2023") else (
            "business_license" if child_key == "biz_license" else "tax_document"
        )
        db.add(ItemLink(
            parent_item_id=biz_items["llc"].id,
            child_item_id=biz_items[child_key].id,
            link_type=link_type,
            org_id=org_id,
        ))

    # Corporation links
    db.add(ItemLink(
        parent_item_id=biz_items["corp"].id,
        child_item_id=biz_items["other_biz_ins"].id,
        link_type="business_insurance",
        org_id=org_id,
    ))

    # Sole proprietorship links
    sole_prop_children = ["biz_license_photo", "bop"]
    for child_key in sole_prop_children:
        link_type = "business_license" if child_key == "biz_license_photo" else "business_insurance"
        db.add(ItemLink(
            parent_item_id=biz_items["sole_prop"].id,
            child_item_id=biz_items[child_key].id,
            link_type=link_type,
            org_id=org_id,
        ))

    db.flush()


def create_item_saved_contacts(db, org_id, all_items, saved_contacts):
    """Link saved contacts to items."""
    links = [
        (all_items["llc"].id, saved_contacts["Robert Chen"].id),
        (all_items["llc"].id, saved_contacts["Maria Rodriguez"].id),
        (all_items["corp"].id, saved_contacts["Maria Rodriguez"].id),
        (all_items["partnership"].id, saved_contacts["Robert Chen"].id),
        (all_items["life"].id, saved_contacts["David Park"].id),
        (all_items["tax_2024"].id, saved_contacts["Robert Chen"].id),
        (all_items["biz_tax_2024"].id, saved_contacts["Robert Chen"].id),
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

        print("[1/9] Cleaning database...")
        delete_all_data(db)

        print("[2/9] Creating user and organization...")
        user, org, org_key = create_user_and_org(db)

        print("[3/9] Creating family members...")
        people = create_people(db, org.id, user)

        print("[4/9] Creating vehicles...")
        vehicles = create_vehicles(db, org.id, people)

        print("[5/9] Creating saved contacts...")
        saved_contacts = create_saved_contacts(db, org.id)

        print("[6/9] Creating items...")
        id_items = create_id_items(db, org.id, user.id, org_key)
        ins_items = create_insurance_items(db, org.id, user.id, org_key)
        biz_items = create_business_items(db, org.id, user.id, org_key)
        sec_items = create_security_code_items(db, org.id, user.id, org_key)
        all_items = {**id_items, **ins_items, **biz_items, **sec_items}

        print("[7/9] Creating coverage data...")
        create_coverage(db, org.id, {**ins_items, **biz_items})

        print("[8/9] Creating relationships...")
        create_item_contacts(db, org.id, all_items)
        create_reminders(db, org.id, user.id, all_items)
        create_item_people(db, org.id, all_items, people)
        create_item_vehicles(db, org.id, all_items, vehicles)
        create_item_links(db, org.id, biz_items)
        create_item_saved_contacts(db, org.id, all_items, saved_contacts)

        print("[9/9] Committing...")
        db.commit()

        print()
        print("=" * 60)
        print("Demo data seeded successfully!")
        print()
        print(f"  Login:  demo@familyvault.local / demo1234")
        print(f"  Org:    {org.name}")
        print(f"  Items:  {len(all_items)} created")
        print(f"  People: {len(people)} family members")
        print(f"  Categories covered: ids, insurance, business, security_codes")
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
