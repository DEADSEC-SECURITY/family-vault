"use client";

import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Item } from "@/lib/api";
import { formatDate, getFieldValue } from "@/lib/format";
import { SubcategoryIcon } from "./SubcategoryIcon";

interface ItemCardProps {
  item: Item;
  categorySlug: string;
}

// Helper to calculate annual premium based on coverage period
function calculateAnnualPremium(
  premiumStr: string | null,
  startDateStr: string | null,
  endDateStr: string | null
): string | null {
  if (!premiumStr || !startDateStr || !endDateStr) return null;

  try {
    const premium = parseFloat(premiumStr);
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Calculate months in coverage period
    const monthsDiff =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      (endDate.getDate() - startDate.getDate()) / 30; // Approximate partial months

    if (monthsDiff <= 0) return null;

    // Calculate annual premium: (premium / months) * 12
    const annualPremium = (premium / monthsDiff) * 12;

    return annualPremium.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  } catch {
    return null;
  }
}

export function ItemCard({ item, categorySlug }: ItemCardProps) {
  const isInsurance = categorySlug === "insurance";
  const isID = categorySlug === "ids";
  const isBusiness = categorySlug === "business";

  // For ID items, show specialized card
  if (isID) {
    const fullName = getFieldValue(item, "full_name");
    const licenseNumber = getFieldValue(item, "license_number");
    const passportNumber = getFieldValue(item, "passport_number");
    const visaNumber = getFieldValue(item, "visa_number");
    const ssn = getFieldValue(item, "ssn");
    const certificateNumber = getFieldValue(item, "certificate_number");
    const idNumber = getFieldValue(item, "id_number");
    const state = getFieldValue(item, "state");
    const country = getFieldValue(item, "country");
    const issueDate = getFieldValue(item, "issue_date");
    const expirationDate = getFieldValue(item, "expiration_date");
    const dateOfBirth = getFieldValue(item, "date_of_birth");
    const visaType = getFieldValue(item, "visa_type");
    const entryType = getFieldValue(item, "entry_type");
    const placeOfBirth = getFieldValue(item, "place_of_birth");
    const idType = getFieldValue(item, "id_type");
    const issuingBody = getFieldValue(item, "issuing_body");

    // Determine primary ID number based on subcategory
    let primaryNumber = null;
    let primaryLabel = "";

    switch (item.subcategory) {
      case "drivers_license":
        primaryNumber = licenseNumber;
        primaryLabel = "License";
        break;
      case "passport":
        primaryNumber = passportNumber;
        primaryLabel = "Passport";
        break;
      case "visa":
        primaryNumber = visaNumber;
        primaryLabel = "Visa";
        break;
      case "social_security":
        // Mask SSN - show only last 4 digits
        if (ssn && ssn.length >= 4) {
          primaryNumber = "•••-••-" + ssn.slice(-4);
        } else {
          primaryNumber = ssn;
        }
        primaryLabel = "SSN";
        break;
      case "birth_certificate":
        primaryNumber = certificateNumber;
        primaryLabel = "Certificate";
        break;
      case "custom_id":
        primaryNumber = idNumber;
        primaryLabel = "ID Number";
        break;
    }

    return (
      <Link href={`/${categorySlug}/${item.id}`}>
        <Card className={`transition-shadow hover:shadow-md cursor-pointer h-full ${item.is_archived ? "opacity-60" : ""}`}>
          <CardContent className="p-4">
            {/* Top row: Icon + Item Name + Badges */}
            <div className="flex items-start gap-3 mb-2">
              <SubcategoryIcon subcategory={item.subcategory} category="ids" />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 truncate leading-tight">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.is_archived && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                        Expired
                      </Badge>
                    )}
                    {item.files.length > 0 && (
                      <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </div>
                </div>
                {(state || country) && (
                  <p className="text-xs text-gray-500 mt-1">
                    {state || country}
                  </p>
                )}
              </div>
            </div>

            {/* Split content area */}
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
              {/* Left side: ID details */}
              <div className="space-y-1.5">
                {primaryNumber && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">{primaryLabel}</p>
                    <p className="text-xs text-gray-700 font-mono">{primaryNumber}</p>
                  </div>
                )}

                {issueDate && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Issued</p>
                    <p className="text-xs text-gray-700">{formatDate(issueDate)}</p>
                  </div>
                )}

                {expirationDate && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Expires</p>
                    <p className="text-xs text-gray-700">{formatDate(expirationDate)}</p>
                  </div>
                )}

                {placeOfBirth && item.subcategory === "birth_certificate" && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Place of Birth</p>
                    <p className="text-xs text-gray-700 line-clamp-1">{placeOfBirth}</p>
                  </div>
                )}
              </div>

              {/* Right side: Secondary details */}
              <div className="space-y-1.5 text-right">
                {dateOfBirth && item.subcategory === "drivers_license" && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Born</p>
                    <p className="text-xs text-gray-700">{formatDate(dateOfBirth)}</p>
                  </div>
                )}

                {dateOfBirth && item.subcategory === "birth_certificate" && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Date of Birth</p>
                    <p className="text-xs text-gray-700">{formatDate(dateOfBirth)}</p>
                  </div>
                )}

                {country && item.subcategory === "passport" && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Nationality</p>
                    <p className="text-xs text-gray-700">{country}</p>
                  </div>
                )}

                {visaType && item.subcategory === "visa" && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Type</p>
                    <p className="text-xs text-gray-700">{visaType}</p>
                  </div>
                )}

                {entryType && item.subcategory === "visa" && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Entry</p>
                    <p className="text-xs text-gray-700">{entryType}</p>
                  </div>
                )}

                {idType && item.subcategory === "custom_id" && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Type</p>
                    <p className="text-xs text-gray-700">{idType}</p>
                  </div>
                )}

                {issuingBody && item.subcategory === "custom_id" && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Issued By</p>
                    <p className="text-xs text-gray-700 line-clamp-1">{issuingBody}</p>
                  </div>
                )}

                {item.files.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Documents</p>
                    <p className="text-xs text-gray-700">
                      {item.files.length} file{item.files.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // For insurance items, show specialized card
  if (isInsurance) {
    const provider = getFieldValue(item, "provider");
    const startDate = getFieldValue(item, "start_date");
    const endDate = getFieldValue(item, "end_date");
    const propertyAddress = getFieldValue(item, "property_address");
    const policyNumber = getFieldValue(item, "policy_number");
    const premium = getFieldValue(item, "premium");

    // Check if it's home/renters insurance
    const isPropertyInsurance =
      item.subcategory === "home_insurance" ||
      item.subcategory === "renters_insurance";

    return (
      <Link href={`/${categorySlug}/${item.id}`}>
        <Card className={`transition-shadow hover:shadow-md cursor-pointer h-full ${item.is_archived ? "opacity-60" : ""}`}>
          <CardContent className="p-4">
            {/* Top row: Icon + Item Name + Badges */}
            <div className="flex items-start gap-3 mb-2">
              <SubcategoryIcon subcategory={item.subcategory} category="insurance" />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 truncate leading-tight">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.is_archived && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                        Expired
                      </Badge>
                    )}
                    {item.files.length > 0 && (
                      <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </div>
                </div>
                {provider && (
                  <p className="text-xs text-gray-500 mt-1">{provider}</p>
                )}
              </div>
            </div>

            {/* Split content area */}
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
              {/* Left side: Policy details */}
              <div className="space-y-1.5">
                {policyNumber && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Policy</p>
                    <p className="text-xs text-gray-700 font-mono">{policyNumber}</p>
                  </div>
                )}

                {(startDate || endDate) && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Coverage</p>
                    <p className="text-xs text-gray-700">
                      {startDate && formatDate(startDate)}
                      {startDate && endDate && " - "}
                      {endDate && formatDate(endDate)}
                    </p>
                  </div>
                )}

                {isPropertyInsurance && propertyAddress && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property</p>
                    <p className="text-xs text-gray-700 line-clamp-2">{propertyAddress}</p>
                  </div>
                )}
              </div>

              {/* Right side: Financial details */}
              <div className="space-y-1.5 text-right">
                {premium && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Premium</p>
                    <p className="text-xs text-gray-700 font-semibold">
                      ${calculateAnnualPremium(premium, startDate, endDate) || parseFloat(premium).toLocaleString()}/yr
                    </p>
                  </div>
                )}

                {item.files.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Documents</p>
                    <p className="text-xs text-gray-700">
                      {item.files.length} file{item.files.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // For business items, show specialized card
  if (isBusiness) {
    const businessName = getFieldValue(item, "business_name");
    const ein = getFieldValue(item, "ein");
    const formationDate = getFieldValue(item, "formation_date");
    const stateOfFormation = getFieldValue(item, "state_of_formation");
    const stateOfIncorporation = getFieldValue(item, "state_of_incorporation");
    const registeredAgent = getFieldValue(item, "registered_agent");
    const ownerName = getFieldValue(item, "owner_name");
    const startDate = getFieldValue(item, "start_date");
    const licenseType = getFieldValue(item, "license_type");
    const licenseNumber = getFieldValue(item, "license_number");
    const issuingAuthority = getFieldValue(item, "issuing_authority");
    const issueDate = getFieldValue(item, "issue_date");
    const expirationDate = getFieldValue(item, "expiration_date");
    const provider = getFieldValue(item, "provider");
    const policyNumber = getFieldValue(item, "policy_number");
    const coverageType = getFieldValue(item, "coverage_type");
    const premium = getFieldValue(item, "premium");
    const endDate = getFieldValue(item, "end_date");
    const documentType = getFieldValue(item, "document_type");
    const taxYear = getFieldValue(item, "tax_year");

    // Determine subtitle based on subcategory
    let subtitle = "";
    switch (item.subcategory) {
      case "llc":
        subtitle = stateOfFormation ? `${stateOfFormation} LLC` : "LLC";
        break;
      case "corporation":
        subtitle = stateOfIncorporation ? `${stateOfIncorporation} Corporation` : "Corporation";
        break;
      case "partnership":
        subtitle = "Partnership";
        break;
      case "sole_proprietorship":
        subtitle = ownerName || "Sole Proprietorship";
        break;
      case "business_license":
        subtitle = issuingAuthority || licenseType || "Business License";
        break;
      case "business_insurance":
        subtitle = provider || coverageType || "Business Insurance";
        break;
      case "tax_document":
        subtitle = taxYear ? `Tax Year ${taxYear}` : "Tax Document";
        break;
    }

    return (
      <Link href={`/${categorySlug}/${item.id}`}>
        <Card className={`transition-shadow hover:shadow-md cursor-pointer h-full ${item.is_archived ? "opacity-60" : ""}`}>
          <CardContent className="p-4">
            {/* Top row: Icon + Item Name + Badges */}
            <div className="flex items-start gap-3 mb-2">
              <SubcategoryIcon subcategory={item.subcategory} category="business" />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 truncate leading-tight">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.is_archived && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                        Expired
                      </Badge>
                    )}
                    {item.files.length > 0 && (
                      <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </div>
                </div>
                {subtitle && (
                  <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
                )}
              </div>
            </div>

            {/* Split content area */}
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
              {/* Left side: Primary details */}
              <div className="space-y-1.5">
                {/* LLC/Corporation */}
                {(item.subcategory === "llc" || item.subcategory === "corporation") && (
                  <>
                    {ein && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">EIN</p>
                        <p className="text-xs text-gray-700 font-mono">{ein}</p>
                      </div>
                    )}
                    {formationDate && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          {item.subcategory === "llc" ? "Formed" : "Incorporated"}
                        </p>
                        <p className="text-xs text-gray-700">{formatDate(formationDate)}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Partnership */}
                {item.subcategory === "partnership" && (
                  <>
                    {ein && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">EIN</p>
                        <p className="text-xs text-gray-700 font-mono">{ein}</p>
                      </div>
                    )}
                    {formationDate && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Formed</p>
                        <p className="text-xs text-gray-700">{formatDate(formationDate)}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Sole Proprietorship */}
                {item.subcategory === "sole_proprietorship" && (
                  <>
                    {ein && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">EIN</p>
                        <p className="text-xs text-gray-700 font-mono">{ein}</p>
                      </div>
                    )}
                    {startDate && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Started</p>
                        <p className="text-xs text-gray-700">{formatDate(startDate)}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Business License */}
                {item.subcategory === "business_license" && (
                  <>
                    {licenseNumber && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">License #</p>
                        <p className="text-xs text-gray-700 font-mono">{licenseNumber}</p>
                      </div>
                    )}
                    {issueDate && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Issued</p>
                        <p className="text-xs text-gray-700">{formatDate(issueDate)}</p>
                      </div>
                    )}
                    {expirationDate && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Expires</p>
                        <p className="text-xs text-gray-700">{formatDate(expirationDate)}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Business Insurance */}
                {item.subcategory === "business_insurance" && (
                  <>
                    {policyNumber && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Policy</p>
                        <p className="text-xs text-gray-700 font-mono">{policyNumber}</p>
                      </div>
                    )}
                    {coverageType && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Coverage</p>
                        <p className="text-xs text-gray-700 line-clamp-2">{coverageType}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Tax Document */}
                {item.subcategory === "tax_document" && (
                  <>
                    {documentType && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Type</p>
                        <p className="text-xs text-gray-700 line-clamp-2">{documentType}</p>
                      </div>
                    )}
                    {businessName && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Business</p>
                        <p className="text-xs text-gray-700 line-clamp-1">{businessName}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right side: Secondary details */}
              <div className="space-y-1.5 text-right">
                {/* LLC/Corporation - Registered Agent */}
                {(item.subcategory === "llc" || item.subcategory === "corporation") && registeredAgent && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Registered Agent</p>
                    <p className="text-xs text-gray-700 line-clamp-2">{registeredAgent}</p>
                  </div>
                )}

                {/* Business Insurance - Premium */}
                {item.subcategory === "business_insurance" && premium && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Premium</p>
                    <p className="text-xs text-gray-700 font-semibold">
                      ${parseFloat(premium).toLocaleString()}/yr
                    </p>
                  </div>
                )}

                {/* Business Insurance - Coverage Period */}
                {item.subcategory === "business_insurance" && (startDate || endDate) && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Period</p>
                    <p className="text-xs text-gray-700">
                      {startDate && formatDate(startDate)}
                      {startDate && endDate && " - "}
                      {endDate && formatDate(endDate)}
                    </p>
                  </div>
                )}

                {/* Documents count */}
                {item.files.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Documents</p>
                    <p className="text-xs text-gray-700">
                      {item.files.length} file{item.files.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // For non-insurance items, show original card
  const previewFields = item.fields
    .filter((f) => f.field_value)
    .slice(0, 2);

  return (
    <Link href={`/${categorySlug}/${item.id}`}>
      <Card className={`transition-shadow hover:shadow-md cursor-pointer h-full ${item.is_archived ? "opacity-60" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
              {item.is_archived && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-gray-200 text-gray-600">
                  Expired
                </Badge>
              )}
            </div>
            {item.files.length > 0 && (
              <Paperclip className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
            )}
          </div>
          {previewFields.length > 0 && (
            <div className="mt-2 space-y-1">
              {previewFields.map((f) => (
                <p key={f.field_key} className="text-xs text-gray-500 truncate">
                  {f.field_value}
                </p>
              ))}
            </div>
          )}
          {item.files.length > 0 && (
            <p className="mt-2 text-xs text-gray-400">
              {item.files.length} file{item.files.length > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
