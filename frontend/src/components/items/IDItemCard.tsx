import type { Item } from "@/lib/api";
import { formatDate, getFieldValue } from "@/lib/format";
import { ItemCardShell } from "./ItemCardShell";

interface IDItemCardProps {
  item: Item;
  categorySlug: string;
}

export function IDItemCard({ item, categorySlug }: IDItemCardProps) {
  const state = getFieldValue(item, "state");
  const country = getFieldValue(item, "country");
  const issueDate = getFieldValue(item, "issue_date");
  const expirationDate = getFieldValue(item, "expiration_date");
  const dateOfBirth = getFieldValue(item, "date_of_birth");
  const placeOfBirth = getFieldValue(item, "place_of_birth");
  const visaType = getFieldValue(item, "visa_type");
  const entryType = getFieldValue(item, "entry_type");
  const idType = getFieldValue(item, "id_type");
  const issuingBody = getFieldValue(item, "issuing_body");

  // Determine primary ID number and label based on subcategory
  let primaryNumber: string | null = null;
  let primaryLabel = "";
  const sub = item.subcategory;

  if (sub === "drivers_license") {
    primaryNumber = getFieldValue(item, "license_number");
    primaryLabel = "License";
  } else if (sub === "passport") {
    primaryNumber = getFieldValue(item, "passport_number");
    primaryLabel = "Passport";
  } else if (sub === "visa") {
    primaryNumber = getFieldValue(item, "visa_number");
    primaryLabel = "Visa";
  } else if (sub === "social_security") {
    const ssn = getFieldValue(item, "ssn");
    primaryNumber = ssn && ssn.length >= 4 ? "•••-••-" + ssn.slice(-4) : ssn;
    primaryLabel = "SSN";
  } else if (sub === "birth_certificate") {
    primaryNumber = getFieldValue(item, "certificate_number");
    primaryLabel = "Certificate";
  } else if (sub === "custom_id") {
    primaryNumber = getFieldValue(item, "id_number");
    primaryLabel = "ID Number";
  }

  return (
    <ItemCardShell item={item} categorySlug={categorySlug} subtitle={state || country}>
      {/* Left column */}
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
        {placeOfBirth && sub === "birth_certificate" && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Place of Birth</p>
            <p className="text-xs text-gray-700 line-clamp-1">{placeOfBirth}</p>
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-1.5 text-right">
        {dateOfBirth && (sub === "drivers_license" || sub === "birth_certificate") && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">
              {sub === "birth_certificate" ? "Date of Birth" : "Born"}
            </p>
            <p className="text-xs text-gray-700">{formatDate(dateOfBirth)}</p>
          </div>
        )}
        {country && sub === "passport" && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Nationality</p>
            <p className="text-xs text-gray-700">{country}</p>
          </div>
        )}
        {visaType && sub === "visa" && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Type</p>
            <p className="text-xs text-gray-700">{visaType}</p>
          </div>
        )}
        {entryType && sub === "visa" && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Entry</p>
            <p className="text-xs text-gray-700">{entryType}</p>
          </div>
        )}
        {idType && sub === "custom_id" && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Type</p>
            <p className="text-xs text-gray-700">{idType}</p>
          </div>
        )}
        {issuingBody && sub === "custom_id" && (
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
    </ItemCardShell>
  );
}
