"use client";

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  Pencil,
  Bell,
  Building2,
  Users,
  BookUser,
  Plus,
  X,
  RefreshCw,
  Phone,
  Mail,
  Globe,
  MapPin,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api } from "@/lib/api";
import type { Reminder, ItemContact, LinkedSavedContact, LinkedPerson, LinkedParent, Item } from "@/lib/api";
import { repeatLabel } from "@/lib/format";
import ReminderEditDialog from "./ReminderEditDialog";
import { ReminderCard } from "./ReminderCard";
import { SavedContactSelector } from "./SavedContactSelector";
import { PersonSelector } from "./PersonSelector";

/* ──────────────────────── Types ──────────────────────── */

export interface PendingReminder {
  title: string;
  remind_date: string;
  note: string | null;
  repeat: string | null;
}

export interface PendingContact {
  label: string;
  value: string;
  contact_type: string;
  address_line1?: string;
  address_line2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
}

export interface RightSidebarHandle {
  getPendingReminders: () => PendingReminder[];
  getPendingContacts: () => PendingContact[];
  addContacts: (contacts: PendingContact[]) => void;
  replaceProviderContacts: (contacts: PendingContact[]) => void;
  refreshReminders: () => void;
}

/* ──────────────────────── Contact Helpers ──────────────────────── */

const CONTACT_TYPE_OPTIONS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "url", label: "Website" },
  { value: "address", label: "Address" },
] as const;

function ContactTypeIcon({ type, className }: { type: string; className?: string }) {
  const iconCls = "h-3 w-3 text-gray-400 shrink-0";
  const icon = (() => {
    switch (type) {
      case "phone": return <Phone className={iconCls} />;
      case "email": return <Mail className={iconCls} />;
      case "url": return <Globe className={iconCls} />;
      case "address": return <MapPin className={iconCls} />;
      default: return <Users className={iconCls} />;
    }
  })();
  return <span className={className}>{icon}</span>;
}

/** Format structured address fields for display */
function formatAddressLines(contact: { value?: string; address_line1?: string | null; address_line2?: string | null; address_city?: string | null; address_state?: string | null; address_zip?: string | null }): string[] {
  if (contact.address_line1 || contact.address_city || contact.address_state || contact.address_zip) {
    const lines: string[] = [];
    if (contact.address_line1) lines.push(contact.address_line1);
    if (contact.address_line2) lines.push(contact.address_line2);
    const cityState = [contact.address_city, contact.address_state].filter(Boolean).join(", ");
    const cityStateZip = [cityState, contact.address_zip].filter(Boolean).join(" ");
    if (cityStateZip) lines.push(cityStateZip);
    return lines;
  }
  if (contact.value) return [contact.value];
  return [];
}

/* ──────────────────────── Address Input ──────────────────────── */

