"use client";

import React, { useState } from "react";
import { ArrowLeft, BookUser, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_ROLES = [
  "Accountant",
  "Attorney",
  "Insurance Agent",
  "Financial Advisor",
  "Realtor",
  "Banker",
  "Doctor",
  "Dentist",
  "Veterinarian",
  "Mechanic",
  "Contractor",
];

export default function NewContactPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Role combobox state
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const contact = await api.savedContacts.create({
        name: name.trim(),
        company: company.trim() || null,
        role: role.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      router.push(`/contacts/${contact.id}`);
    } catch (err) {
      console.error("Failed to create contact:", err);
      setError("Failed to create contact. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to contacts"
          onClick={() => router.push("/contacts")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <BookUser className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Contact</h1>
            <p className="text-sm text-gray-600">
              Create a new professional contact
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name & Company */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Smith & Associates"
                />
              </div>
            </div>

            {/* Role & Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={roleOpen}
                      className="w-full justify-between font-normal"
                    >
                      {role || "Select role..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search or type custom..."
                        value={roleSearch}
                        onChange={(e) => setRoleSearch(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      {DEFAULT_ROLES.filter((r) =>
                        r.toLowerCase().includes(roleSearch.toLowerCase())
                      ).map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={cn(
                            "relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors",
                            role === r && "bg-blue-50"
                          )}
                          onClick={() => {
                            setRole(r);
                            setRoleOpen(false);
                            setRoleSearch("");
                          }}
                        >
                          {r}
                          {role === r && (
                            <Check className="ml-auto h-4 w-4 text-blue-600" />
                          )}
                        </button>
                      ))}
                      {roleSearch &&
                        !DEFAULT_ROLES.some(
                          (r) => r.toLowerCase() === roleSearch.toLowerCase()
                        ) && (
                          <button
                            type="button"
                            className="relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors border-t"
                            onClick={() => {
                              setRole(roleSearch);
                              setRoleOpen(false);
                              setRoleSearch("");
                            }}
                          >
                            <span className="text-blue-600">+ Add &quot;{roleSearch}&quot;</span>
                          </button>
                        )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            {/* Phone & Website */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Suite 100&#10;City, State 12345"
                rows={2}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional information..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/contacts")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Contact
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
