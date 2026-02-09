# Comprehensive list of US insurance providers
# Sources: NAIC market share data, AM Best directory

INSURANCE_PROVIDERS: list[str] = [
    "AARP",
    "Acuity",
    "Aetna",
    "Aflac",
    "Alfa Mutual Group",
    "Allianz",
    "Allstate Corp.",
    "American Access Casualty Co.",
    "American Family Insurance",
    "American Financial Group",
    "American Modern Insurance Group",
    "American National Insurance",
    "Amica Mutual Insurance",
    "Anthem",
    "Arbella Insurance Group",
    "Assurant",
    "Auto Club Group",
    "Auto-Owners Insurance",
    "Aviva",
    "AXA",
    "Bankers Life",
    "Blue Cross Blue Shield",
    "Brightway Insurance",
    "Bristol West Insurance",
    "Brotherhood Mutual",
    "CHUBB",
    "Church Mutual Insurance",
    "Cincinnati Financial",
    "CNA Financial",
    "Colonial Penn",
    "Columbia Insurance Group",
    "Country Financial",
    "CSAA Insurance Group",
    "CUNA Mutual Group",
    "Dairyland Auto Insurance",
    "Delta Dental",
    "Donegal Insurance Group",
    "EMC Insurance Companies",
    "Encompass Insurance",
    "Erie Insurance",
    "Esurance",
    "Farmers Insurance Group",
    "Fidelity Investments Life Insurance",
    "Foremost Insurance Group",
    "GAINSCO",
    "GEICO",
    "General American Mutual",
    "Genworth Financial",
    "Global Indemnity Group",
    "Globe Life Inc.",
    "Goodville Mutual",
    "Grange Insurance",
    "Grinnell Mutual",
    "Guardian Life Insurance",
    "Guide One Insurance",
    "Hagerty",
    "Hanover Insurance Group",
    "Hartford Financial Services",
    "Hastings Mutual Insurance",
    "Hippo Insurance",
    "HiRoad Insurance",
    "Horace Mann Educators",
    "Humana",
    "ICW Group",
    "IMT Insurance",
    "Indiana Farm Bureau Insurance",
    "Infinity Insurance",
    "Integrity Insurance",
    "Jewelers Mutual",
    "Jetty Insurance",
    "John Hancock",
    "Kaiser Permanente",
    "Kansas City Life Insurance",
    "Kemper Corporation",
    "Kentucky Farm Bureau",
    "Lemonade",
    "Liberty Mutual",
    "Lincoln Financial Group",
    "Lincoln National",
    "MAPFRE Insurance",
    "Markel Corporation",
    "MassMutual",
    "Mercury General",
    "MetLife",
    "Michigan Farm Bureau",
    "Millville Mutual Insurance",
    "Missouri Farm Bureau",
    "MMG Insurance",
    "Mutual Benefit Group",
    "Mutual of America",
    "Mutual of Omaha",
    "National General Insurance",
    "National Western Life Insurance",
    "Nationwide",
    "New York Life Insurance",
    "NJM Insurance Group",
    "Norfolk & Dedham Group",
    "North Carolina Farm Bureau",
    "Northwestern Mutual",
    "Ohio Farm Bureau",
    "Ohio Mutual Insurance Group",
    "Oregon Mutual Insurance",
    "Pacific Life Insurance",
    "PEMCO Insurance",
    "Penn Mutual Life Insurance",
    "Penn National Insurance",
    "Pekin Insurance",
    "Plymouth Rock Assurance",
    "Principal Financial Group",
    "Progressive",
    "Protective Life Insurance",
    "Prudential Financial",
    "Pure Insurance",
    "QBE Insurance Group",
    "Quincy Mutual Fire Insurance",
    "Root Insurance",
    "Safeco Insurance",
    "Safeway Insurance",
    "SECURA Insurance",
    "Selective Insurance",
    "Sentry Insurance",
    "Shelter Insurance",
    "Society Insurance",
    "Sompo International",
    "Southern Farm Bureau",
    "State Auto Insurance",
    "State Farm",
    "SureFire Insurance",
    "Texas Farm Bureau Insurance",
    "The General Insurance",
    "The Hartford",
    "Toggle Insurance",
    "Tokio Marine America",
    "Transamerica",
    "Travelers Companies",
    "TRICARE",
    "Trinity Health",
    "Trustage",
    "Unitrin",
    "United American Insurance",
    "United Fire Group",
    "United Healthcare",
    "Universal Insurance Holdings",
    "USAA",
    "Utica National Insurance",
    "Virginia Farm Bureau",
    "Wawanesa Mutual Insurance",
    "West Bend Mutual Insurance",
    "Western & Southern Financial",
    "Westfield Insurance",
    "Wisconsin Mutual Insurance",
    "Zurich Insurance Group",
]


