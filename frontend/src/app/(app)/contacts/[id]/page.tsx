"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, BookUser, Check, ChevronsUpDown, Loader2, Pencil, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { SavedContact } from "@/lib/api";
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

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [contactId, setContactId] = useState<string | null>(null);
  const [contact, setContact] = useState<SavedContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  // Unwrap params Promise and fetch contact
  useEffect(() => {
    let mounted = true;

    const loadContact = async () => {
      setLoading(true);
      try {
        const { id } = await params;
        setContactId(id);

        const data = await api.savedContacts.get(id);
        if (!mounted) return;

        setContact(data);
        // Initialize form
        setName(data.name);
        setCompany(data.company || "");
        setRole(data.role || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setWebsite(data.website || "");
        setAddress(data.address || "");
        setNotes(data.notes || "");
      } catch (err) {
        console.error("Failed to fetch contact:", err);
        router.push("/contacts");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadContact();

    return () => {
      mounted = false;
    };
  }, [params, router]);

  const handleSave = async () => {
    if (!contactId || !name.trim()) {
      setError("Name is required.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const updated = await api.savedContacts.update(contactId, {
        name: name.trim(),
        company: company.trim() || null,
        role: role.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      setContact(updated);
      setEditing(false);
    } catch (err) {
      console.error("Failed to update contact:", err);
      setError("Failed to update contact. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contactId) return;
    setDeleting(true);
    try {
      await api.savedContacts.delete(contactId);
      router.push("/contacts");
    } catch (err) {
      console.error("Failed to delete contact:", err);
      setError("Failed to delete contact. Please try again.");
      setDeleting(false);
    }
  };

  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return n.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
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
              <h1 className="text-2xl font-bold text-gray-900">
                {contact.name}
              </h1>
              <p className="text-sm text-gray-600">
                {contact.role || "Contact"}
                {contact.company && ` at ${contact.company}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {contact.name}? This will
                      also remove the contact from all linked items. This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleting && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Avatar Card */}
          <Card>
            <CardContent className="p-6">
              <div className="aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4">
                <span className="text-6xl font-bold text-white">
                  {getInitials(contact.name)}
                </span>
              </div>
              {contact.phone && (
                <p className="text-sm text-gray-600 text-center">{contact.phone}</p>
              )}
              {contact.email && (
                <p className="text-sm text-gray-600 text-center truncate">{contact.email}</p>
              )}
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {editing ? "Edit Information" : "Information"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {editing ? (
                <>
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
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
                      rows={3}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        // Reset form
                        setName(contact.name);
                        setCompany(contact.company || "");
                        setRole(contact.role || "");
                        setEmail(contact.email || "");
                        setPhone(contact.phone || "");
                        setWebsite(contact.website || "");
                        setAddress(contact.address || "");
                        setNotes(contact.notes || "");
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* View mode */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-600">Company</p>
                      <p className="text-base text-gray-900">
                        {contact.company || "\u2014"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Role</p>
                      <p className="text-base text-gray-900">
                        {contact.role || "\u2014"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="text-base text-gray-900">
                        {contact.email || "\u2014"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="text-base text-gray-900">
                        {contact.phone || "\u2014"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Website</p>
                      <p className="text-base text-gray-900">
                        {contact.website ? (
                          <a
                            href={contact.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {contact.website}
                          </a>
                        ) : (
                          "\u2014"
                        )}
                      </p>
                    </div>
                  </div>
                  {contact.address && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Address</p>
                      <p className="text-base text-gray-900 whitespace-pre-wrap">
                        {contact.address}
                      </p>
                    </div>
                  )}
                  {contact.notes && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Notes</p>
                      <p className="text-base text-gray-900 whitespace-pre-wrap">
                        {contact.notes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