interface AddressFields {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

function AddressInput({
  fields,
  onChange,
  className,
  inputClassName,
}: {
  fields: AddressFields;
  onChange: (fields: AddressFields) => void;
  className?: string;
  inputClassName?: string;
}) {
  const inputCls = inputClassName || "text-sm h-8 bg-white";

  function update(field: keyof AddressFields, val: string) {
    onChange({ ...fields, [field]: val });
  }

  return (
    <div className={className || "space-y-1.5"}>
      <Input
        value={fields.line1}
        onChange={(e) => update("line1", e.target.value)}
        placeholder="Address Line 1"
        className={inputCls}
      />
      <Input
        value={fields.line2}
        onChange={(e) => update("line2", e.target.value)}
        placeholder="Address Line 2"
        className={inputCls}
      />
      <div className="grid grid-cols-3 gap-1.5">
        <Input
          value={fields.city}
          onChange={(e) => update("city", e.target.value)}
          placeholder="City"
          className={`col-span-1 ${inputCls}`}
        />
        <Input
          value={fields.state}
          onChange={(e) => update("state", e.target.value)}
          placeholder="State"
          className={`col-span-1 ${inputCls}`}
        />
        <Input
          value={fields.zip}
          onChange={(e) => update("zip", e.target.value)}
          placeholder="ZIP"
          className={`col-span-1 ${inputCls}`}
        />
      </div>
    </div>
  );
}

const EMPTY_ADDRESS: AddressFields = { line1: "", line2: "", city: "", state: "", zip: "" };

const DEFAULT_CONTACT_LABELS = [
  "Customer Care",
  "TTY",
  "Prior Authorization",
  "Pharmacy Inquiry",
  "Claims",
  "Claims Address",
  "Billing",
  "Nurse Line",
  "Mental Health",
  "Dental",
  "Vision",
  "Agent",
];

const DEFAULT_PERSON_ROLES = [
  "Owner",
  "Primary Insured",
  "Beneficiary",
  "Contingent Beneficiary",
  "Policyholder",
  "Registered Agent",
  "Primary Driver",
  "Authorized User",
  "Dependent",
  "Trustee",
];

/* ──────────────────────── Right Sidebar ──────────────────────── */

interface RightSidebarProps {
  itemId?: string;
  isCreate: boolean;
  subcategoryKey?: string;
  isArchived?: boolean;
  categorySlug?: string;
}

export const RightSidebar = React.forwardRef<RightSidebarHandle, RightSidebarProps>(
  function RightSidebar({ itemId, isCreate, subcategoryKey, isArchived, categorySlug }, ref) {
    const router = useRouter();
    const [renewing, setRenewing] = useState(false);
    const [renewDialogOpen, setRenewDialogOpen] = useState(false);

    // --- Reminders state ---
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
    const [loadingReminders, setLoadingReminders] = useState(false);
    const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

    // --- Contacts state ---
    const [contacts, setContacts] = useState<ItemContact[]>([]);
    const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [contactFormOpen, setContactFormOpen] = useState(false);
    const [newContactLabel, setNewContactLabel] = useState("");
    const [newContactValue, setNewContactValue] = useState("");
    const [newContactType, setNewContactType] = useState("phone");
    const [newContactAddress, setNewContactAddress] = useState<AddressFields>({ ...EMPTY_ADDRESS });
    const [creatingContact, setCreatingContact] = useState(false);
    const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
    const labelInputRef = useRef<HTMLInputElement>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [editValue, setEditValue] = useState("");
    const [editType, setEditType] = useState("phone");
    const [editAddress, setEditAddress] = useState<AddressFields>({ ...EMPTY_ADDRESS });
    const [savingEdit, setSavingEdit] = useState(false);

    // --- Saved (global) contacts state ---
    const [savedContacts, setSavedContacts] = useState<LinkedSavedContact[]>([]);
    const [loadingSavedContacts, setLoadingSavedContacts] = useState(false);
    const [savedContactSelectorOpen, setSavedContactSelectorOpen] = useState(false);

    // --- Linked people state ---
    const [linkedPeople, setLinkedPeople] = useState<LinkedPerson[]>([]);
    const [loadingLinkedPeople, setLoadingLinkedPeople] = useState(false);
    const [peopleSelectorOpen, setPeopleSelectorOpen] = useState(false);
    const [newPersonRole, setNewPersonRole] = useState("");
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const roleInputRef = useRef<HTMLInputElement>(null);

    // --- Linked business state ---
    const [linkedBusiness, setLinkedBusiness] = useState<LinkedParent | null>(null);
    const [loadingLinkedBusiness, setLoadingLinkedBusiness] = useState(false);
    const [businessSelectorOpen, setBusinessSelectorOpen] = useState(false);
    const [businessItems, setBusinessItems] = useState<Item[]>([]);
    const [businessSearch, setBusinessSearch] = useState("");
    const [loadingBusinessItems, setLoadingBusinessItems] = useState(false);


    const fetchReminders = useCallback(async () => {
      if (!itemId) return;
      setLoadingReminders(true);
      try {
        const data = await api.reminders.listForItem(itemId);
        setReminders(data);
      } catch {
        // Silently fail
      } finally {
        setLoadingReminders(false);
      }
    }, [itemId]);

    const fetchContacts = useCallback(async () => {
      if (!itemId) return;
      setLoadingContacts(true);
      try {
        const data = await api.contacts.listForItem(itemId);
        setContacts(data);
      } catch {
        // Silently fail
      } finally {
        setLoadingContacts(false);
      }
    }, [itemId]);

    const fetchSavedContacts = useCallback(async () => {
      if (!itemId) return;
      setLoadingSavedContacts(true);
      try {
        const data = await api.savedContacts.listForItem(itemId);
        setSavedContacts(data);
      } catch {
        // Silently fail
      } finally {
        setLoadingSavedContacts(false);
      }
    }, [itemId]);

    const fetchLinkedPeople = useCallback(async () => {
      if (!itemId) return;
      setLoadingLinkedPeople(true);
      try {
        const data = await api.people.listForItem(itemId);
        setLinkedPeople(data);
      } catch {
        // Silently fail
      } finally {
        setLoadingLinkedPeople(false);
      }
    }, [itemId]);

    const BUSINESS_ENTITY_SUBS = new Set(["llc", "corporation", "partnership", "sole_proprietorship"]);
    const BUSINESS_SUB_LABELS: Record<string, string> = {
      llc: "LLC", corporation: "Corporation", partnership: "Partnership/LLP", sole_proprietorship: "Sole Proprietorship",
    };

    const fetchLinkedBusiness = useCallback(async () => {
      if (!itemId) return;
      setLoadingLinkedBusiness(true);
      try {
        const parent = await api.itemLinks.getParent(itemId);
        setLinkedBusiness(parent);
      } catch {
        // Silently fail
      } finally {
        setLoadingLinkedBusiness(false);
      }
    }, [itemId]);

    const fetchBusinessItems = useCallback(async () => {
      setLoadingBusinessItems(true);
      try {
        const res = await api.items.list({ category: "business", limit: 200 });
        setBusinessItems(res.items.filter((i) => BUSINESS_ENTITY_SUBS.has(i.subcategory) && !i.is_archived));
      } catch {
        // Silently fail
      } finally {
        setLoadingBusinessItems(false);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      getPendingReminders: () => pendingReminders,
      getPendingContacts: () => pendingContacts,
      addContacts: (newContacts: PendingContact[]) => {
        if (isCreate) {
          // In create mode, merge into pending (avoid duplicates by label)
          setPendingContacts((prev) => {
            const existing = new Set(prev.map((c) => c.label));
            const unique = newContacts.filter((c) => !existing.has(c.label));
            return [...prev, ...unique];
          });
        } else if (itemId) {
          // In edit mode, save to API directly
          (async () => {
            for (const c of newContacts) {
              // Skip if already exists with same label
              if (contacts.some((existing) => existing.label === c.label)) continue;
              try {
                await api.contacts.create({
                  item_id: itemId,
                  label: c.label,
                  value: c.value,
                  contact_type: c.contact_type,
                });
              } catch (err) {
                console.error("Failed to save contact:", err);
              }
            }
            fetchContacts();
          })();
        }
      },
      replaceProviderContacts: (newContacts: PendingContact[]) => {
        if (isCreate) {
          // In create mode, replace all pending contacts
          setPendingContacts(newContacts);
        } else if (itemId) {
          // In edit mode, delete all existing contacts then add new ones
          (async () => {
            // Delete all existing contacts
            for (const c of contacts) {
              try {
                await api.contacts.delete(c.id);
              } catch (err) {
                console.error("Failed to delete contact:", err);
              }
            }
            // Add new ones
            for (let i = 0; i < newContacts.length; i++) {
              try {
                await api.contacts.create({
                  item_id: itemId,
                  label: newContacts[i].label,
                  value: newContacts[i].value,
                  contact_type: newContacts[i].contact_type,
                  sort_order: i,
                });
              } catch (err) {
                console.error("Failed to save contact:", err);
              }
            }
            fetchContacts();
          })();
        }
      },
      refreshReminders: () => {
        fetchReminders();
      },
    }));

    useEffect(() => {
      fetchReminders();
      fetchContacts();
      fetchSavedContacts();
      fetchLinkedPeople();
      fetchLinkedBusiness();
    }, [fetchReminders, fetchContacts, fetchSavedContacts, fetchLinkedPeople, fetchLinkedBusiness]);

    // --- Reminder handlers ---
    async function handleDeleteReminder(id: string) {
      try {
        await api.reminders.delete(id);
        setReminders((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        console.error("Failed to delete reminder:", err);
      }
    }

    function handleRemovePending(index: number) {
      setPendingReminders((prev) => prev.filter((_, i) => i !== index));
    }

    // --- Contact handlers ---
    function resetContactForm() {
      setNewContactLabel("");
      setNewContactValue("");
      setNewContactType("phone");
      setNewContactAddress({ ...EMPTY_ADDRESS });
      setContactFormOpen(false);
    }

    function isAddressValid(addr: AddressFields): boolean {
      return !!addr.line1.trim();
    }

    function isContactValueValid(): boolean {
      if (newContactType === "address") return isAddressValid(newContactAddress);
      return !!newContactValue.trim();
    }

    function handleAddContact() {
      if (!newContactLabel.trim() || !isContactValueValid()) return;

      if (isCreate) {
        setPendingContacts((prev) => [
          ...prev,
          {
            label: newContactLabel.trim(),
            value: newContactType === "address" ? "" : newContactValue.trim(),
            contact_type: newContactType,
            ...(newContactType === "address" ? {
              address_line1: newContactAddress.line1.trim(),
              address_line2: newContactAddress.line2.trim(),
              address_city: newContactAddress.city.trim(),
              address_state: newContactAddress.state.trim(),
              address_zip: newContactAddress.zip.trim(),
            } : {}),
          },
        ]);
        resetContactForm();
      } else {
        handleCreateContact();
      }
    }

    async function handleCreateContact() {
      if (!itemId || !newContactLabel.trim() || !isContactValueValid()) return;
      setCreatingContact(true);
      try {
        await api.contacts.create({
          item_id: itemId,
          label: newContactLabel.trim(),
          value: newContactType === "address" ? "" : newContactValue.trim(),
          contact_type: newContactType,
          ...(newContactType === "address" ? {
            address_line1: newContactAddress.line1.trim(),
            address_line2: newContactAddress.line2.trim(),
            address_city: newContactAddress.city.trim(),
            address_state: newContactAddress.state.trim(),
            address_zip: newContactAddress.zip.trim(),
          } : {}),
        });
        resetContactForm();
        fetchContacts();
      } catch (err) {
        console.error("Failed to create contact:", err);
      } finally {
        setCreatingContact(false);
      }
    }

    async function handleDeleteContact(id: string) {
      try {
        await api.contacts.delete(id);
        setContacts((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        console.error("Failed to delete contact:", err);
      }
    }

    function handleRemovePendingContact(index: number) {
      setPendingContacts((prev) => prev.filter((_, i) => i !== index));
    }

    function handleDragStart(index: number) {
      setDragIndex(index);
    }

    function handleDragOver(e: React.DragEvent, index: number) {
      e.preventDefault();
      setDragOverIndex(index);
    }

    function handleDragLeave() {
      setDragOverIndex(null);
    }

    async function handleDrop(targetIndex: number) {
      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }
      const newContacts = [...contacts];
      const [dragged] = newContacts.splice(dragIndex, 1);
      newContacts.splice(targetIndex, 0, dragged);
      const updated = newContacts.map((c, i) => ({ ...c, sort_order: i }));
      setContacts(updated);
      setDragIndex(null);
      setDragOverIndex(null);
      if (itemId) {
        try {
          await api.contacts.reorder({
            item_id: itemId,
            contacts: updated.map((c) => ({ id: c.id, sort_order: c.sort_order })),
          });
        } catch (err) {
          console.error("Failed to reorder contacts:", err);
          fetchContacts();
        }
      }
    }

    function handleDragEnd() {
      setDragIndex(null);
      setDragOverIndex(null);
    }

    function startEditContact(c: ItemContact) {
      setEditingContactId(c.id);
      setEditLabel(c.label);
      setEditValue(c.value);
      setEditType(c.contact_type);
      setEditAddress({
        line1: c.address_line1 || "",
        line2: c.address_line2 || "",
        city: c.address_city || "",
        state: c.address_state || "",
        zip: c.address_zip || "",
      });
    }

    function cancelEditContact() {
      setEditingContactId(null);
    }

    function isEditValueValid(): boolean {
      if (editType === "address") return !!editAddress.line1.trim();
      return !!editValue.trim();
    }

    async function saveEditContact() {
      if (!editingContactId || !editLabel.trim() || !isEditValueValid()) return;
      setSavingEdit(true);
      try {
        const updated = await api.contacts.update(editingContactId, {
          label: editLabel.trim(),
          value: editType === "address" ? "" : editValue.trim(),
          contact_type: editType,
          ...(editType === "address" ? {
            address_line1: editAddress.line1.trim(),
            address_line2: editAddress.line2.trim(),
            address_city: editAddress.city.trim(),
            address_state: editAddress.state.trim(),
            address_zip: editAddress.zip.trim(),
          } : {}),
        });
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setEditingContactId(null);
      } catch (err) {
        console.error("Failed to update contact:", err);
      } finally {
        setSavingEdit(false);
      }
    }

    async function handleRenew() {
      if (!itemId) return;
      setRenewing(true);
      try {
        const newItem = await api.items.renew(itemId);
        setRenewDialogOpen(false);
        // Navigate to the new renewed item
        router.push(`/${categorySlug}/${newItem.id}`);
      } catch (err) {
        console.error("Failed to renew policy:", err);
      } finally {
        setRenewing(false);
      }
    }

    async function handleLinkSavedContact(contactId: string) {
      if (!itemId || !contactId) return;
      try {
        await api.savedContacts.link(itemId, contactId);
        fetchSavedContacts();
      } catch (err) {
        console.error("Failed to link contact:", err);
      }
      setSavedContactSelectorOpen(false);
    }

    async function handleUnlinkSavedContact(linkId: string) {
      if (!itemId) return;
      try {
        await api.savedContacts.unlink(itemId, linkId);
        setSavedContacts((prev) => prev.filter((c) => c.id !== linkId));
      } catch (err) {
        console.error("Failed to unlink contact:", err);
      }
    }

    async function handleLinkPerson(personName: string) {
      if (!itemId || !personName) return;
      // PersonSelector returns person name — need to find ID from list
      try {
        const allPeople = await api.people.list();
        const match = allPeople.find(
          (p) => `${p.first_name} ${p.last_name}` === personName,
        );
        if (!match) return;
        await api.people.link(itemId, match.id, newPersonRole.trim() || null);
        fetchLinkedPeople();
      } catch (err) {
        console.error("Failed to link person:", err);
      }
      setPeopleSelectorOpen(false);
      setNewPersonRole("");
    }

    async function handleUnlinkPerson(linkId: string) {
      if (!itemId) return;
      try {
        await api.people.unlink(itemId, linkId);
        setLinkedPeople((prev) => prev.filter((lp) => lp.id !== linkId));
      } catch (err) {
        console.error("Failed to unlink person:", err);
      }
    }

    async function handleLinkBusiness(businessId: string) {
      if (!itemId || !businessId) return;
      try {
        const result = await api.itemLinks.link(itemId, businessId);
        setLinkedBusiness(result);
      } catch (err) {
        console.error("Failed to link business:", err);
      }
      setBusinessSelectorOpen(false);
      setBusinessSearch("");
    }

    async function handleUnlinkBusiness() {
      if (!itemId) return;
      try {
        await api.itemLinks.unlink(itemId);
        setLinkedBusiness(null);
      } catch (err) {
        console.error("Failed to unlink business:", err);
      }
    }

    function toggleBusinessSelector() {
      const next = !businessSelectorOpen;
      setBusinessSelectorOpen(next);
      if (next) fetchBusinessItems();
      else setBusinessSearch("");
    }

    const showRenewButton = subcategoryKey === "auto_insurance" && !isCreate && !isArchived && !!itemId;
    const bizInsuranceTypes = [
      "general_liability", "professional_liability", "workers_compensation",
      "commercial_property", "commercial_auto", "bop", "cyber_liability",
      "other_business_insurance",
    ];
    const showLinkedBusiness = ["business_license", "tax_document", ...bizInsuranceTypes].includes(subcategoryKey || "");
    const today = new Date();
    const pendingDisplay = pendingReminders.map((p, i) => {
      const d = new Date(p.remind_date);
      const days = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { _pendingIndex: i, field_label: p.title, date: p.remind_date, days_until: days, is_overdue: days < 0, note: p.note, repeat: p.repeat };
    });

    return (
      <div className="space-y-6">
        {/* Renew Policy button — auto insurance only */}
        {showRenewButton && (
          <AlertDialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={renewing}
              >
                {renewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Renew Policy
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Renew Policy?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will archive the current policy and create a new one with
                  today&apos;s start date and renewal date 6 months from now. Vehicles,
                  contacts, and coverage will be copied. The insurance card will
                  need to be re-uploaded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={renewing}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRenew} disabled={renewing}>
                  {renewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Renewing...
                    </>
                  ) : (
                    "Renew"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Linked Business (business subcategories) or People (all others) */}
        {!isCreate && showLinkedBusiness && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Linked Business</h3>
              <button
                type="button"
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                onClick={toggleBusinessSelector}
              >
                {businessSelectorOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>

            {businessSelectorOpen && (
              <div className="mb-3 space-y-1">
                <Input
                  value={businessSearch}
                  onChange={(e) => setBusinessSearch(e.target.value)}
                  placeholder="Search businesses..."
                  className="text-sm h-8"
                  autoFocus
                />
                <div className="max-h-40 overflow-y-auto rounded-md border bg-white">
                  {loadingBusinessItems ? (
                    <p className="text-xs text-gray-400 p-2">Loading...</p>
                  ) : (() => {
                    const q = businessSearch.toLowerCase();
                    const filtered = businessItems.filter((i) => !q || i.name.toLowerCase().includes(q));
                    if (filtered.length === 0) return (
                      <p className="text-xs text-gray-400 p-2">No business entities found</p>
                    );
                    return filtered.map((biz) => (
                      <button
                        key={biz.id}
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                        onClick={() => handleLinkBusiness(biz.id)}
                      >
                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{biz.name}</p>
                          <p className="text-xs text-gray-500">{BUSINESS_SUB_LABELS[biz.subcategory] || biz.subcategory}</p>
                        </div>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}

            {loadingLinkedBusiness && (
              <p className="text-xs text-gray-400">Loading...</p>
            )}

            {!loadingLinkedBusiness && !linkedBusiness && !businessSelectorOpen && (
              <p className="text-xs text-gray-400">No business linked</p>
            )}

            {!loadingLinkedBusiness && linkedBusiness && (
              <div
                className="group flex items-start gap-2 rounded-md border p-2.5 text-xs transition-colors hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/business/${linkedBusiness.item_id}`)}
              >
                <Building2 className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{linkedBusiness.name}</p>
                  <p className="text-gray-500 mt-0.5 truncate">
                    {BUSINESS_SUB_LABELS[linkedBusiness.subcategory] || linkedBusiness.subcategory}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleUnlinkBusiness(); }}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {!isCreate && !showLinkedBusiness && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">People</h3>
              <button
                type="button"
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                onClick={() => setPeopleSelectorOpen(!peopleSelectorOpen)}
              >
                {peopleSelectorOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>

            {peopleSelectorOpen && (
              <div className="mb-3 space-y-2">
                <div className="relative">
                  <Input
                    ref={roleInputRef}
                    value={newPersonRole}
                    onChange={(e) => { setNewPersonRole(e.target.value); setRoleDropdownOpen(true); }}
                    onFocus={() => setRoleDropdownOpen(true)}
                    onBlur={() => { setTimeout(() => setRoleDropdownOpen(false), 150); }}
                    placeholder="Role (e.g. Owner, Beneficiary)"
                    className="text-sm h-8"
                    autoComplete="off"
                  />
                  {roleDropdownOpen && (() => {
                    const q = newPersonRole.toLowerCase();
                    const filtered = DEFAULT_PERSON_ROLES.filter(
                      (r) => !q || r.toLowerCase().includes(q),
                    );
                    if (filtered.length === 0) return null;
                    if (filtered.length === 1 && filtered[0].toLowerCase() === q) return null;
                    return (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filtered.map((role) => (
                          <button
                            key={role}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 truncate"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setNewPersonRole(role);
                              setRoleDropdownOpen(false);
                            }}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <PersonSelector
                  value=""
                  onChange={handleLinkPerson}
                  placeholder="Search people..."
                />
              </div>
            )}

            {loadingLinkedPeople && (
              <p className="text-xs text-gray-400">Loading...</p>
            )}

            {!loadingLinkedPeople && linkedPeople.length === 0 && !peopleSelectorOpen && (
              <p className="text-xs text-gray-400">No people linked</p>
            )}

            {!loadingLinkedPeople && linkedPeople.length > 0 && (
              <div className="space-y-2">
                {linkedPeople.map((lp) => (
                  <div
                    key={lp.id}
                    className="group flex items-start gap-2 rounded-md border p-2.5 text-xs transition-colors hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/people/${lp.person_id}`)}
                  >
                    <Users className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {lp.first_name} {lp.last_name}
                      </p>
                      {lp.role && (
                        <p className="text-gray-500 mt-0.5 truncate">{lp.role}</p>
                      )}
                      {lp.phone && (
                        <p className="text-gray-500 truncate">{lp.phone}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleUnlinkPerson(lp.id); }}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Reminders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Reminders</h3>
            <button
              type="button"
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              onClick={() => setReminderDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Pending reminders (create mode) */}
          {isCreate && pendingDisplay.length === 0 && (
            <p className="text-xs text-gray-400">No reminders yet</p>
          )}

          {isCreate && pendingDisplay.length > 0 && (
            <div className="space-y-2">
              {pendingDisplay.map((r) => (
                <div
                  key={r._pendingIndex}
                  className="group flex items-start gap-2 rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-2.5 text-xs"
                >
                  <Bell className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{r.field_label}</p>
                    <p className="text-gray-500 mt-0.5">
                      {new Date(r.date).toLocaleDateString()}
                    </p>
                    {r.repeat && (
                      <span className="inline-flex items-center gap-0.5 text-blue-500 text-[10px]">
                        <RefreshCw className="h-2.5 w-2.5" />
                        {repeatLabel(r.repeat)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePending(r._pendingIndex)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Existing reminders (edit mode) */}
          {!isCreate && loadingReminders && (
            <p className="text-xs text-gray-400">Loading...</p>
          )}

          {!isCreate && !loadingReminders && reminders.length === 0 && (
            <p className="text-xs text-gray-400">No reminders set</p>
          )}

          {!isCreate && !loadingReminders && reminders.length > 0 && (
            <div className="space-y-2">
              {reminders.map((r) => (
                <ReminderCard
                  key={r.id || `${r.item_id}-${r.field_label}`}
                  reminder={r}
                  variant="sidebar"
                  showItemLink={false}
                  onEdit={r.id ? () => setEditingReminder(r) : undefined}
                  onDelete={r.id ? () => handleDeleteReminder(r.id!) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Linked Contacts (global saved contacts) */}
        {!isCreate && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Linked Contacts</h3>
              <button
                type="button"
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                onClick={() => setSavedContactSelectorOpen(!savedContactSelectorOpen)}
              >
                {savedContactSelectorOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>

            {savedContactSelectorOpen && (
              <div className="mb-3">
                <SavedContactSelector
                  value=""
                  onChange={handleLinkSavedContact}
                  placeholder="Search contacts..."
                />
              </div>
            )}

            {loadingSavedContacts && (
              <p className="text-xs text-gray-400">Loading...</p>
            )}

            {!loadingSavedContacts && savedContacts.length === 0 && !savedContactSelectorOpen && (
              <p className="text-xs text-gray-400">No linked contacts</p>
            )}

            {!loadingSavedContacts && savedContacts.length > 0 && (
              <div className="space-y-2">
                {savedContacts.map((sc) => (
                  <div
                    key={sc.id}
                    className="group flex items-start gap-2 rounded-md border p-2.5 text-xs transition-colors hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/contacts/${sc.saved_contact_id}`)}
                  >
                    <BookUser className="h-3.5 w-3.5 text-teal-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{sc.name}</p>
                      {(sc.role || sc.company) && (
                        <p className="text-gray-500 mt-0.5 truncate">
                          {sc.role}{sc.role && sc.company ? " at " : ""}{sc.company}
                        </p>
                      )}
                      {sc.phone && (
                        <p className="text-gray-500 truncate">{sc.phone}</p>
                      )}
                      {sc.email && (
                        <p className="text-gray-500 truncate">{sc.email}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleUnlinkSavedContact(sc.id); }}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Contacts (item-specific) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Contacts</h3>
            <button
              type="button"
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              onClick={() => setContactFormOpen(!contactFormOpen)}
            >
              {contactFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>

          {/* Inline add contact form */}
          {contactFormOpen && (
            <div className="rounded-lg border bg-gray-50 p-3 mb-3 space-y-2.5">
              <div className="space-y-1 relative">
                <Label className="text-xs text-gray-600">Label</Label>
                <Input
                  ref={labelInputRef}
                  value={newContactLabel}
                  onChange={(e) => { setNewContactLabel(e.target.value); setLabelDropdownOpen(true); }}
                  onFocus={() => setLabelDropdownOpen(true)}
                  onBlur={() => { setTimeout(() => setLabelDropdownOpen(false), 150); }}
                  placeholder="e.g. Customer Care"
                  className="text-sm h-8 bg-white"
                  autoComplete="off"
                />
                {labelDropdownOpen && (() => {
                  const q = newContactLabel.toLowerCase();
                  const filtered = DEFAULT_CONTACT_LABELS.filter(
                    (l) => !q || l.toLowerCase().includes(q),
                  );
                  if (filtered.length === 0) return null;
                  // Hide if typed value exactly matches one option
                  if (filtered.length === 1 && filtered[0].toLowerCase() === q) return null;
                  return (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filtered.map((label) => (
                        <button
                          key={label}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 truncate"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewContactLabel(label);
                            setLabelDropdownOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Type</Label>
                <Select value={newContactType} onValueChange={(v) => { setNewContactType(v); setNewContactValue(""); setNewContactAddress({ ...EMPTY_ADDRESS }); }}>
                  <SelectTrigger className="h-8 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-sm">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  {newContactType === "phone" ? "Phone Number" : newContactType === "email" ? "Email" : newContactType === "url" ? "URL" : "Address"}
                </Label>
                {newContactType === "address" ? (
                  <AddressInput
                    fields={newContactAddress}
                    onChange={setNewContactAddress}
                  />
                ) : (
                  <Input
                    value={newContactValue}
                    onChange={(e) => setNewContactValue(e.target.value)}
                    placeholder={
                      newContactType === "phone" ? "1-800-555-1234" :
                      newContactType === "email" ? "support@provider.com" :
                      "https://..."
                    }
                    className="text-sm h-8 bg-white"
                  />
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleAddContact}
                  disabled={creatingContact || !newContactLabel.trim() || !isContactValueValid()}
                >
                  {creatingContact ? "Adding..." : "Add"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={resetContactForm}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Pending contacts (create mode) */}
          {isCreate && !contactFormOpen && pendingContacts.length === 0 && (
            <p className="text-xs text-gray-400">No linked contacts</p>
          )}

          {isCreate && pendingContacts.length > 0 && (
            <div className="space-y-2">
              {pendingContacts.map((c, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-2 rounded-md border border-dashed border-green-200 bg-green-50/50 p-2.5 text-xs"
                >
                  <ContactTypeIcon type={c.contact_type} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{c.label}</p>
                    {c.contact_type === "address" ? (
                      <div className="text-gray-500 mt-0.5 leading-snug">
                        {formatAddressLines(c).map((line, idx) => (
                          <p key={idx} className="truncate">{line}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 mt-0.5 truncate">{c.value}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePendingContact(i)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Existing contacts (edit mode) */}
          {!isCreate && loadingContacts && (
            <p className="text-xs text-gray-400">Loading...</p>
          )}

          {!isCreate && !contactFormOpen && !loadingContacts && contacts.length === 0 && (
            <p className="text-xs text-gray-400">No linked contacts</p>
          )}

          {!isCreate && !loadingContacts && contacts.length > 0 && (
            <div className="space-y-2">
              {contacts.map((c, i) =>
                editingContactId === c.id ? (
                  /* Inline edit form */
                  <div key={c.id} className="rounded-md border border-blue-200 bg-blue-50/30 p-2.5 text-xs space-y-2">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Label"
                      className="h-7 text-xs"
                    />
                    <Select value={editType} onValueChange={(v) => { setEditType(v); if ((v === "address") !== (editType === "address")) { setEditValue(""); setEditAddress({ ...EMPTY_ADDRESS }); } }}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editType === "address" ? (
                      <AddressInput
                        fields={editAddress}
                        onChange={setEditAddress}
                        inputClassName="text-xs h-7 bg-white"
                        className="space-y-1.5"
                      />
                    ) : (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Value"
                        className="h-7 text-xs"
                      />
                    )}
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={saveEditContact} disabled={savingEdit || !editLabel.trim() || !isEditValueValid()}>
                        {savingEdit ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEditContact}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display card */
                  <div
                    key={c.id}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(i)}
                    className={`group flex items-start gap-2 rounded-md border p-2.5 text-xs transition-colors hover:bg-gray-50 ${
                      dragIndex === i ? "opacity-40" : ""
                    } ${dragOverIndex === i && dragIndex !== i ? "border-blue-400 bg-blue-50/50" : ""}`}
                  >
                    <ContactTypeIcon type={c.contact_type} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{c.label}</p>
                      {c.contact_type === "phone" ? (
                        <a href={`tel:${c.value}`} className="text-blue-500 hover:underline mt-0.5 block truncate cursor-pointer">{c.value}</a>
                      ) : c.contact_type === "url" ? (
                        <a href={c.value.startsWith("http") ? c.value : `https://${c.value}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline mt-0.5 block truncate cursor-pointer">{c.value}</a>
                      ) : c.contact_type === "email" ? (
                        <a href={`mailto:${c.value}`} className="text-blue-500 hover:underline mt-0.5 block truncate cursor-pointer">{c.value}</a>
                      ) : c.contact_type === "address" ? (
                        <div className="text-gray-500 mt-0.5 leading-snug">
                          {formatAddressLines(c).map((line, idx) => (
                            <p key={idx} className="truncate">{line}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 mt-0.5 truncate">{c.value}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                      {contacts.length > 1 && (
                        <span
                          draggable
                          onDragStart={() => handleDragStart(i)}
                          onDragEnd={handleDragEnd}
                          className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => startEditContact(c)}
                        className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(c.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Reminder Dialog (Create or Edit) */}
        <ReminderEditDialog
          open={reminderDialogOpen || !!editingReminder}
          onClose={() => {
            setReminderDialogOpen(false);
            setEditingReminder(null);
          }}
          reminder={editingReminder || undefined}
          itemId={itemId}
          onSaved={() => {
            fetchReminders();
            setReminderDialogOpen(false);
            setEditingReminder(null);
          }}
        />
      </div>
    );
  }
);
