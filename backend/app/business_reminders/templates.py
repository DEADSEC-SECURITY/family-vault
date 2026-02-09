"""
Business tax and compliance reminder templates.

Auto-generated reminders for LLCs and Corporations based on:
- Federal IRS requirements
- State-specific filing deadlines
- Entity type (LLC, Corporation, S-Corp)

Sources:
- https://milestone.inc/blog/business-tax-deadlines-2026
- https://www.harborcompliance.com/llc-corporation-annual-report
- https://fileforms.com/delaware-franchise-tax-2026-deadlines/
"""

# Federal tax reminders (apply to all businesses)
FEDERAL_TAX_REMINDERS = {
    "llc": [
        {
            "title": "Form 1065",
            "month": 3,
            "day": 15,
            "note": "Partnership tax return due for multi-member LLCs. Include Schedule K-1s for each member. Can extend to September 15 with Form 7004.",
            "repeat": "yearly"
        },
        {
            "title": "Quarterly Estimated Tax",
            "month": 4,
            "day": 15,
            "note": "Estimated tax payment due quarterly (April 15, June 15, Sept 15, Jan 15). Form 1040-ES. Pay if expecting to owe $1,000+.",
            "repeat": "quarterly"
        },
    ],
    "corporation": [
        {
            "title": "Form 1120",
            "month": 4,
            "day": 15,
            "note": "Corporate income tax return due. Can extend to October 15 with Form 7004.",
            "repeat": "yearly"
        },
        {
            "title": "Quarterly Estimated Tax",
            "month": 4,
            "day": 15,
            "note": "Corporate estimated tax payment due quarterly (April 15, June 15, Sept 15, Dec 15). Form 1120-W. Due if expecting to owe $500+.",
            "repeat": "quarterly"
        },
    ],
}

# S-Corporation specific reminders (for corporations that elected S-Corp status)
S_CORP_REMINDERS = [
    {
        "title": "Form 1120-S",
        "month": 3,
        "day": 15,
        "note": "S-Corporation tax return due. Include Schedule K-1s for each shareholder. Can extend to September 15 with Form 7004.",
        "repeat": "yearly"
    },
]

# Employment tax reminders (if business has employees)
EMPLOYMENT_TAX_REMINDERS = [
    {
        "title": "Form 941",
        "month": 4,
        "day": 30,
        "note": "Employer's Quarterly Federal Tax Return due quarterly (April 30, July 31, Oct 31, Jan 31). Report income taxes, Social Security, and Medicare withheld.",
        "repeat": "quarterly"
    },
    {
        "title": "Form 940",
        "month": 1,
        "day": 31,
        "note": "Employer's Annual Federal Unemployment (FUTA) Tax Return. Due in following year for prior year.",
        "repeat": "yearly"
    },
    {
        "title": "Provide W-2s to Employees",
        "month": 1,
        "day": 31,
        "note": "Give employees their W-2 forms for the previous tax year.",
        "repeat": "yearly"
    },
    {
        "title": "W-2s and W-3 with SSA",
        "month": 1,
        "day": 31,
        "note": "Submit W-2s and W-3 (Transmittal of Wage and Tax Statements) to Social Security Administration.",
        "repeat": "yearly"
    },
    {
        "title": "1099-NEC for Contractors",
        "month": 1,
        "day": 31,
        "note": "File 1099-NEC for contractors/vendors paid $600+ for services in the previous tax year.",
        "repeat": "yearly"
    },
]

