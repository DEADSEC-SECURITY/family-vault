"""
Seed script to create dummy business data for demo purposes.
Run with: python seed_business_data.py
"""
import requests
import sys
from datetime import datetime, timedelta

API_BASE = "http://localhost:8000/api"

# Demo user credentials
DEMO_EMAIL = "demo@familyvault.local"
DEMO_PASSWORD = "demo1234"


def login():
    """Login and get session token."""
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        sys.exit(1)
    return response.json()["token"]


def create_item(token, category, subcategory, name, fields, notes=None):
    """Create an item via API."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "category": category,
        "subcategory": subcategory,
        "name": name,
        "fields": [{"field_key": k, "field_value": v} for k, v in fields.items()],
        "notes": notes
    }
    response = requests.post(f"{API_BASE}/items", json=payload, headers=headers)
    if response.status_code == 201:
        print(f"[OK] Created: {name}")
        return response.json()
    else:
        print(f"[FAIL] Failed to create {name}: {response.text}")
        return None


def main():
    print("Seeding business data...")
    token = login()
    print(f"Logged in as {DEMO_EMAIL}\n")

    # 1. LLC - Tech Consulting Company
    create_item(
        token,
        "business",
        "llc",
        "Smith Consulting LLC",
        {
            "business_name": "Smith Consulting LLC",
            "ein": "12-3456789",
            "formation_date": "2020-03-15",
            "state_of_formation": "Delaware",
            "registered_agent": "CT Corporation",
        },
        notes="Primary consulting business. Delaware formation for tax benefits. Annual report due March 1st each year."
    )

    # 2. LLC - Real Estate Holdings
    create_item(
        token,
        "business",
        "llc",
        "Maple Street Properties LLC",
        {
            "business_name": "Maple Street Properties LLC",
            "ein": "45-6789012",
            "formation_date": "2019-08-22",
            "state_of_formation": "Nevada",
            "registered_agent": "John Smith",
        },
        notes="Holds rental properties at 123 Maple St and 456 Oak Ave. Nevada formation for asset protection."
    )

    # 3. Corporation - Software Company
    create_item(
        token,
        "business",
        "corporation",
        "TechVentures Inc.",
        {
            "business_name": "TechVentures Inc.",
            "ein": "98-7654321",
            "formation_date": "2018-06-01",
            "state_of_incorporation": "Delaware",
            "registered_agent": "Incfile",
        },
        notes="C-Corporation. Raised Series A funding in 2022. Board meets quarterly."
    )

    # 4. Corporation - Small Business
    create_item(
        token,
        "business",
        "corporation",
        "Green Valley Coffee Co.",
        {
            "business_name": "Green Valley Coffee Company",
            "ein": "23-4567890",
            "formation_date": "2015-01-10",
            "state_of_incorporation": "California",
            "registered_agent": "Jane Doe",
        },
        notes="S-Corporation election filed. Local coffee roastery with 3 retail locations."
    )

    # 5. Partnership
    create_item(
        token,
        "business",
        "partnership",
        "Johnson & Associates LLP",
        {
            "business_name": "Johnson & Associates LLP",
            "ein": "34-5678901",
            "partner_names": "Michael Johnson (60%)\nSarah Williams (40%)",
            "formation_date": "2017-04-15",
        },
        notes="Law firm partnership. Operating agreement specifies profit-sharing ratios."
    )

    # 6. Sole Proprietorship
    create_item(
        token,
        "business",
        "sole_proprietorship",
        "Jane's Photography",
        {
            "business_name": "Jane's Photography",
            "ein": "56-7890123",
            "owner_name": "Jane Smith",
            "start_date": "2021-01-01",
        },
        notes="Freelance photography business. Using personal SSN, but applied for EIN for business banking."
    )

    # 7. General Business License
    create_item(
        token,
        "business",
        "business_license",
        "City Business License - Smith Consulting",
        {
            "license_type": "General Business License",
            "license_number": "BL-2024-00789",
            "issuing_authority": "City of San Francisco",
            "issue_date": "2024-01-01",
            "expiration_date": "2024-12-31",
        },
        notes="Annual renewal required. Fee: $250. Must display at business location."
    )

    # 8. Professional License
    create_item(
        token,
        "business",
        "business_license",
        "Real Estate Broker License",
        {
            "license_type": "Real Estate Broker License",
            "license_number": "BRE-01234567",
            "issuing_authority": "California Department of Real Estate",
            "issue_date": "2019-03-15",
            "expiration_date": "2027-03-14",
        },
        notes="4-year renewal cycle. 45 hours continuing education required for renewal."
    )

    # 9. Contractor's License
    create_item(
        token,
        "business",
        "business_license",
        "General Contractor License",
        {
            "license_type": "Contractor's License",
            "license_number": "GC-987654",
            "issuing_authority": "California Contractors State License Board",
            "issue_date": "2020-07-01",
            "expiration_date": "2026-06-30",
        },
        notes="Class B General Building Contractor. Bond required: $15,000. Insurance: $1M liability."
    )

    # 10. Sales Tax Permit
    create_item(
        token,
        "business",
        "business_license",
        "Sales Tax Permit - Coffee Shop",
        {
            "license_type": "Sales Tax Permit",
            "license_number": "ST-456789012",
            "issuing_authority": "California Department of Tax and Fee Administration",
            "issue_date": "2015-02-01",
            "expiration_date": "2099-12-31",
        },
        notes="Required for retail sales. File quarterly returns. Rate varies by location (base 7.25% + local)."
    )

    # 11. Health Permit
    create_item(
        token,
        "business",
        "business_license",
        "Food Service Permit - Coffee Shop",
        {
            "license_type": "Health Department Permit",
            "license_number": "FP-2024-5678",
            "issuing_authority": "San Francisco Department of Public Health",
            "issue_date": "2024-01-15",
            "expiration_date": "2026-01-14",
        },
        notes="Required for food service. Annual inspection. Score: 98/100 (Grade A)."
    )

    # 12. Business Insurance - General Liability
    create_item(
        token,
        "business",
        "business_insurance",
        "General Liability - Smith Consulting",
        {
            "provider": "State Farm",
            "policy_number": "GL-789012345",
            "coverage_type": "General Liability",
            "premium": "1200",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        },
        notes="$1M per occurrence, $2M aggregate. Covers professional consulting services."
    )

    # 13. Business Insurance - Workers Comp
    create_item(
        token,
        "business",
        "business_insurance",
        "Workers' Compensation - TechVentures",
        {
            "provider": "Liberty Mutual",
            "policy_number": "WC-456789012",
            "coverage_type": "Workers' Compensation",
            "premium": "8500",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        },
        notes="Covers 12 employees. Rate based on payroll and job classifications."
    )

    # 14. Business Insurance - Professional Liability
    create_item(
        token,
        "business",
        "business_insurance",
        "E&O Insurance - Law Firm",
        {
            "provider": "Chubb",
            "policy_number": "EO-123456789",
            "coverage_type": "Professional Liability (E&O)",
            "premium": "15000",
            "start_date": "2025-01-01",
            "end_date": "2026-01-01",
        },
        notes="$2M coverage. Covers errors and omissions in legal services. Claims-made policy."
    )

    # 15. Tax Document - LLC Tax Return (1065)
    create_item(
        token,
        "business",
        "tax_document",
        "2024 Partnership Return - Smith Consulting",
        {
            "document_type": "Form 1065 - Partnership Return",
            "tax_year": "2024",
            "business_name": "Smith Consulting LLC",
        },
        notes="Filed March 15, 2025. Extension requested. All K-1s distributed to members."
    )

    # 16. Tax Document - Corporate Return (1120)
    create_item(
        token,
        "business",
        "tax_document",
        "2024 Corporate Return - TechVentures",
        {
            "document_type": "Form 1120 - C-Corp Tax Return",
            "tax_year": "2024",
            "business_name": "TechVentures Inc.",
        },
        notes="Filed April 15, 2025. Taxable income: $450,000. Federal tax paid: $94,500."
    )

    # 17. Tax Document - S-Corp Return (1120-S)
    create_item(
        token,
        "business",
        "tax_document",
        "2024 S-Corp Return - Green Valley Coffee",
        {
            "document_type": "Form 1120-S - S-Corp Tax Return",
            "tax_year": "2024",
            "business_name": "Green Valley Coffee Company",
        },
        notes="Filed March 15, 2025. Pass-through income: $180,000. No corporate-level tax."
    )

    # 18. Tax Document - Schedule C
    create_item(
        token,
        "business",
        "tax_document",
        "2024 Schedule C - Jane's Photography",
        {
            "document_type": "Schedule C - Sole Proprietorship",
            "tax_year": "2024",
            "business_name": "Jane's Photography",
        },
        notes="Filed with personal 1040. Gross receipts: $75,000. Net profit: $42,000."
    )

    # 19. Tax Document - Quarterly Payroll (941)
    create_item(
        token,
        "business",
        "tax_document",
        "Q4 2024 Payroll Tax Return",
        {
            "document_type": "Form 941 - Quarterly Payroll Tax",
            "tax_year": "2024",
            "business_name": "TechVentures Inc.",
        },
        notes="Q4 2024 (Oct-Dec). Filed January 31, 2025. 12 employees. Taxes deposited monthly."
    )

    # 20. Tax Document - W-2s
    create_item(
        token,
        "business",
        "tax_document",
        "2024 W-2 Forms - All Employees",
        {
            "document_type": "W-2 Forms",
            "tax_year": "2024",
            "business_name": "TechVentures Inc.",
        },
        notes="Issued to 12 employees. Filed with SSA by January 31, 2025. Total wages: $1,200,000."
    )

    # 21. Tax Document - 1099s
    create_item(
        token,
        "business",
        "tax_document",
        "2024 1099-NEC Forms - Contractors",
        {
            "document_type": "1099 Forms",
            "tax_year": "2024",
            "business_name": "Smith Consulting LLC",
        },
        notes="Issued to 5 independent contractors. Filed by January 31, 2025. Total: $185,000."
    )

    # 22. Tax Document - State Tax Return
    create_item(
        token,
        "business",
        "tax_document",
        "2024 California Franchise Tax Return",
        {
            "document_type": "State Tax Return",
            "tax_year": "2024",
            "business_name": "Green Valley Coffee Company",
        },
        notes="Form 100S. Filed March 15, 2025. Minimum franchise tax: $800 (S-corp)."
    )

    # 23. Tax Document - Sales Tax Return
    create_item(
        token,
        "business",
        "tax_document",
        "Q4 2024 Sales Tax Return",
        {
            "document_type": "Sales Tax Return",
            "tax_year": "2024",
            "business_name": "Green Valley Coffee Company",
        },
        notes="Q4 2024. Gross sales: $245,000. Tax collected: $18,375 (7.5%). Filed January 31, 2025."
    )

    print("\n[SUCCESS] Seed data created successfully!")
    print("\nCreated items:")
    print("  - 6 Business Entities (LLCs, Corps, Partnership, Sole Prop)")
    print("  - 5 Business Licenses (General, Professional, Contractor, Sales Tax, Health)")
    print("  - 3 Business Insurance Policies (General Liability, Workers Comp, E&O)")
    print("  - 9 Tax Documents (Various returns and forms)")
    print("\nTotal: 23 business items")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nAborted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n[ERROR] {e}")
        sys.exit(1)
