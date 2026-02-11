/**
 * PassportSelector.tsx — Inline passport selector for visa passport_number field.
 *
 * Thin wrapper around SearchableSelector<Item>.
 * Stores the passport_number (not the full display string).
 */
"use client";

import { Plane } from "lucide-react";
import { api } from "@/lib/api";
import type { Item } from "@/lib/api";
import { getFieldValue } from "@/lib/format";
import { SearchableSelector } from "./SearchableSelector";

interface PassportSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function passportDisplayLabel(item: Item): string {
  const fullName = getFieldValue(item, "full_name");
  const passportNumber = getFieldValue(item, "passport_number");
  if (fullName && passportNumber) return `${fullName} - ${passportNumber}`;
  return passportNumber || fullName || item.name || "Unnamed Passport";
}

export function PassportSelector({ value, onChange, placeholder, className }: PassportSelectorProps) {
  return (
    <SearchableSelector<Item>
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Select passport..."}
      className={className}
      fetchItems={async () => {
        const data = await api.items.list({ category: "ids", subcategory: "passport" });
        return data.items;
      }}
      filterItems={(items, q) =>
        items.filter((p) => passportDisplayLabel(p).toLowerCase().includes(q))
      }
      getKey={(item) => item.id}
      getDisplayLabel={passportDisplayLabel}
      getValue={(item) => getFieldValue(item, "passport_number") || ""}
      icon={Plane}
      searchPlaceholder="Search passports..."
      emptyLabel="No passports yet"
      searchEmptyLabel="No passports found"
      createConfig={{
        title: "Create New Passport",
        fields: [
          { key: "full_name", label: "Full Name", placeholder: "John Doe", required: true },
          { key: "passport_number", label: "Passport Number", placeholder: "123456789", required: true },
        ],
        helpText: "You can add more details (country, dates, etc.) in the Family IDs section later.",
        onCreate: async (values) => {
          await api.items.create({
            category: "ids",
            subcategory: "passport",
            name: `${values.full_name} - Passport`,
            fields: [
              { field_key: "full_name", field_value: values.full_name },
              { field_key: "passport_number", field_value: values.passport_number },
            ],
          });
          return values.passport_number;
        },
      }}
    />
  );
}
