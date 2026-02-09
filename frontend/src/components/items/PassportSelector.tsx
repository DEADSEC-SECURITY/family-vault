/**
 * PassportSelector.tsx — Inline passport selector for visa passport_number field.
 *
 * Replaces text input with a searchable dropdown that lets you:
 *   - Select an existing passport from your org
 *   - Create a new passport on the fly
 *   - Clear the selection
 *
 * Stores the passport_number (not the full display string).
 */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus, Plane, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { Item } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PassportSelectorProps {
  value: string; // Passport number (for storage)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PassportSelector({
  value,
  onChange,
  placeholder = "Select passport...",
  className,
}: PassportSelectorProps) {
  const [passports, setPassports] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newFullName, setNewFullName] = useState("");
  const [newPassportNumber, setNewPassportNumber] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPassports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.items.list({ category: "ids", subcategory: "passport" });
      setPassports(data.items);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPassports();
    }
  }, [open, fetchPassports]);

  const getPassportField = (passport: Item, fieldKey: string): string => {
    const field = passport.fields?.find((f) => f.field_key === fieldKey);
    return field?.field_value || "";
  };

  const getDisplayLabel = (passport: Item): string => {
    const fullName = getPassportField(passport, "full_name");
    const passportNumber = getPassportField(passport, "passport_number");
    if (fullName && passportNumber) {
      return `${fullName} - ${passportNumber}`;
    } else if (passportNumber) {
      return passportNumber;
    } else if (fullName) {
      return fullName;
    }
    return passport.name || "Unnamed Passport";
  };

  const filtered = passports.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const displayLabel = getDisplayLabel(p).toLowerCase();
    return displayLabel.includes(q);
  });

  // Find the currently selected passport for display
  const selectedPassport = passports.find(
    (p) => getPassportField(p, "passport_number") === value
  );
  const displayValue = selectedPassport ? getDisplayLabel(selectedPassport) : value;

  const handleSelect = (passport: Item) => {
    const passportNumber = getPassportField(passport, "passport_number");
    onChange(passportNumber);
    setOpen(false);
    setSearchQuery("");
  };

  const handleCreate = async () => {
    if (!newFullName.trim() || !newPassportNumber.trim()) return;
    setCreating(true);
    try {
      const passport = await api.items.create({
        category: "ids",
        subcategory: "passport",
        name: `${newFullName.trim()} - Passport`,
        fields: [
          { field_key: "full_name", field_value: newFullName.trim() },
          { field_key: "passport_number", field_value: newPassportNumber.trim() },
        ],
      });
      const passportNumber = getPassportField(passport, "passport_number");
      onChange(passportNumber);
      setNewFullName("");
      setNewPassportNumber("");
      setShowCreateForm(false);
      setOpen(false);
      setSearchQuery("");
      fetchPassports();
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  };

  const handleClear = () => {
    onChange("");
    setSearchQuery("");
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
            {/* Search */}
            <div className="p-2 border-b">
              <Input
                placeholder="Search passports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Passports list */}
            <div className="max-h-[300px] overflow-y-auto p-1">
              {loading ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  {searchQuery ? "No passports found" : "No passports yet"}
                </div>
              ) : (
                filtered.map((passport) => {
                  const passportNumber = getPassportField(passport, "passport_number");
                  const isSelected = passportNumber === value;
                  return (
                    <button
                      key={passport.id}
                      type="button"
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm hover:bg-gray-100 transition-colors",
                        isSelected && "bg-blue-50"
                      )}
                      onClick={() => handleSelect(passport)}
                    >
                      <Plane className="h-4 w-4 text-indigo-500" />
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">
                          {getDisplayLabel(passport)}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Actions */}
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
            </div>
          </>
        ) : (
          /* Create form */
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Create New Passport</p>
            <div>
              <Label className="text-xs text-gray-500">
                Full Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="John Doe"
                className="mt-1 h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFullName.trim() && newPassportNumber.trim()) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">
                Passport Number <span className="text-red-400">*</span>
              </Label>
              <Input
                value={newPassportNumber}
                onChange={(e) => setNewPassportNumber(e.target.value)}
                placeholder="123456789"
                className="mt-1 h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFullName.trim() && newPassportNumber.trim()) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
            </div>
            <p className="text-xs text-gray-500">
              You can add more details (country, dates, etc.) in the Family IDs section later.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewFullName("");
                  setNewPassportNumber("");
                }}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={!newFullName.trim() || !newPassportNumber.trim() || creating}
                className="ml-auto text-xs"
              >
                {creating ? "Creating..." : "Create & Select"}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
