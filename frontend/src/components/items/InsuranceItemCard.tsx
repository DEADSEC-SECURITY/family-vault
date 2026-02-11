import type { Item } from "@/lib/api";
import { formatDate, getFieldValue } from "@/lib/format";
import { ItemCardShell } from "./ItemCardShell";

interface InsuranceItemCardProps {
  item: Item;
  categorySlug: string;
}

function calculateAnnualPremium(
  premiumStr: string | null,
  startDateStr: string | null,
  endDateStr: string | null,
): string | null {
  if (!premiumStr || !startDateStr || !endDateStr) return null;
  try {
    const premium = parseFloat(premiumStr);
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const monthsDiff =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      (endDate.getDate() - startDate.getDate()) / 30;
    if (monthsDiff <= 0) return null;
    const annualPremium = (premium / monthsDiff) * 12;
    return annualPremium.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } catch {
    return null;
  }
}

export function InsuranceItemCard({ item, categorySlug }: InsuranceItemCardProps) {
  const provider = getFieldValue(item, "provider");
  const startDate = getFieldValue(item, "start_date");
  const endDate = getFieldValue(item, "end_date");
  const propertyAddress = getFieldValue(item, "property_address");
  const policyNumber = getFieldValue(item, "policy_number");
  const premium = getFieldValue(item, "premium");

  const isPropertyInsurance =
    item.subcategory === "home_insurance" || item.subcategory === "renters_insurance";

  return (
    <ItemCardShell item={item} categorySlug={categorySlug} subtitle={provider}>
      {/* Left column */}
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

      {/* Right column */}
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
    </ItemCardShell>
  );
}
