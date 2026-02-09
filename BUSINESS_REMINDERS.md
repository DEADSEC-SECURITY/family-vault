# Automatic Business Tax & Compliance Reminders

## Overview

When you create an LLC or Corporation in FamilyVault, the system **automatically generates tax and compliance reminders** based on:
- **Entity type** (LLC vs Corporation)
- **State of formation/incorporation** (federal + state-specific deadlines)
- **Optional**: Employee tax reminders and S-Corp election

## What Reminders Are Generated?

### Federal Tax Reminders

#### LLCs (Partnership Taxation)
- **Form 1065** (Partnership Return) - Due March 15
- **Quarterly Estimated Taxes** (Form 1040-ES) - Q1-Q4

#### C-Corporations
- **Form 1120** (Corporate Tax Return) - Due April 15
- **Quarterly Estimated Taxes** (Form 1120-W) - Q1-Q4

#### S-Corporations
- **Form 1120-S** (S-Corp Tax Return) - Due March 15
- Schedule K-1s to shareholders

### Employment Tax Reminders (If You Have Employees)

These can be added manually via the API or by regenerating reminders:
- **Form 941** - Quarterly payroll tax (Q1-Q4)
- **Form 940** - Annual unemployment tax (Due Jan 31)
- **W-2s to employees** - Due January 31
- **W-2/W-3 to SSA** - Due January 31
- **1099-NEC to contractors** - Due January 31 ($600+ threshold)

### State-Specific Compliance Reminders

#### California
- **Franchise Tax** - $800 minimum for LLCs/Corps, due April 15
- **Statement of Information** - Annual (Corps) or Biennial (LLCs)

#### Delaware
- **Franchise Tax** - $300 for LLCs (due June 1), variable for Corps (due March 1)
- **Annual Report** - Due March 1 for Corps

#### Texas
- **Franchise Tax Report** - Due May 15 (no tax if revenue < $2.47M)

#### New York
- **Biennial Statement** - Due every 2 years, $9-$4,500 filing fee

#### Florida
- **Annual Report** - Due May 1st

#### Nevada
- **Annual List & Business License** - Anniversary-based

## How It Works

### Automatic Generation (New Businesses)

When you create an LLC or Corporation:
1. Fill in **State of Formation/Incorporation** → State-specific reminders added
2. Fill in **Formation Date** → Anniversary-based reminders calculated
3. Reminders are **automatically created** when you save the item
4. View/edit/delete reminders in the right sidebar

### Manual Generation (Existing Businesses)

For businesses created before this feature or to add employee tax reminders:

**API Endpoint:**
```
POST /api/reminders/generate-business-reminders/{item_id}?has_employees=true&is_s_corp=false
```

**Query Parameters:**
- `has_employees` (boolean) - Adds Form 941, W-2, 1099-NEC reminders
- `is_s_corp` (boolean) - Changes Form 1120 to Form 1120-S

**Example:**
```bash
curl -X POST "http://localhost:8000/api/reminders/generate-business-reminders/{item_id}?has_employees=true" \
  -H "Authorization: Bearer {token}"
```

## Example: Delaware LLC

Creating a Delaware LLC automatically generates:
- ✅ Form 1065 (Partnership Return) - March 15
- ✅ Quarterly Estimated Tax Q1 - April 30
- ✅ Quarterly Estimated Tax Q2 - July 31
- ✅ Quarterly Estimated Tax Q3 - November 2
- ✅ Quarterly Estimated Tax Q4 - February 2
- ✅ Delaware Franchise Tax ($300) - June 1

**Total: 6 reminders**

## Example: California Corporation with Employees

Creating a California C-Corp and generating with `has_employees=true`:
- ✅ Form 1120 (Corporate Tax Return) - April 15
- ✅ 4 Quarterly Estimated Tax Payments
- ✅ California Franchise Tax ($800) - April 15
- ✅ California Statement of Information - Anniversary
- ✅ 4 Quarterly Form 941 (Payroll Tax)
- ✅ Form 940 (Unemployment Tax) - January 31
- ✅ W-2s to employees - January 31
- ✅ W-2/W-3 to SSA - January 31
- ✅ 1099-NEC to contractors - January 31

**Total: 15 reminders**

## Managing Reminders

### View Reminders
- Right sidebar on item page shows all reminders for that business
- Main Reminders page shows all upcoming reminders across all items

### Edit/Delete Reminders
- Click the ❌ button to delete a reminder you don't need
- Reminders are **suggestions** - customize them for your specific situation

### Repeat Reminders
- Most reminders have `repeat: "yearly"` so they recur annually
- Biennial reminders (like NY Statement) repeat every 2 years
- After email notification, reminder date auto-advances to next year

## States with Comprehensive Coverage

Currently includes detailed state-specific reminders for:
- California
- Delaware
- Texas
- New York
- Florida
- Nevada

**Note:** Other states may have annual report requirements not yet included. You can manually add custom reminders for your specific state requirements.

## Sources & References

All reminder templates are based on official IRS publications and state government resources:

### Federal Requirements
- [IRS Publication 509 - Tax Calendars](https://www.irs.gov/publications/p509)
- [Business Tax Deadlines 2026](https://milestone.inc/blog/business-tax-deadlines-2026)
- [LLC & Corporation Tax Deadlines](https://outbooks.com/blog/business-tax-deadlines-corporations-llcs/)

### State Requirements
- [Annual Report Deadlines by State](https://www.harborcompliance.com/llc-corporation-annual-report)
- [Delaware Franchise Tax 2026](https://fileforms.com/delaware-franchise-tax-2026-deadlines/)
- [California FTB Due Dates](https://www.ftb.ca.gov/file/when-to-file/due-dates-business.html)

## Future Enhancements

Planned features:
- [ ] Add more states (all 50 states)
- [ ] Configurable fiscal year (currently assumes calendar year)
- [ ] Partnership vs Single-member LLC distinction
- [ ] Professional corporation (PC) specific reminders
- [ ] State sales tax filing reminders
- [ ] UI button to regenerate reminders with options

## Technical Implementation

**Backend Files:**
- `backend/app/business_reminders/templates.py` - Reminder templates
- `backend/app/business_reminders/service.py` - Auto-generation logic
- `backend/app/items/service.py` - Integration into item creation
- `backend/app/reminders/router.py` - Manual generation endpoint

**Database:**
- Reminders stored in `custom_reminders` table
- Linked to business items via `item_id` foreign key
- Support for repeat intervals (yearly, biennial)
