/**
 * SavedContactSelector.tsx — Inline saved contact selector for linking contacts to items.
 *
 * Thin wrapper around SearchableSelector<SavedContact>.
 * Used in the RightSidebar "Linked Contacts" section to search + link global contacts.
 */
"use client";

import { BookUser } from "lucide-react";
import { api } from "@/lib/api";
import type { SavedContact } from "@/lib/api";
import { SearchableSelector } from "./SearchableSelector";

interface SavedContactSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SavedContactSelector({ value, onChange, placeholder, className }: SavedContactSelectorProps) {
  return (
    <SearchableSelector<SavedContact>
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Select contact..."}
      className={className}
      fetchItems={() => api.savedContacts.list()}
      filterItems={(items, q) =>
        items.filter((c) => {
          const name = c.name.toLowerCase();
          return (
            name.includes(q) ||
            (c.company?.toLowerCase().includes(q) ?? false) ||
            (c.role?.toLowerCase().includes(q) ?? false)
          );
        })
      }
      getKey={(c) => c.id}
      getDisplayLabel={(c) => c.name}
      getValue={(c) => c.id}
      getSubtext={(c) => {
        if (c.role && c.company) return `${c.role} at ${c.company}`;
        return c.role || c.company || null;
      }}
      icon={BookUser}
      searchPlaceholder="Search contacts..."
      emptyLabel="No contacts yet"
      searchEmptyLabel="No contacts found"
      createConfig={{
        title: "Create New Contact",
        fields: [
          { key: "name", label: "Name", placeholder: "Jane Smith", required: true },
          { key: "company", label: "Company", placeholder: "Smith & Associates", required: false },
          { key: "role", label: "Role", placeholder: "Accountant", required: false },
        ],
        helpText: "You can add more details (email, phone, etc.) in the Contacts section later.",
        onCreate: async (values) => {
          const contact = await api.savedContacts.create({
            name: values.name,
            company: values.company || null,
            role: values.role || null,
          });
          return contact.id;
        },
      }}
    />
  );
}