# Contact details for major health insurance providers.
# Keys are provider names (matching INSURANCE_PROVIDERS list above).
# Each entry can have: portal_url, claims_address, and contacts (list of
# {label, value, contact_type} dicts that can be auto-populated into
# linked contacts when a user selects the provider).
PROVIDER_DETAILS: dict[str, dict] = {
    "Aetna": {
        "portal_url": "https://www.aetna.com",
        "claims_address": "Aetna Inc.\nP.O. Box 981106\nEl Paso, TX 79998-1106",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-872-3862", "contact_type": "phone"},
            {"label": "TTY", "value": "711", "contact_type": "phone"},
            {"label": "Prior Authorization", "value": "1-800-624-0756", "contact_type": "phone"},
            {"label": "Pharmacy Inquiry", "value": "1-888-792-3862", "contact_type": "phone"},
        ],
    },
    "Anthem": {
        "portal_url": "https://www.anthem.com",
        "claims_address": "Anthem Blue Cross\nP.O. Box 60007\nLos Angeles, CA 90060-0007",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-331-1476", "contact_type": "phone"},
            {"label": "TTY", "value": "711", "contact_type": "phone"},
            {"label": "Prior Authorization", "value": "1-800-956-4411", "contact_type": "phone"},
            {"label": "Pharmacy Inquiry", "value": "1-877-832-7043", "contact_type": "phone"},
        ],
    },
    "Blue Cross Blue Shield": {
        "portal_url": "https://www.bcbs.com",
        "claims_address": "Varies by state — check your plan documents",
        "contacts": [
            {"label": "Customer Care", "value": "1-888-630-2583", "contact_type": "phone"},
            {"label": "TTY", "value": "711", "contact_type": "phone"},
        ],
    },
    "Cigna": {
        "portal_url": "https://www.cigna.com",
        "claims_address": "Cigna\nP.O. Box 188369\nChattanooga, TN 37422",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-997-1654", "contact_type": "phone"},
            {"label": "TTY", "value": "711", "contact_type": "phone"},
            {"label": "Prior Authorization", "value": "1-800-768-4695", "contact_type": "phone"},
            {"label": "Pharmacy Inquiry", "value": "1-800-285-4812", "contact_type": "phone"},
        ],
    },
    "Humana": {
        "portal_url": "https://www.humana.com",
        "claims_address": "Humana Claims\nP.O. Box 14601\nLexington, KY 40512-4601",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-457-4708", "contact_type": "phone"},
            {"label": "TTY", "value": "711", "contact_type": "phone"},
            {"label": "Prior Authorization", "value": "1-800-555-2546", "contact_type": "phone"},
            {"label": "Pharmacy Inquiry", "value": "1-800-379-0092", "contact_type": "phone"},
        ],
    },
    "Kaiser Permanente": {
        "portal_url": "https://healthy.kaiserpermanente.org",
        "claims_address": "Kaiser Permanente Claims\nP.O. Box 7004\nDowney, CA 90242-7004",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-464-4000", "contact_type": "phone"},
            {"label": "TTY", "value": "711", "contact_type": "phone"},
            {"label": "Pharmacy Inquiry", "value": "1-800-218-1059", "contact_type": "phone"},
        ],
    },
    "United Healthcare": {
        "portal_url": "https://www.uhc.com",
        "claims_address": "UnitedHealthcare\nP.O. Box 30555\nSalt Lake City, UT 84130-0555",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-328-5979", "contact_type": "phone"},
            {"label": "TTY", "value": "711", "contact_type": "phone"},
            {"label": "Prior Authorization", "value": "1-866-842-3278", "contact_type": "phone"},
            {"label": "Pharmacy Inquiry", "value": "1-800-797-9791", "contact_type": "phone"},
        ],
    },
    "TRICARE": {
        "portal_url": "https://www.tricare.mil",
        "claims_address": "TRICARE Claims\nP.O. Box 7031\nCamden, SC 29021-7031",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-444-5445", "contact_type": "phone"},
            {"label": "TTY", "value": "1-800-874-2273", "contact_type": "phone"},
            {"label": "Pharmacy Inquiry", "value": "1-877-363-1303", "contact_type": "phone"},
        ],
    },
    "MetLife": {
        "portal_url": "https://www.metlife.com",
        "claims_address": "MetLife\nP.O. Box 14590\nLexington, KY 40512",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-638-5433", "contact_type": "phone"},
        ],
    },
    "Guardian Life Insurance": {
        "portal_url": "https://www.guardianlife.com",
        "claims_address": "The Guardian\nP.O. Box 26100\nLehigh Valley, PA 18002-6100",
        "contacts": [
            {"label": "Customer Care", "value": "1-888-482-7342", "contact_type": "phone"},
        ],
    },
    "Delta Dental": {
        "portal_url": "https://www.deltadental.com",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-765-6003", "contact_type": "phone"},
        ],
    },
    "State Farm": {
        "portal_url": "https://www.statefarm.com",
        "claims_address": "State Farm\nP.O. Box 2307\nBloomington, IL 61702-2307",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-732-5246", "contact_type": "phone"},
        ],
    },
    "GEICO": {
        "portal_url": "https://www.geico.com",
        "claims_address": "GEICO\nOne GEICO Plaza\nWashington, DC 20076",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-841-3000", "contact_type": "phone"},
        ],
    },
    "Progressive": {
        "portal_url": "https://www.progressive.com",
        "claims_address": "Progressive\nP.O. Box 94505\nCleveland, OH 44101-4505",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-776-4737", "contact_type": "phone"},
        ],
    },
    "Allstate Corp.": {
        "portal_url": "https://www.allstate.com",
        "claims_address": "Allstate\nP.O. Box 660636\nDallas, TX 75266-0636",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-255-7828", "contact_type": "phone"},
        ],
    },
    "USAA": {
        "portal_url": "https://www.usaa.com",
        "claims_address": "USAA\n9800 Fredericksburg Rd\nSan Antonio, TX 78288",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-531-8722", "contact_type": "phone"},
        ],
    },
    "Liberty Mutual": {
        "portal_url": "https://www.libertymutual.com",
        "claims_address": "Liberty Mutual\nP.O. Box 515038\nLos Angeles, CA 90051-5038",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-290-8711", "contact_type": "phone"},
        ],
    },
    "Nationwide": {
        "portal_url": "https://www.nationwide.com",
        "claims_address": "Nationwide\nOne Nationwide Plaza\nColumbus, OH 43215",
        "contacts": [
            {"label": "Customer Care", "value": "1-877-669-6877", "contact_type": "phone"},
        ],
    },
    # --- Life Insurance providers ---
    "Northwestern Mutual": {
        "portal_url": "https://www.northwesternmutual.com",
        "claims_address": "Northwestern Mutual\n720 E Wisconsin Ave\nMilwaukee, WI 53202",
        "contacts": [
            {"label": "Customer Care", "value": "1-866-950-4644", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-890-4674", "contact_type": "phone"},
        ],
    },
    "New York Life Insurance": {
        "portal_url": "https://www.newyorklife.com",
        "claims_address": "New York Life Insurance\n51 Madison Ave\nNew York, NY 10010",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-695-8527", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-695-8527", "contact_type": "phone"},
        ],
    },
    "MassMutual": {
        "portal_url": "https://www.massmutual.com",
        "claims_address": "MassMutual\n1295 State St\nSpringfield, MA 01111",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-272-2216", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-272-2216", "contact_type": "phone"},
        ],
    },
    "Prudential Financial": {
        "portal_url": "https://www.prudential.com",
        "claims_address": "Prudential Financial\nP.O. Box 36\nNewark, NJ 07101-0036",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-778-2255", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-524-0542", "contact_type": "phone"},
        ],
    },
    "Transamerica": {
        "portal_url": "https://www.transamerica.com",
        "claims_address": "Transamerica Life Insurance\nP.O. Box 14369\nDes Moines, IA 50306-3369",
        "contacts": [
            {"label": "Customer Care", "value": "1-888-763-7474", "contact_type": "phone"},
            {"label": "Claims", "value": "1-888-763-7474", "contact_type": "phone"},
        ],
    },
    "Lincoln Financial Group": {
        "portal_url": "https://www.lfg.com",
        "claims_address": "Lincoln Financial Group\nP.O. Box 7876\nFort Wayne, IN 46801-7876",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-454-6265", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-487-1485", "contact_type": "phone"},
        ],
    },
    "Principal Financial Group": {
        "portal_url": "https://www.principal.com",
        "claims_address": "Principal Financial Group\n711 High St\nDes Moines, IA 50392",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-986-3343", "contact_type": "phone"},
        ],
    },
    "Pacific Life Insurance": {
        "portal_url": "https://www.pacificlife.com",
        "claims_address": "Pacific Life Insurance\nP.O. Box 9000\nNewport Beach, CA 92658-9030",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-800-7681", "contact_type": "phone"},
        ],
    },
    "John Hancock": {
        "portal_url": "https://www.johnhancock.com",
        "claims_address": "John Hancock\nP.O. Box 111\nBoston, MA 02117",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-732-5543", "contact_type": "phone"},
            {"label": "Claims", "value": "1-888-732-5543", "contact_type": "phone"},
        ],
    },
    "Mutual of Omaha": {
        "portal_url": "https://www.mutualofomaha.com",
        "claims_address": "Mutual of Omaha\nMutual of Omaha Plaza\nOmaha, NE 68175",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-775-6000", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-775-6000", "contact_type": "phone"},
        ],
    },
    "Globe Life Inc.": {
        "portal_url": "https://www.globelifeinsurance.com",
        "claims_address": "Globe Life Inc.\nP.O. Box 8080\nMcKinney, TX 75070",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-487-5553", "contact_type": "phone"},
        ],
    },
    "Protective Life Insurance": {
        "portal_url": "https://www.protective.com",
        "claims_address": "Protective Life Insurance\nP.O. Box 2606\nBirmingham, AL 35202",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-866-3555", "contact_type": "phone"},
        ],
    },
    "Aflac": {
        "portal_url": "https://www.aflac.com",
        "claims_address": "Aflac\n1932 Wynnton Rd\nColumbus, GA 31999",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-992-3522", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-992-3522", "contact_type": "phone"},
        ],
    },
    # --- Home / Renters Insurance providers ---
    "Travelers Companies": {
        "portal_url": "https://www.travelers.com",
        "claims_address": "Travelers\nOne Tower Square\nHartford, CT 06183",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-842-5075", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-252-4633", "contact_type": "phone"},
        ],
    },
    "Erie Insurance": {
        "portal_url": "https://www.erieinsurance.com",
        "claims_address": "Erie Insurance\n100 Erie Insurance Place\nErie, PA 16530",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-458-0811", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-367-3743", "contact_type": "phone"},
        ],
    },
    "American Family Insurance": {
        "portal_url": "https://www.amfam.com",
        "claims_address": "American Family Insurance\n6000 American Pkwy\nMadison, WI 53783",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-692-6326", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-374-1111", "contact_type": "phone"},
        ],
    },
    "Lemonade": {
        "portal_url": "https://www.lemonade.com",
        "contacts": [
            {"label": "Customer Care", "value": "1-844-733-8666", "contact_type": "phone"},
        ],
    },
    "Hippo Insurance": {
        "portal_url": "https://www.hippo.com",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-585-0705", "contact_type": "phone"},
        ],
    },
    "CHUBB": {
        "portal_url": "https://www.chubb.com",
        "claims_address": "Chubb\nP.O. Box 1615\nWhitehouse Station, NJ 08889",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-252-4670", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-252-4670", "contact_type": "phone"},
        ],
    },
    "Amica Mutual Insurance": {
        "portal_url": "https://www.amica.com",
        "claims_address": "Amica Mutual Insurance\n100 Amica Way\nLincoln, RI 02865-1155",
        "contacts": [
            {"label": "Customer Care", "value": "1-800-242-6422", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-242-6422", "contact_type": "phone"},
        ],
    },
    "Farmers Insurance Group": {
        "portal_url": "https://www.farmers.com",
        "claims_address": "Farmers Insurance\nP.O. Box 4327\nWoodland Hills, CA 91365",
        "contacts": [
            {"label": "Customer Care", "value": "1-888-327-6335", "contact_type": "phone"},
            {"label": "Claims", "value": "1-800-435-7764", "contact_type": "phone"},
        ],
    },
    "The Hartford": {
        "portal_url": "https://www.thehartford.com",
        "claims_address": "The Hartford\nOne Hartford Plaza\nHartford, CT 06155",
        "contacts": [
            {"label": "Customer Care", "value": "1-888-422-4475", "contact_type": "phone"},
        ],
    },
}
