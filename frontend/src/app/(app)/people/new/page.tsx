"use client";

import React, { useState } from "react";
import { ArrowLeft, Check, ChevronsUpDown, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_RELATIONSHIPS = [
  "Spouse",
  "Partner",
  "Child",
  "Son",
  "Daughter",
  "Parent",
  "Mother",
  "Father",
  "Sibling",
  "Brother",
  "Sister",
  "Grandparent",
  "Grandmother",
  "Grandfather",
  "Grandchild",
  "Grandson",
  "Granddaughter",
  "Aunt",
  "Uncle",
  "Niece",
  "Nephew",
  "Cousin",
  "Friend",
  "Guardian",
  "Dependent",
];

export default function NewPersonPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [relationship, setRelation] = useState("");
  const [notes, setNotes] = useState("");
  const [canLogin, setCanLogin] = useState(false);

  // Relationship combobox state
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [relationshipSearch, setRelationshipSearch] = useState("");

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const person = await api.people.create({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth || null,
        relationship: relationship.trim() || null,
        notes: notes.trim() || null,
        can_login: canLogin,
      });
      router.push(`/people/${person.id}`);
    } catch (err) {
      console.error("Failed to create person:", err);
      setError("Failed to create person. Please try again.");
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
          aria-label="Back to people"
          onClick={() => router.push("/people")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <User className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Person</h1>
            <p className="text-sm text-gray-600">
              Create a new family member or beneficiary profile
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
            <CardTitle>Person Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
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
            </div>

            {/* Date of Birth & Relation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <Popover open={relationshipOpen} onOpenChange={setRelationshipOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={relationshipOpen}
                      className="w-full justify-between font-normal"
                    >
                      {relationship || "Select relationship..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search or type custom..."
                        value={relationshipSearch}
                        onChange={(e) => setRelationshipSearch(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      {DEFAULT_RELATIONSHIPS.filter((rel) =>
                        rel.toLowerCase().includes(relationshipSearch.toLowerCase())
                      ).map((rel) => (
                        <button
                          key={rel}
                          type="button"
                          className={cn(
                            "relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors",
                            relationship === rel && "bg-blue-50"
                          )}
                          onClick={() => {
                            setRelation(rel);
                            setRelationshipOpen(false);
                            setRelationshipSearch("");
                          }}
                        >
                          {rel}
                          {relationship === rel && (
                            <Check className="ml-auto h-4 w-4 text-blue-600" />
                          )}
                        </button>
                      ))}
                      {relationshipSearch &&
                        !DEFAULT_RELATIONSHIPS.some(
                          (rel) => rel.toLowerCase() === relationshipSearch.toLowerCase()
                        ) && (
                          <button
                            type="button"
                            className="relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors border-t"
                            onClick={() => {
                              setRelation(relationshipSearch);
                              setRelationshipOpen(false);
                              setRelationshipSearch("");
                            }}
                          >
                            <span className="text-blue-600">+ Add &quot;{relationshipSearch}&quot;</span>
                          </button>
                        )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
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

            {/* Login Access */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="canLogin"
                checked={canLogin}
                onCheckedChange={(checked) => setCanLogin(checked === true)}
              />
              <Label htmlFor="canLogin" className="cursor-pointer">
                Allow this person to login and manage documents
              </Label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/people")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Person
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
