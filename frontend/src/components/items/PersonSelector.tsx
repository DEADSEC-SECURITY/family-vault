/**
 * PersonSelector.tsx — Inline person selector for beneficiary/insured person fields.
 *
 * Thin wrapper around SearchableSelector<Person>.
 * Used for fields like "Primary Beneficiary", "Contingent Beneficiary", "Insured Person".
 */
"use client";

import { User } from "lucide-react";
import { api } from "@/lib/api";
import type { Person } from "@/lib/api";
import { SearchableSelector } from "./SearchableSelector";

interface PersonSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const personName = (p: Person) => `${p.first_name} ${p.last_name}`;

export function PersonSelector({ value, onChange, placeholder, className }: PersonSelectorProps) {
  return (
    <SearchableSelector<Person>
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Select person..."}
      className={className}
      fetchItems={() => api.people.list()}
      filterItems={(items, q) =>
        items.filter((p) => {
          const name = personName(p).toLowerCase();
          return name.includes(q) || (p.relationship?.toLowerCase().includes(q) ?? false);
        })
      }
      getKey={(p) => p.id}
      getDisplayLabel={personName}
      getValue={personName}
      getSubtext={(p) => p.relationship}
      icon={User}
      searchPlaceholder="Search people..."
      emptyLabel="No people yet"
      searchEmptyLabel="No people found"
      createConfig={{
        title: "Create New Person",
        fields: [
          { key: "first_name", label: "First Name", placeholder: "John", required: true },
          { key: "last_name", label: "Last Name", placeholder: "Doe", required: true },
        ],
        helpText: "You can add more details (email, phone, etc.) in the People section later.",
        onCreate: async (values) => {
          const person = await api.people.create({
            first_name: values.first_name,
            last_name: values.last_name,
          });
          return personName(person);
        },
      }}
    />
  );
}
