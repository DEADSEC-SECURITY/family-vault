/**
 * SearchableSelector.tsx — Generic searchable dropdown with optional create form.
 *
 * Shared base component used by PersonSelector and PassportSelector.
 * Provides: Popover trigger, search input, filtered list, clear, and optional create form.
 *
 * ProviderCombobox is NOT built on this — it has fundamentally different UX
 * (inline input, server-side search, keyboard navigation, free-text entry).
 */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CreateField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}

interface CreateConfig {
  title: string;
  fields: CreateField[];
  submitLabel?: string;
  helpText?: string;
  /** Called with trimmed form values. Must return the string value to select. */
  onCreate: (values: Record<string, string>) => Promise<string>;
}

interface SearchableSelectorProps<T> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;

  /** Fetch the full list of selectable items. Called each time the popover opens. */
  fetchItems: () => Promise<T[]>;
  /** Client-side filter. Receives lowercase query. */
  filterItems: (items: T[], query: string) => T[];
  /** Unique key for React list rendering. */
  getKey: (item: T) => string;
  /** Display label shown in the list and trigger button. */
  getDisplayLabel: (item: T) => string;
  /** The string value stored on selection (may differ from display). */
  getValue: (item: T) => string;
  /** Optional secondary text below the label. */
  getSubtext?: (item: T) => string | null;
  /** Icon shown next to each list item. */
  icon: React.ComponentType<{ className?: string }>;

  searchPlaceholder?: string;
  emptyLabel?: string;
  searchEmptyLabel?: string;

  /** If provided, shows a "Create New" button that opens an inline form. */
  createConfig?: CreateConfig;
}

export function SearchableSelector<T>({
  value,
  onChange,
  placeholder = "Select...",
  className,
  fetchItems,
  filterItems,
  getKey,
  getDisplayLabel,
  getValue,
  getSubtext,
  icon: Icon,
  searchPlaceholder = "Search...",
  emptyLabel = "No items yet",
  searchEmptyLabel = "No results found",
  createConfig,
}: SearchableSelectorProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const doFetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchItems();
      setItems(data);
    } catch {
      // silently fail — list stays empty
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) {
      doFetch();
      setShowCreateForm(false);
      setSearchQuery("");
    }
  }, [open, doFetch]);

  const filtered = searchQuery.trim()
    ? filterItems(items, searchQuery.toLowerCase())
    : items;

  // Resolve display label for the current value
  const selectedItem = items.find((item) => getValue(item) === value);
  const displayValue = selectedItem ? getDisplayLabel(selectedItem) : value;

  const handleSelect = (item: T) => {
    onChange(getValue(item));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
  };

  const canSubmitCreate = createConfig?.fields
    .filter((f) => f.required)
    .every((f) => createValues[f.key]?.trim());

  const handleCreate = async () => {
    if (!createConfig || !canSubmitCreate) return;
    setCreating(true);
    try {
      const trimmed: Record<string, string> = {};
      for (const [k, v] of Object.entries(createValues)) {
        trimmed[k] = v.trim();
      }
      const selectedValue = await createConfig.onCreate(trimmed);
      onChange(selectedValue);
      setCreateValues({});
      setShowCreateForm(false);
      setOpen(false);
      doFetch();
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-10",
            !value && "text-gray-500",
            className
          )}
        >
          {displayValue || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        {!showCreateForm ? (
          <>
            {/* Search input */}
            <div className="p-2 border-b">
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Item list */}
            <div className="max-h-[300px] overflow-y-auto p-1">
              {loading ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  {searchQuery ? searchEmptyLabel : emptyLabel}
                </div>
              ) : (
                filtered.map((item) => {
                  const itemValue = getValue(item);
                  const isSelected = itemValue === value;
                  const subtext = getSubtext?.(item);
                  return (
                    <button
                      key={getKey(item)}
                      type="button"
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm hover:bg-gray-100 transition-colors",
                        isSelected && "bg-blue-50"
                      )}
                      onClick={() => handleSelect(item)}
                    >
                      <Icon className="h-4 w-4 text-gray-400" />
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">
                          {getDisplayLabel(item)}
                        </div>
                        {subtext && (
                          <div className="text-xs text-gray-500">{subtext}</div>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Action footer */}
            <div className="border-t p-2 flex gap-2">
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-xs flex-1"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
              {createConfig && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                  className="text-xs flex-1"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create New
                </Button>
              )}
            </div>
          </>
        ) : createConfig ? (
          /* Inline create form */
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">{createConfig.title}</p>
            {createConfig.fields.map((field) => (
              <div key={field.key}>
                <Label className="text-xs text-gray-500">
                  {field.label}
                  {field.required && <span className="text-red-400"> *</span>}
                </Label>
                <Input
                  value={createValues[field.key] || ""}
                  onChange={(e) =>
                    setCreateValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="mt-1 h-9 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmitCreate) {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
              </div>
            ))}
            {createConfig.helpText && (
              <p className="text-xs text-gray-500">{createConfig.helpText}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateValues({});
                }}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={!canSubmitCreate || creating}
                className="ml-auto text-xs"
              >
                {creating ? "Creating..." : (createConfig.submitLabel || "Create & Select")}
              </Button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
