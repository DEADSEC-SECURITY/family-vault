"""Visa types database organized by country."""

# Comprehensive visa types by country
VISA_TYPES_BY_COUNTRY = {
    "United States": [
        "Tourist (B-2)",
        "Business (B-1)",
        "Student (F-1)",
        "Exchange Visitor (J-1)",
        "Temporary Worker (H-1B)",
        "Temporary Worker (H-2A)",
        "Temporary Worker (H-2B)",
        "Intracompany Transferee (L-1)",
        "Treaty Trader/Investor (E-1/E-2)",
        "Specialty Occupation (O-1)",
        "Fiancé(e) (K-1)",
        "Transit (C-1)",
    ],
    "United Kingdom": [
        "Standard Visitor",
        "Business Visitor",
        "Student Visa",
        "Skilled Worker",
        "Graduate Route",
        "Global Talent",
        "Family Visa",
        "Transit Visa",
    ],
    "Canada": [
        "Visitor Visa (Temporary Resident)",
        "Study Permit",
        "Work Permit",
        "Working Holiday",
        "Super Visa",
        "Transit Visa",
    ],
    "Schengen Area": [
        "Tourist (Type C)",
        "Business (Type C)",
        "Student/Training (Type D)",
        "Airport Transit (Type A)",
        "Transit (Type B)",
    ],
    "Australia": [
        "Visitor (600)",
        "Working Holiday (417)",
        "Student (500)",
        "Skilled Worker (482/189/190)",
        "Business Innovation (188)",
        "Transit (771)",
    ],
    "China": [
        "Tourist (L)",
        "Business (M)",
        "Work (Z)",
        "Student (X1/X2)",
        "Transit (G)",
        "Journalist (J1/J2)",
        "Family Visit (Q1/Q2)",
    ],
    "Japan": [
        "Tourist",
        "Business",
        "Student",
        "Work",
        "Working Holiday",
        "Transit",
    ],
    "India": [
        "e-Tourist Visa",
        "e-Business Visa",
        "Employment Visa",
        "Student Visa",
        "Medical Visa",
        "Conference Visa",
        "Transit Visa",
    ],
    "Germany": [
        "Schengen Visa (C)",
        "National Visa (D)",
        "Student Visa",
        "Job Seeker Visa",
        "EU Blue Card",
    ],
    "France": [
        "Short Stay Schengen (C)",
        "Long Stay (D)",
        "Student",
        "Work",
        "Family Reunification",
    ],
    "Spain": [
        "Tourist Schengen",
        "Student Visa",
        "Work Visa",
        "Non-Lucrative Residence",
        "Golden Visa",
    ],
    "Italy": [
        "Schengen Tourist",
        "Student Visa",
        "Work Visa",
        "Family Reunification",
    ],
    "Netherlands": [
        "Schengen Visa",
        "MVV (Long Stay)",
        "Highly Skilled Migrant",
        "Student",
    ],
    "South Korea": [
        "Tourist (C-3)",
        "Business (C-3-4)",
        "Student (D-2)",
        "Work (E-1 to E-7)",
        "Working Holiday (H-1)",
    ],
    "Singapore": [
        "Tourist",
        "Business",
        "Student Pass",
        "Employment Pass",
        "Work Permit",
        "Transit",
    ],
    "United Arab Emirates": [
        "Tourist Visa",
        "Visit Visa",
        "Transit Visa",
        "Employment Visa",
        "Investor Visa",
        "Golden Visa",
    ],
    "Brazil": [
        "Tourist (VITUR)",
        "Business (VITEM)",
        "Temporary Work (VITEM V)",
        "Student (VITEM IV)",
    ],
    "Mexico": [
        "Tourist",
        "Business",
        "Temporary Resident",
        "Student",
        "Work",
    ],
    "Thailand": [
        "Tourist Visa",
        "Non-Immigrant Visa (B, O, ED)",
        "Transit Visa",
    ],
    "Russia": [
        "Tourist",
        "Business",
        "Student",
        "Work",
        "Transit",
    ],
    "Turkey": [
        "e-Visa Tourist",
        "Business Visa",
        "Student Visa",
        "Work Permit",
    ],
    "South Africa": [
        "Visitor Visa",
        "Business Visa",
        "Study Visa",
        "Work Visa",
        "Transit Visa",
    ],
    "New Zealand": [
        "Visitor Visa",
        "Student Visa",
        "Work Visa",
        "Working Holiday Visa",
    ],
    "Switzerland": [
        "Schengen Visa (C)",
        "National Visa (D)",
        "Work Permit",
        "Student Visa",
    ],
}

