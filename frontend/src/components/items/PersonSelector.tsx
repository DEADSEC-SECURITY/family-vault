/**
 * PersonSelector.tsx — Inline person selector for beneficiary/insured person fields.
 *
 * Replaces text inputs with a searchable dropdown that lets you:
 *   - Select an existing person from your org
 *   - Create a new person on the fly
 *   - Clear the selection
 *
 * Used for fields like "Primary Beneficiary", "Contingent Beneficiary", "Insured Person", etc.
 */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { Person } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PersonSelectorProps {
  value: string; // Person name (for display)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PersonSelector({
  value,
  onChange,
  placeholder = "Select person...",
  className,
}: PersonSelectorProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.people.list();
      setPeople(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPeople();
    }
  }, [open, fetchPeople]);

  const filtered = people.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    return fullName.includes(q) || (p.relationship && p.relationship.toLowerCase().includes(q));
  });

  const handleSelect = (person: Person) => {
    onChange(`${person.first_name} ${person.last_name}`);
    setOpen(false);
    setSearchQuery("");
  };

  const handleCreate = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) return;
    setCreating(true);
    try {
      const person = await api.people.create({
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
      });
      onChange(`${person.first_name} ${person.last_name}`);
      setNewFirstName("");
      setNewLastName("");
      setShowCreateForm(false);
      setOpen(false);
      setSearchQuery("");
      fetchPeople();
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
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        {!showCreateForm ? (
          <>
            {/* Search */}
            <div className="p-2 border-b">
              <Input
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>

            {/* People list */}
            <div className="max-h-[300px] overflow-y-auto p-1">
              {loading ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  {searchQuery ? "No people found" : "No people yet"}
                </div>
              ) : (
                filtered.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm hover:bg-gray-100 transition-colors",
                      value === `${person.first_name} ${person.last_name}` && "bg-blue-50"
                    )}
                    onClick={() => handleSelect(person)}
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">
                        {person.first_name} {person.last_name}
                      </div>
                      {person.relationship && (
                        <div className="text-xs text-gray-500">
                          {person.relationship}
                        </div>
                      )}
                    </div>
                    {value === `${person.first_name} ${person.last_name}` && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                ))
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
            <p className="text-sm font-medium text-gray-700">Create New Person</p>
            <div>
              <Label className="text-xs text-gray-500">
                First Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="John"
                className="mt-1 h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFirstName.trim() && newLastName.trim()) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">
                Last Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="Doe"
                className="mt-1 h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFirstName.trim() && newLastName.trim()) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
            </div>
            <p className="text-xs text-gray-500">
              You can add more details (email, phone, etc.) in the People section later.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewFirstName("");
                  setNewLastName("");
                }}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={!newFirstName.trim() || !newLastName.trim() || creating}
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
