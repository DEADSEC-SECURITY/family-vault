from fastapi import APIRouter, HTTPException, Query

from app.providers.data import INSURANCE_PROVIDERS, PROVIDER_DETAILS

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("/insurance")
def list_insurance_providers(q: str = Query(default="", max_length=100)):
    """
    Return insurance providers, optionally filtered by search query.
    """
    if q:
        q_lower = q.lower()
        results = [p for p in INSURANCE_PROVIDERS if q_lower in p.lower()]
    else:
        results = INSURANCE_PROVIDERS

    return {"providers": results}


@router.get("/insurance/{name}/details")
def get_provider_details(name: str):
    """
    Return contact details for a specific provider (portal URL, claims
    address, phone numbers).  Returns empty details for unknown providers.
    """
    details = PROVIDER_DETAILS.get(name, {})
    return {
        "name": name,
        "portal_url": details.get("portal_url"),
        "claims_address": details.get("claims_address"),
        "contacts": details.get("contacts", []),
    }
