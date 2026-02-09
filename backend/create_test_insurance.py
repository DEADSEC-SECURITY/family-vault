import requests
import json

BASE_URL = "http://localhost:8000/api"

# Login
login_resp = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "demo@familyvault.local",
    "password": "demo1234"
})
token = login_resp.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# Test data for different insurance types
test_insurance = [
    {
        "name": "Personal Auto Policy",
        "category": "insurance",
        "subcategory": "auto_insurance",
        "fields": [
            {"field_key": "provider", "field_value": "Progressive", "field_type": "provider"},
            {"field_key": "policy_number", "field_value": "PRO-2024-889456", "field_type": "text"},
            {"field_key": "start_date", "field_value": "2024-01-01", "field_type": "date"},
            {"field_key": "end_date", "field_value": "2024-12-31", "field_type": "date"},
            {"field_key": "premium", "field_value": "1850.00", "field_type": "number"},
            {"field_key": "deductible", "field_value": "500.00", "field_type": "number"},
            {"field_key": "coverage_type", "field_value": "Full Coverage", "field_type": "text"},
        ]
    },
    {
        "name": "Family Health Plan",
        "category": "insurance",
        "subcategory": "health_insurance",
        "fields": [
            {"field_key": "provider", "field_value": "Blue Cross Blue Shield", "field_type": "provider"},
            {"field_key": "policy_number", "field_value": "BCBS-FAM-2024-12345", "field_type": "text"},
            {"field_key": "group_number", "field_value": "GRP-789456", "field_type": "text"},
            {"field_key": "start_date", "field_value": "2024-01-01", "field_type": "date"},
            {"field_key": "end_date", "field_value": "2024-12-31", "field_type": "date"},
            {"field_key": "plan_type", "field_value": "PPO", "field_type": "text"},
            {"field_key": "premium", "field_value": "4500.00", "field_type": "number"},
            {"field_key": "deductible", "field_value": "3000.00", "field_type": "number"},
            {"field_key": "copay", "field_value": "30.00", "field_type": "number"},
        ]
    },
    {
        "name": "Homeowners Coverage",
        "category": "insurance",
        "subcategory": "home_insurance",
        "fields": [
            {"field_key": "provider", "field_value": "State Farm", "field_type": "provider"},
            {"field_key": "policy_number", "field_value": "SF-HOME-2024-67890", "field_type": "text"},
            {"field_key": "start_date", "field_value": "2024-03-15", "field_type": "date"},
            {"field_key": "end_date", "field_value": "2025-03-15", "field_type": "date"},
            {"field_key": "property_address", "field_value": "1234 Maple Street, Springfield, IL 62701", "field_type": "textarea"},
            {"field_key": "coverage_amount", "field_value": "350000.00", "field_type": "number"},
            {"field_key": "premium", "field_value": "2400.00", "field_type": "number"},
            {"field_key": "deductible", "field_value": "1500.00", "field_type": "number"},
        ]
    },
    {
        "name": "Downtown Apartment",
        "category": "insurance",
        "subcategory": "renters_insurance",
        "fields": [
            {"field_key": "provider", "field_value": "GEICO", "field_type": "provider"},
            {"field_key": "policy_number", "field_value": "GEI-RENT-2024-44556", "field_type": "text"},
            {"field_key": "start_date", "field_value": "2024-06-01", "field_type": "date"},
            {"field_key": "end_date", "field_value": "2025-06-01", "field_type": "date"},
            {"field_key": "property_address", "field_value": "789 Oak Avenue, Unit 4B, Chicago, IL 60614", "field_type": "textarea"},
            {"field_key": "coverage_amount", "field_value": "50000.00", "field_type": "number"},
            {"field_key": "premium", "field_value": "240.00", "field_type": "number"},
            {"field_key": "deductible", "field_value": "500.00", "field_type": "number"},
        ]
    },
    {
        "name": "Term Life Policy",
        "category": "insurance",
        "subcategory": "life_insurance",
        "fields": [
            {"field_key": "provider", "field_value": "Northwestern Mutual", "field_type": "provider"},
            {"field_key": "policy_number", "field_value": "NWM-LIFE-2024-98765", "field_type": "text"},
            {"field_key": "start_date", "field_value": "2024-02-01", "field_type": "date"},
            {"field_key": "coverage_amount", "field_value": "500000.00", "field_type": "number"},
            {"field_key": "premium", "field_value": "850.00", "field_type": "number"},
            {"field_key": "policy_type", "field_value": "20-Year Term", "field_type": "text"},
            {"field_key": "beneficiaries", "field_value": "Jane Doe (Spouse), John Doe Jr. (Son)", "field_type": "textarea"},
        ]
    },
    {
        "name": "Secondary Auto (Expired)",
        "category": "insurance",
        "subcategory": "auto_insurance",
        "is_archived": True,
        "fields": [
            {"field_key": "provider", "field_value": "Allstate Corp.", "field_type": "provider"},
            {"field_key": "policy_number", "field_value": "ALL-2023-445566", "field_type": "text"},
            {"field_key": "start_date", "field_value": "2023-01-01", "field_type": "date"},
            {"field_key": "end_date", "field_value": "2023-12-31", "field_type": "date"},
            {"field_key": "premium", "field_value": "1200.00", "field_type": "number"},
            {"field_key": "deductible", "field_value": "1000.00", "field_type": "number"},
        ]
    },
]

# Create test insurance items
print("Creating test insurance items...")
for insurance in test_insurance:
    resp = requests.post(f"{BASE_URL}/items", headers=headers, json=insurance)
    if resp.status_code == 201:
        print(f"  Created: {insurance['name']} ({insurance['subcategory']})")
    else:
        print(f"  Failed: {insurance['name']} - {resp.text}")

print("\nDone! Refresh the insurance page to see the test data.")
