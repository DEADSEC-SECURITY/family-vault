import type { Item } from "@/lib/api";

/**
 * Shared formatting utilities used across the application.
 */

/** Replace underscores with spaces: "auto_insurance" → "auto insurance" */
export function humanize(str: string): string {
  return str.replace(/_/g, " ");
}

/** Replace underscores with spaces and capitalize first letter of each word */
export function titleCase(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a date string to locale display: "Jan 15, 2025" */
export function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** Get a field value from an item's EAV fields by key */
export function getFieldValue(item: Item, fieldKey: string): string | null {
  const field = item.fields.find((f) => f.field_key === fieldKey);
  return field?.field_value || null;
}

/** Repeat frequency options for reminders */
export const REPEAT_OPTIONS = [
  { value: "none", label: "Don't repeat" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Every year" },
] as const;

/** Get human-readable label for a repeat frequency value */
export function repeatLabel(val: string | null | undefined): string | null {
  if (!val || val === "none") return null;
  return REPEAT_OPTIONS.find((o) => o.value === val)?.label ?? val;
}
