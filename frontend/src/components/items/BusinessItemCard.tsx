import type { Item } from "@/lib/api";
import { formatDate, getFieldValue } from "@/lib/format";
import { ItemCardShell } from "./ItemCardShell";

interface BusinessItemCardProps {
  item: Item;
  categorySlug: string;
}

const BIZ_INSURANCE_TYPES = new Set([
  "general_liability", "professional_liability", "workers_compensation",
  "commercial_property", "commercial_auto", "bop", "cyber_liability",
  "other_business_insurance",
]);

function getBusinessSubtitle(item: Item): string {
  const sub = item.subcategory;
  const stateOfFormation = getFieldValue(item, "state_of_formation");
  const stateOfIncorporation = getFieldValue(item, "state_of_incorporation");
  const ownerName = getFieldValue(item, "owner_name");
  const issuingAuthority = getFieldValue(item, "issuing_authority");
  const licenseType = getFieldValue(item, "license_type");
  const provider = getFieldValue(item, "provider");
  const taxYear = getFieldValue(item, "tax_year");

  if (BIZ_INSURANCE_TYPES.has(sub)) return provider || "Business Insurance";

  switch (sub) {
    case "llc": return stateOfFormation ? `${stateOfFormation} LLC` : "LLC";
    case "corporation": return stateOfIncorporation ? `${stateOfIncorporation} Corporation` : "Corporation";
    case "partnership": return "Partnership";
    case "sole_proprietorship": return ownerName || "Sole Proprietorship";
    case "business_license": return issuingAuthority || licenseType || "Business License";
    case "tax_document": return taxYear ? `Tax Year ${taxYear}` : "Tax Document";
    default: return "";
  }
}

export function BusinessItemCard({ item, categorySlug }: BusinessItemCardProps) {
  const sub = item.subcategory;
  const ein = getFieldValue(item, "ein");
  const formationDate = getFieldValue(item, "formation_date");
  const registeredAgent = getFieldValue(item, "registered_agent");
  const startDate = getFieldValue(item, "start_date");
  const endDate = getFieldValue(item, "end_date");
  const licenseNumber = getFieldValue(item, "license_number");
  const issueDate = getFieldValue(item, "issue_date");
  const expirationDate = getFieldValue(item, "expiration_date");
  const policyNumber = getFieldValue(item, "policy_number");
  const premium = getFieldValue(item, "premium");
  const documentType = getFieldValue(item, "document_type");
  const businessName = getFieldValue(item, "business_name");

  return (
    <ItemCardShell item={item} categorySlug={categorySlug} subtitle={getBusinessSubtitle(item)}>
      {/* Left column */}
      <div className="space-y-1.5">
        {(sub === "llc" || sub === "corporation" || sub === "partnership") && (
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
                  {sub === "corporation" ? "Incorporated" : "Formed"}
                </p>
                <p className="text-xs text-gray-700">{formatDate(formationDate)}</p>
              </div>
            )}
          </>
        )}

        {sub === "sole_proprietorship" && (
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

        {sub === "business_license" && (
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

        {BIZ_INSURANCE_TYPES.has(sub) && (
          <>
            {policyNumber && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Policy</p>
                <p className="text-xs text-gray-700 font-mono">{policyNumber}</p>
              </div>
            )}
          </>
        )}

        {sub === "tax_document" && (
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

      {/* Right column */}
      <div className="space-y-1.5 text-right">
        {(sub === "llc" || sub === "corporation") && registeredAgent && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Registered Agent</p>
            <p className="text-xs text-gray-700 line-clamp-2">{registeredAgent}</p>
          </div>
        )}

        {BIZ_INSURANCE_TYPES.has(sub) && premium && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Premium</p>
            <p className="text-xs text-gray-700 font-semibold">
              ${parseFloat(premium).toLocaleString()}/yr
            </p>
          </div>
        )}

        {BIZ_INSURANCE_TYPES.has(sub) && (startDate || endDate) && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Period</p>
            <p className="text-xs text-gray-700">
              {startDate && formatDate(startDate)}
              {startDate && endDate && " - "}
              {endDate && formatDate(endDate)}
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
    </ItemCardShell>
  );
}
