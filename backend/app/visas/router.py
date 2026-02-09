"""Visa types API endpoints."""
from fastapi import APIRouter

from .data import get_all_countries, get_visa_contacts, get_visa_types

router = APIRouter(prefix="/api/visas", tags=["visas"])


@router.get("/countries")
def list_countries():
    """Get list of all countries with visa type data."""
    return {"countries": get_all_countries()}


@router.get("/types/{country}")
def list_visa_types(country: str):
    """Get visa types for a specific country."""
    visa_types = get_visa_types(country)
    return {"country": country, "visa_types": visa_types}


@router.get("/contacts/{country}")
def list_visa_contacts(country: str):
    """Get default visa contact information for a specific country."""
    contacts = get_visa_contacts(country)
    return {"country": country, "contacts": contacts}