# Visa contact information by country (embassy/consulate help contacts)
VISA_CONTACTS_BY_COUNTRY = {
    "United States": [
        {
            "label": "U.S. Department of State - Visa Services",
            "contact_type": "website",
            "value": "https://travel.state.gov/content/travel/en/us-visas.html",
        },
        {
            "label": "National Visa Center",
            "contact_type": "phone",
            "value": "+1-603-334-0700",
        },
        {
            "label": "Visa Inquiry Email",
            "contact_type": "email",
            "value": "support-usa@ustraveldocs.com",
        },
    ],
    "United Kingdom": [
        {
            "label": "UK Visas and Immigration",
            "contact_type": "website",
            "value": "https://www.gov.uk/browse/visas-immigration",
        },
        {
            "label": "UKVI Contact Centre",
            "contact_type": "phone",
            "value": "+44-300-123-2241",
        },
    ],
    "Canada": [
        {
            "label": "Immigration, Refugees and Citizenship Canada (IRCC)",
            "contact_type": "website",
            "value": "https://www.canada.ca/en/immigration-refugees-citizenship.html",
        },
        {
            "label": "IRCC Call Centre",
            "contact_type": "phone",
            "value": "+1-888-242-2100",
        },
    ],
    "Schengen Area": [
        {
            "label": "Schengen Visa Info",
            "contact_type": "website",
            "value": "https://www.schengenvisainfo.com",
        },
    ],
    "Australia": [
        {
            "label": "Department of Home Affairs - Visa Services",
            "contact_type": "website",
            "value": "https://immi.homeaffairs.gov.au/visas",
        },
        {
            "label": "Immigration Contact Centre",
            "contact_type": "phone",
            "value": "+61-2-6196-0196",
        },
    ],
    "Germany": [
        {
            "label": "German Federal Foreign Office - Visa",
            "contact_type": "website",
            "value": "https://www.auswaertiges-amt.de/en/visa-service",
        },
    ],
    "France": [
        {
            "label": "France-Visas Official Portal",
            "contact_type": "website",
            "value": "https://france-visas.gouv.fr/en",
        },
    ],
    "Japan": [
        {
            "label": "Ministry of Foreign Affairs - Visa",
            "contact_type": "website",
            "value": "https://www.mofa.go.jp/j_info/visit/visa/index.html",
        },
    ],
    "China": [
        {
            "label": "China Visa Application Service Center",
            "contact_type": "website",
            "value": "http://www.visaforchina.org",
        },
    ],
    "India": [
        {
            "label": "Indian Visa Online",
            "contact_type": "website",
            "value": "https://indianvisaonline.gov.in",
        },
    ],
    "Singapore": [
        {
            "label": "Immigration & Checkpoints Authority (ICA)",
            "contact_type": "website",
            "value": "https://www.ica.gov.sg/enter-depart/entry_requirements/visa_requirements",
        },
    ],
    "United Arab Emirates": [
        {
            "label": "UAE Visa Information",
            "contact_type": "website",
            "value": "https://u.ae/en/information-and-services/visa-and-emirates-id",
        },
    ],
    "Brazil": [
        {
            "label": "Brazilian Ministry of Foreign Affairs - Visa",
            "contact_type": "website",
            "value": "https://www.gov.br/mre/en/consular-services/visas",
        },
    ],
    "Mexico": [
        {
            "label": "Mexican Immigration - Visa Services",
            "contact_type": "website",
            "value": "https://www.inm.gob.mx",
        },
    ],
    "South Africa": [
        {
            "label": "Department of Home Affairs - Visa",
            "contact_type": "website",
            "value": "http://www.dha.gov.za/index.php/immigration-services",
        },
    ],
    "South Korea": [
        {
            "label": "Korea Visa Portal",
            "contact_type": "website",
            "value": "https://www.visa.go.kr/openPage.do?MENU_ID=10101",
        },
    ],
    "Spain": [
        {
            "label": "Spanish Ministry of Foreign Affairs - Visa",
            "contact_type": "website",
            "value": "https://www.exteriores.gob.es/en/ServiciosAlCiudadano/Paginas/Visados.aspx",
        },
    ],
    "Italy": [
        {
            "label": "Italian Ministry of Foreign Affairs - Visa",
            "contact_type": "website",
            "value": "https://vistoperitalia.esteri.it/home/en",
        },
    ],
    "Netherlands": [
        {
            "label": "Immigration and Naturalisation Service (IND)",
            "contact_type": "website",
            "value": "https://ind.nl/en",
        },
    ],
    "Sweden": [
        {
            "label": "Swedish Migration Agency",
            "contact_type": "website",
            "value": "https://www.migrationsverket.se/English/Private-individuals/Visiting-Sweden.html",
        },
    ],
    "Norway": [
        {
            "label": "Norwegian Directorate of Immigration (UDI)",
            "contact_type": "website",
            "value": "https://www.udi.no/en/want-to-apply/visit-and-holiday/",
        },
    ],
    "Denmark": [
        {
            "label": "Danish Immigration Service",
            "contact_type": "website",
            "value": "https://www.nyidanmark.dk/en-GB",
        },
    ],
    "Thailand": [
        {
            "label": "Royal Thai Embassy - Visa Information",
            "contact_type": "website",
            "value": "https://www.thaiembassy.com/thailand/thai-visa.php",
        },
    ],
    "Malaysia": [
        {
            "label": "Immigration Department of Malaysia",
            "contact_type": "website",
            "value": "https://www.imi.gov.my/portal2017/index.php/en/",
        },
    ],
    "New Zealand": [
        {
            "label": "Immigration New Zealand",
            "contact_type": "website",
            "value": "https://www.immigration.govt.nz",
        },
        {
            "label": "Immigration Contact Centre",
            "contact_type": "phone",
            "value": "+64-9-914-4100",
        },
    ],
    "Switzerland": [
        {
            "label": "State Secretariat for Migration (SEM)",
            "contact_type": "website",
            "value": "https://www.sem.admin.ch/sem/en/home/themen/einreise/visumantraege.html",
        },
    ],
}

# Countries list (sorted alphabetically)
COUNTRIES = sorted(VISA_TYPES_BY_COUNTRY.keys())


def get_visa_types(country: str) -> list[str]:
    """Get visa types for a specific country."""
    return VISA_TYPES_BY_COUNTRY.get(country, [])


def get_all_countries() -> list[str]:
    """Get list of all countries with visa type data."""
    return COUNTRIES


def get_visa_contacts(country: str) -> list[dict]:
    """Get default visa contact information for a specific country."""
    return VISA_CONTACTS_BY_COUNTRY.get(country, [])
