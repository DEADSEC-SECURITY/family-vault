"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronsUpDown, Copy, Loader2, Mail, Pencil, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Person } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PersonStatusBadge } from "@/components/people/PersonStatusBadge";

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

export default function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [personId, setPersonId] = useState<string | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Current user (to prevent self-deletion)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Copy invite link state
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  // Unwrap params Promise and fetch person
  useEffect(() => {
    let mounted = true;

    const loadPerson = async () => {
      setLoading(true);
      try {
        const { id } = await params;
        setPersonId(id);

        const data = await api.people.get(id);
        if (!mounted) return;

        setPerson(data);
        // Fetch current user to prevent self-deletion
        try {
          const me = await api.auth.me();
          if (mounted) setCurrentUserId(me.id);
        } catch {
          // ignore
        }
        // Initialize form
        setFirstName(data.first_name);
        setLastName(data.last_name);
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setDateOfBirth(data.date_of_birth || "");
        setRelation(data.relationship || "");
        setNotes(data.notes || "");
        setCanLogin(data.can_login);

        // Fetch invite link for invited persons
        if (data.status === "invited") {
          try {
            const linkData = await api.people.getInviteLink(id);
            if (mounted) setInviteLink(linkData.invite_url);
          } catch {
            // No active invite link — that's fine
          }
        }
      } catch (err) {
        console.error("Failed to fetch person:", err);
        router.push("/people");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPerson();

    return () => {
      mounted = false;
    };
  }, [params, router]);

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = inviteLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    if (!personId || !firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    if (canLogin && !email.trim()) {
      setError("Email is required to grant login access.");
      return;
    }

    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const updated = await api.people.update(personId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth || null,
        relationship: relationship.trim() || null,
        notes: notes.trim() || null,
        can_login: canLogin,
      });
      setPerson(updated);
      setEditing(false);
      if (updated.status === "invited" && !person?.can_login && canLogin) {
        setSuccess(`Invitation sent to ${updated.email}`);
      }
      // Refresh invite link if person is now invited
      if (updated.status === "invited") {
        try {
          const linkData = await api.people.getInviteLink(personId);
          setInviteLink(linkData.invite_url);
        } catch {
          setInviteLink(null);
        }
      } else {
        setInviteLink(null);
      }
    } catch (err) {
      console.error("Failed to update person:", err);
      setError(err instanceof Error ? err.message : "Failed to update person. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResendInvite = async () => {
    if (!personId) return;
    setResending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.people.resendInvite(personId);
      setSuccess(result.message);
      // Refresh invite link after resend (new token)
      try {
        const linkData = await api.people.getInviteLink(personId);
        setInviteLink(linkData.invite_url);
      } catch {
        // ignore
      }
    } catch (err) {
      console.error("Failed to resend invite:", err);
      setError(err instanceof Error ? err.message : "Failed to resend invitation.");
    } finally {
      setResending(false);
    }
  };

  const handleDelete = async () => {
    if (!personId) return;
    setDeleting(true);
    try {
      await api.people.delete(personId);
      router.push("/people");
    } catch (err) {
      console.error("Failed to delete person:", err);
      setError("Failed to delete person. Please try again.");
      setDeleting(false);
    }
  };

  const getInitials = (first: string, last: string) => {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!person) {
    return null;
  }

  const isSelf = !!(currentUserId && person.user_id && currentUserId === person.user_id);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
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
              <h1 className="text-2xl font-bold text-gray-900">
                {person.first_name} {person.last_name}
              </h1>
              <p className="text-sm text-gray-600">
                {person.relationship || "Family member"}
                {isSelf && " · Self"}
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
              {!isSelf && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Person?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {person.first_name}{" "}
                        {person.last_name}? This action cannot be undone.
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
              )}
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
        {success && (
          <div className="mb-4 p-3 rounded-md bg-green-50 text-green-700 text-sm">
            {success}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {/* Profile Header */}
            <div className="flex items-center gap-5 p-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                {person.photo_url ? (
                  <img
                    src={person.photo_url}
                    alt={`${person.first_name} ${person.last_name}`}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {getInitials(person.first_name, person.last_name)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-gray-900">
                  {person.first_name} {person.last_name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {person.relationship && (
                    <span className="text-sm text-gray-500">{person.relationship}</span>
                  )}
                  {person.relationship && person.status !== "none" && (
                    <span className="text-gray-300">&middot;</span>
                  )}
                  {person.status !== "none" && (
                    <PersonStatusBadge status={person.status} />
                  )}
                </div>
                {person.status === "invited" && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResendInvite}
                      disabled={resending}
                    >
                      {resending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Resend Invite
                    </Button>
                    {inviteLink && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyInviteLink}
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {copied ? "Copied!" : "Copy Invite Link"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="border-t" />

            {/* Details */}
            <div className="p-6">
              {editing ? (
                <div className="space-y-6">
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
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
                      rows={3}
                    />
                  </div>

                  {/* Login Access */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="canLogin"
                        checked={canLogin}
                        onCheckedChange={(checked) =>
                          setCanLogin(checked === true)
                        }
                      />
                      <Label htmlFor="canLogin" className="cursor-pointer">
                        Allow this person to login and manage documents
                      </Label>
                    </div>
                    {canLogin && !email.trim() && (
                      <p className="text-sm text-amber-600 ml-6">
                        Email is required to send an invitation
                      </p>
                    )}
                    {canLogin && email.trim() && !person.can_login && !person.user_id && (
                      <p className="text-sm text-blue-600 ml-6">
                        An invitation email will be sent to {email.trim()}
                      </p>
                    )}
                    {!canLogin && person.user_id && (
                      <p className="text-sm text-amber-600 ml-6">
                        This will deactivate their login access
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        setError(null);
                        setSuccess(null);
                        // Reset form
                        setFirstName(person.first_name);
                        setLastName(person.last_name);
                        setEmail(person.email || "");
                        setPhone(person.phone || "");
                        setDateOfBirth(person.date_of_birth || "");
                        setRelation(person.relationship || "");
                        setNotes(person.notes || "");
                        setCanLogin(person.can_login);
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
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Email</p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {person.email || "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Phone</p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {person.phone || "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Date of Birth</p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {person.date_of_birth || "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Relationship</p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {person.relationship || "\u2014"}
                    </p>
                  </div>
                  {person.notes && (
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-gray-500">Notes</p>
                      <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">
                        {person.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