# State-specific compliance reminders
STATE_COMPLIANCE_REMINDERS = {
    "California": {
        "llc": [
            {
                "title": "California Franchise Tax",
                "month": 4,
                "day": 15,
                "note": "California LLC $800 minimum franchise tax due annually. Additional fee based on gross receipts.",
                "repeat": "yearly"
            },
            {
                "title": "Statement of Information",
                "month": None,  # Anniversary-based, will be calculated from formation_date
                "day": None,
                "note": "File Statement of Information (SI-550) with California Secretary of State. Due every 2 years, within 90 days after fiscal year end.",
                "repeat": "biennial"
            },
        ],
        "corporation": [
            {
                "title": "California Franchise Tax",
                "month": 4,
                "day": 15,
                "note": "California corporation franchise tax due. Minimum $800, plus percentage of net income.",
                "repeat": "yearly"
            },
            {
                "title": "Statement of Information",
                "month": None,
                "day": None,
                "note": "File Statement of Information (SI-550) with California Secretary of State. Due annually, within 90 days after fiscal year end.",
                "repeat": "yearly"
            },
        ],
    },
    "Delaware": {
        "llc": [
            {
                "title": "Delaware Franchise Tax",
                "month": 6,
                "day": 1,
                "note": "Delaware LLC annual franchise tax of $300 due. Late payment incurs $200 penalty plus 1.5% monthly interest.",
                "repeat": "yearly"
            },
        ],
        "corporation": [
            {
                "title": "Delaware Franchise Tax & Annual Report",
                "month": 3,
                "day": 1,
                "note": "Delaware corporation franchise tax and annual report due. Amount varies based on authorized shares method or assumed par value capital method.",
                "repeat": "yearly"
            },
        ],
    },
    "Texas": {
        "llc": [
            {
                "title": "Texas Franchise Tax Report",
                "month": 5,
                "day": 15,
                "note": "Texas Franchise Tax Report due annually. No report required if total revenue is $2.47M or less (no tax due threshold).",
                "repeat": "yearly"
            },
        ],
        "corporation": [
            {
                "title": "Texas Franchise Tax Report",
                "month": 5,
                "day": 15,
                "note": "Texas Franchise Tax Report due annually. No report required if total revenue is $2.47M or less.",
                "repeat": "yearly"
            },
        ],
    },
    "New York": {
        "llc": [
            {
                "title": "NY LLC Biennial Statement",
                "month": None,
                "day": None,
                "note": "New York LLC Biennial Statement due every 2 years. Filing fee ranges from $9 to $4,500 based on income.",
                "repeat": "biennial"
            },
        ],
        "corporation": [
            {
                "title": "NY Corporation Biennial Statement",
                "month": None,
                "day": None,
                "note": "New York corporation Biennial Statement due every 2 years.",
                "repeat": "biennial"
            },
        ],
    },
    "Florida": {
        "llc": [
            {
                "title": "Florida Annual Report",
                "month": 5,
                "day": 1,
                "note": "Florida LLC Annual Report due by May 1st. Filing fee: $138.75.",
                "repeat": "yearly"
            },
        ],
        "corporation": [
            {
                "title": "Florida Annual Report",
                "month": 5,
                "day": 1,
                "note": "Florida corporation Annual Report due by May 1st. Filing fee varies.",
                "repeat": "yearly"
            },
        ],
    },
    "Nevada": {
        "llc": [
            {
                "title": "Nevada Annual List & Business License",
                "month": None,
                "day": None,
                "note": "Nevada LLC Annual List and Business License renewal due on anniversary of formation. Fee: $350 (Annual List) + $500 (Business License).",
                "repeat": "yearly"
            },
        ],
        "corporation": [
            {
                "title": "Nevada Annual List & Business License",
                "month": None,
                "day": None,
                "note": "Nevada corporation Annual List and Business License renewal due on anniversary of incorporation.",
                "repeat": "yearly"
            },
        ],
    },
}

# Common states that DON'T require annual reports (for reference)
NO_ANNUAL_REPORT_STATES = [
    "Alabama",  # For LLCs
    "Arizona",  # For LLCs
    "Arkansas",  # For LLCs
    "Idaho",    # For LLCs
    "Indiana",  # For LLCs (biennial for corps)
    "Iowa",     # Biennial for both
    "Missouri", # For LLCs
    "New Mexico", # For LLCs
    "North Dakota", # For LLCs
    "Ohio",     # For LLCs
    "South Dakota", # For LLCs
]
