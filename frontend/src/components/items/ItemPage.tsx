/**
 * ItemPage.tsx — Main item detail/edit page for FamilyVault
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  PAGE LAYOUT (max-w-6xl, mx-auto)                           │
 * │                                                              │
 * │  Breadcrumb: Insurance > Health Insurance  ✓ saved           │
 * │                                                              │
 * │  [Icon] Item Name Input                          [Delete]    │
 * │         Subcategory label                                    │
 * │                                                              │
 * │  ┌─ Grid (grid-cols-[1fr_auto], gap-x-8) ─────────────────┐ │
 * │  │ Row 1: TabsList (tab bar)          │  (empty spacer)   │ │
 * │  │────────────────────────────────────│────────────────────│ │
 * │  │ Row 2: Tab content                 │  Sidebar (w-64)   │ │
 * │  │  <Card> (white box)                │  Renew Policy btn │ │
 * │  │    p-5 (overview) or p-6 (others)  │  Reminders        │ │
 * │  │  </Card>                           │  Contacts         │ │
 * │  │  mb-6 (bottom spacing)             │                   │ │
 * │  └────────────────────────────────────┴───────────────────┘ │
 * └──────────────────────────────────────────────────────────────┘
 *
 * FILE STRUCTURE (component tree in this file):
 * ─────────────────────────────────────────────
 * ItemPage .................. Main export. Handles item CRUD, auto-save, routing.
 *   ├── OverviewTab ......... White card with form fields + card image slots.
 *   │     ├── FieldCell ..... Single form field (text/date/select/provider/number/textarea).
 *   │     └── InlineFileZone  2-column grid of image upload slots (front/back of card).
 *   │           ├── FileSlotDisplay .. Shows uploaded image with zoom/delete.
 *   │           └── FileSlotUploader . Drag-drop upload zone, opens ImageEditor.
 *   ├── FilesTab ............ White card with FileUploader + FileList.
 *   ├── CoverageTab ......... (imported) Coverage grid for insurance items.
 *   ├── NotesTab ............ White card with a textarea.
 *   └── RightSidebar ........ Reminders + Linked Contacts (forwardRef).
 *         ├── Reminder CRUD .. Add/edit/delete/reorder reminders.
 *         └── Contact CRUD ... Add/edit/delete/reorder contacts.
 *               └── AddressInput  Structured address fields (line1, line2, city, state, zip).
 *
 * SPACING REFERENCE:
 * ──────────────────
 * - Breadcrumb bottom:          mb-6 (1.5rem)
 * - Title section bottom:       mb-8 (2rem)
 * - Grid gap:                    gap-x-8 (2rem) between columns
 * - Tab content wrapper bottom: mb-6 (1.5rem) ← controls space below white card
 * - Card internal padding:      p-5 (overview) or p-6 (files, notes)
 * - Sidebar alignment:          CSS grid row — sidebar starts in row 2, naturally aligns with tab content
 * - Sidebar section spacing:    space-y-6
 *
 * AUTO-SAVE: Debounced 800ms. Any field change triggers scheduleAutoSave().
 * State is read from a ref (latestState) to avoid stale closures.
 */
"use client";

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  GripVertical,
  Pencil,
  Upload,
  Trash2,
  Bell,
  Users,
  Plus,
  X,
  RefreshCw,
  Phone,
  Mail,
  Globe,
  MapPin,
  Check,
  Loader2,
  XCircle,
  ShieldCheck,
  IdCard,
  Briefcase,
  ZoomIn,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type {
  CategoryDetail,
  Item,
  Reminder,
  SubcategoryInfo,
  FieldDefinition,
  FieldGroup,
  ItemContact,
} from "@/lib/api";
import { FileUploader } from "./FileUploader";
import { FileList } from "./FileList";
import { ProviderCombobox } from "./ProviderCombobox";
import { PersonSelector } from "./PersonSelector";
import { PassportSelector } from "./PassportSelector";
import { CountryCombobox, VisaTypeCombobox } from "./VisaFieldCombobox";
import { CoverageTab } from "./CoverageTab";
import { ImageEditor } from "./ImageEditor";
import { VehiclesSection } from "./VehiclesSection";
import ReminderEditDialog from "./ReminderEditDialog";
import { ReminderCard } from "./ReminderCard";
import { createFileFromBlob } from "@/lib/image-utils";
import { REPEAT_OPTIONS, repeatLabel, titleCase } from "@/lib/format";

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  ids: IdCard,
  insurance: ShieldCheck,
  business: Briefcase,
};

interface ItemPageProps {
  categorySlug: string;
  itemId?: string; // undefined = create mode
  subcategoryKey?: string; // required for create mode
}

export function ItemPage({ categorySlug, itemId: initialItemId, subcategoryKey }: ItemPageProps) {
  const router = useRouter();

  const [currentItemId, setCurrentItemId] = useState<string | undefined>(initialItemId);

  const [item, setItem] = useState<Item | null>(null);
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [subcategory, setSubcategory] = useState<SubcategoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const sidebarRef = useRef<RightSidebarHandle>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingRef = useRef(false);

  // Keep latest state in a ref so the auto-save closure always reads fresh values
  const latestState = useRef({ name, notes, fieldValues, currentItemId, subcategory });
  latestState.current = { name, notes, fieldValues, currentItemId, subcategory };

  // ---------- Auto-create on mount for new items ----------
  useEffect(() => {
    if (initialItemId || creatingRef.current) return;
    creatingRef.current = true;

    (async () => {
      try {
        const catData = await api.categories.get(categorySlug);
        setCategory(catData);
        const sub = catData.subcategories.find((s) => s.key === subcategoryKey);
        setSubcategory(sub || null);
        if (!sub) { setLoading(false); return; }

        const defaultName = `New ${sub.label.replace(/s$/, "")}`;
        const created = await api.items.create({
          category: categorySlug,
          subcategory: subcategoryKey!,
          name: defaultName,
          fields: [],
        });
        setItem(created);
        setCurrentItemId(created.id);
        setName(defaultName);
        router.replace(`/${categorySlug}/${created.id}`);
      } catch (err) {
        console.error("Failed to auto-create:", err);
        setError("Failed to create item");
      } finally {
        setLoading(false);
      }
    })();
  }, [initialItemId, categorySlug, subcategoryKey, router]);

  // ---------- Fetch existing item ----------
  const fetchData = useCallback(async () => {
    if (!currentItemId) return;
    try {
      const [itemData, catData] = await Promise.all([
        api.items.get(currentItemId),
        api.categories.get(categorySlug),
      ]);
      setItem(itemData);
      setCategory(catData);
      const sub = catData.subcategories.find(
        (s) => s.key === itemData.subcategory,
      );
      setSubcategory(sub || null);

      setName(itemData.name);
      setNotes(itemData.notes || "");
      const vals: Record<string, string> = {};
      for (const fv of itemData.fields) {
        vals[fv.field_key] = fv.field_value || "";
      }
      setFieldValues(vals);
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, [currentItemId, categorySlug]);

  useEffect(() => {
    if (initialItemId) fetchData();
  }, [initialItemId, fetchData]);

  // ---------- Debounced auto-save (reads from latestState ref) ----------
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const { currentItemId: id, subcategory: sub, name: n, notes: nt, fieldValues: fv } = latestState.current;
      if (!id || !sub) return;
      setSaveStatus("saving");
      const fieldPayload = sub.fields
        .filter((f) => fv[f.key] !== undefined && fv[f.key] !== "")
        .map((f) => ({ field_key: f.key, field_value: fv[f.key] || null }));
      try {
        const updated = await api.items.update(id, {
          name: n.trim() || `New ${sub.label.replace(/s$/, "")}`,
          notes: nt.trim() || undefined,
          fields: fieldPayload,
        });
        setItem(updated);
        setSaveStatus("saved");
        // Refresh sidebar reminders after save so auto-detected reminders reflect new dates
        sidebarRef.current?.refreshReminders?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
        setSaveStatus("failed");
      }
    }, 800);
  }, []);

  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  function handleFieldChange(key: string, value: string) {
    if (item?.is_archived) return; // Read-only for archived items
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    setSaveStatus("idle");
    scheduleAutoSave();

    // Auto-populate from provider details when provider field changes
    if (key === "provider" && value) {
      api.providers.details(value).then((details) => {
        if (!details) return;
        if (sidebarRef.current) {
          const contactsToAdd = [];
          // Add portal website as a linked contact
          if (details.portal_url) {
            contactsToAdd.push({
              label: "Portal Website",
              value: details.portal_url,
              contact_type: "url",
            });
          }
          for (const c of details.contacts || []) {
            contactsToAdd.push({
              label: c.label,
              value: c.value,
              contact_type: c.contact_type,
            });
          }
          if (details.claims_address) {
            contactsToAdd.push({
              label: "Claims Address",
              value: details.claims_address,
              contact_type: "address",
            });
          }
          if (contactsToAdd.length > 0) {
            sidebarRef.current.replaceProviderContacts(contactsToAdd);
          }
        }
        scheduleAutoSave();
      }).catch(() => {});
    }

    // Auto-populate visa contacts when country field changes (visa subcategory only)
    if (key === "country" && value && subcategory?.key === "visa") {
      api.visas.contacts(value).then((response) => {
        if (!response?.contacts || response.contacts.length === 0) return;
        if (sidebarRef.current) {
          const contactsToAdd = response.contacts.map((c) => ({
            label: c.label,
            value: c.value,
            contact_type: c.contact_type,
          }));
          sidebarRef.current.addContacts(contactsToAdd);
        }
      }).catch(() => {});
    }

    // Auto-generate business reminders when has_employees or tax_election changes
    if ((key === "has_employees" || key === "tax_election") && currentItemId && (subcategory?.key === "llc" || subcategory?.key === "corporation")) {
      // Wait for auto-save to complete before generating reminders
      setTimeout(() => {
        api.reminders.generateBusiness(currentItemId).then(() => {
          // Refresh reminders in sidebar
          if (sidebarRef.current) {
            sidebarRef.current.refreshReminders?.();
          }
        }).catch((err) => {
          console.error("Failed to generate business reminders:", err);
        });
      }, 1000); // Give auto-save time to complete
    }

    // end_date is in REMINDER_FIELD_KEYS so the backend auto-detects it
    // as a reminder. Sidebar refreshes after auto-save completes.
  }

  function handleNameChange(value: string) {
    if (item?.is_archived) return; // Read-only for archived items
    setName(value);
    setSaveStatus("idle");
    scheduleAutoSave();
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    setSaveStatus("idle");
    scheduleAutoSave();
  }

  async function handleDelete() {
    if (!currentItemId) return;
    try {
      await api.items.delete(currentItemId);
      router.push(`/${categorySlug}`);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!category || !subcategory) {
    return <div className="text-red-500">Not found</div>;
  }

  const CategoryIcon = categoryIcons[categorySlug] || Briefcase;
  const fileCount = item?.files?.length || 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href={`/${categorySlug}`} className="hover:text-gray-900 transition-colors">
          {category.label}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium">{subcategory.label}</span>
        <span className="ml-1.5 flex items-center">
          {saveStatus === "saved" && (
            <Check className="h-4 w-4 text-green-500" />
          )}
          {saveStatus === "saving" && (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          )}
          {saveStatus === "failed" && (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </span>
      </nav>

      {/* Archived banner */}
      {item?.is_archived && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-800">
          <span className="text-lg">⚠</span>
          <span>This policy has been archived. It is read-only.</span>
        </div>
      )}

      {/* Title section */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 shrink-0">
          <CategoryIcon className="h-7 w-7 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={`Name this ${subcategory.label.toLowerCase()}...`}
            className="text-2xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 placeholder:text-gray-300"
            readOnly={item?.is_archived}
          />
          <p className="text-sm text-gray-500 mt-0.5">{subcategory.label}</p>
        </div>

        {/* Delete — hidden for archived items */}
        {!item?.is_archived && (
        <div className="flex items-center shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-300 hover:text-red-500">
                <Trash2 className="h-4.5 w-4.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {name || "this item"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will archive the item. You can contact an admin to restore it later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 mb-6">
          {error}
        </div>
      )}

      {/* Tabs + right sidebar — grid so sidebar row-starts align with tab content */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="grid grid-cols-[1fr_auto] gap-x-8">
          {/* Row 1: tab bar (spans only left column) */}
          <TabsList className="bg-transparent border-b w-full justify-start rounded-none h-auto p-0 gap-6">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none bg-transparent px-1 pb-3 pt-1 text-sm font-medium"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none bg-transparent px-1 pb-3 pt-1 text-sm font-medium"
            >
              Files {fileCount > 0 && <span className="ml-1.5 text-xs text-gray-400">{fileCount}</span>}
            </TabsTrigger>
            {subcategory.coverage_definition && (
              <TabsTrigger
                value="coverage"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none bg-transparent px-1 pb-3 pt-1 text-sm font-medium"
              >
                Coverage
              </TabsTrigger>
            )}
            <TabsTrigger
              value="notes"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none bg-transparent px-1 pb-3 pt-1 text-sm font-medium"
            >
              Notes
            </TabsTrigger>
          </TabsList>

          {/* Row 1, col 2: empty spacer so sidebar column is established */}
          <div className="hidden lg:block w-64" />

          {/* Row 2, col 1: tab content */}
          <div className="mt-4 mb-6 min-w-0">
            <TabsContent value="overview" className="mt-0">
              <OverviewTab
                fields={subcategory.fields}
                fieldGroups={subcategory.field_groups}
                fieldValues={fieldValues}
                onFieldChange={handleFieldChange}
                item={item}
                subcategory={subcategory}
                onUploaded={fetchData}
              />
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <FilesTab
                item={item}
                subcategory={subcategory}
                onUploaded={fetchData}
              />
            </TabsContent>

            {subcategory.coverage_definition && currentItemId && (
              <TabsContent value="coverage" className="mt-0">
                <CoverageTab
                  itemId={currentItemId}
                  coverageDefinition={subcategory.coverage_definition}
                  onSaveStatusChange={setSaveStatus}
                />
              </TabsContent>
            )}

            <TabsContent value="notes" className="mt-0">
              <NotesTab
                notes={notes}
                onChange={handleNotesChange}
              />
            </TabsContent>
          </div>

          {/* Row 2, col 2: right sidebar — naturally aligns with tab content */}
          <div className="mt-4 hidden lg:block w-64">
            <RightSidebar
              ref={sidebarRef}
              itemId={currentItemId}
              isCreate={false}
              subcategoryKey={subcategory?.key}
              isArchived={item?.is_archived ?? false}
              categorySlug={categorySlug}
            />
          </div>
        </div>
      </Tabs>
    </div>
  );
}

/* ──────────────────────── Overview Tab ──────────────────────── */
/**
 * Overview tab content — renders fields using renderDynamicFieldCards helper.
 *
 * Supports two layouts:
 * - Multiple cards when field_groups is present (e.g., LLC/Corporation with separate Business Info and Address cards)
 * - Single card with flat fields (backwards compatible for IDs, Insurance, etc.)
 *
 * The renderDynamicFieldCards helper provides reusable logic that can be used throughout the file.
 */
function OverviewTab({
  fields,
  fieldGroups,
  fieldValues,
  onFieldChange,
  item,
  subcategory,
  onUploaded,
}: {
  fields: FieldDefinition[];
  fieldGroups?: FieldGroup[];
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  item: Item | null;
  subcategory: SubcategoryInfo;
  onUploaded: () => void;
}) {
  return (
    <>
      {renderDynamicFieldCards({
        fields,
        fieldGroups,
        fieldValues,
        onFieldChange,
        item,
        subcategory,
        onUploaded,
      })}

      {/* Vehicles section (auto insurance only) */}
      {subcategory.key === "auto_insurance" && (
        <div className="mt-4">
          <VehiclesSection itemId={item?.id} />
        </div>
      )}
    </>
  );
}

/* ──────────────────────── Reusable Field Cards Renderer ──────────────────────── */
/**
 * Reusable helper that renders fields in either:
 * - Multiple cards (when field_groups is present)
 * - Single card (when only flat fields array)
 *
 * Handles provider fields, image slots, and grid layout automatically.
 * This function can be called from anywhere in this file to render fields consistently.
 */
function renderDynamicFieldCards({
  fields,
  fieldGroups,
  fieldValues,
  onFieldChange,
  item,
  subcategory,
  onUploaded,
}: {
  fields: FieldDefinition[];
  fieldGroups?: FieldGroup[];
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  item: Item | null;
  subcategory: SubcategoryInfo;
  onUploaded: () => void;
}) {
  const imageSlots = subcategory.file_slots.filter(
    (s) => s.includes("front") || s.includes("back") || s.includes("card"),
  );
  const hasImageSlots = imageSlots.length > 0;

  // ════════════════════════════════════════════════════════════
  // Multi-card layout (when field_groups exists)
  // ════════════════════════════════════════════════════════════
  if (fieldGroups && fieldGroups.length > 0) {
    return (
      <div className="space-y-4">
        {fieldGroups.map((group, groupIndex) => {
          const groupFields = group.fields;

          // Only show provider row and image slots in the first group
          const isFirstGroup = groupIndex === 0;
          const providerIndex = isFirstGroup
            ? groupFields.findIndex((f) => f.type === "provider")
            : -1;
          const topFields = providerIndex >= 0
            ? groupFields.slice(providerIndex, providerIndex + 2)
            : [];
          const gridFields = providerIndex >= 0
            ? [...groupFields.slice(0, providerIndex), ...groupFields.slice(providerIndex + 2)]
            : groupFields;

          return (
            <Card key={group.label}>
              <CardContent className="p-5">
                {/* Group label as heading */}
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  {group.label}
                </h3>

                {/* Provider + Member ID row (first group only) */}
                {isFirstGroup && topFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 mb-4">
                    {topFields.map((field) => (
                      <FieldCell
                        key={field.key}
                        field={field}
                        value={fieldValues[field.key] || ""}
                        onChange={(v) => onFieldChange(field.key, v)}
                        subcategory={subcategory.key}
                        fieldValues={fieldValues}
                      />
                    ))}
                  </div>
                )}

                {/* Card images (first group only) */}
                {isFirstGroup && hasImageSlots && item && (
                  <div className="mb-4">
                    <InlineFileZone
                      item={item}
                      fileSlots={imageSlots}
                      onUploaded={onUploaded}
                    />
                  </div>
                )}

                {/* 3-column grid for fields */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                  {gridFields.map((field) => (
                    <div
                      key={field.key}
                      className={field.type === "textarea" ? "col-span-3" : ""}
                    >
                      <FieldCell
                        field={field}
                        value={fieldValues[field.key] || ""}
                        onChange={(v) => onFieldChange(field.key, v)}
                        subcategory={subcategory.key}
                        fieldValues={fieldValues}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // Single card layout (backwards compatible - flat fields)
  // ════════════════════════════════════════════════════════════
  const providerIndex = fields.findIndex((f) => f.type === "provider");
  const topFields = providerIndex >= 0
    ? fields.slice(providerIndex, providerIndex + 2)
    : [];
  const gridFields = providerIndex >= 0
    ? [...fields.slice(0, providerIndex), ...fields.slice(providerIndex + 2)]
    : fields;

  return (
    <Card>
      <CardContent className="p-5">
        {/* Provider + Member ID row */}
        {topFields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 mb-4">
            {topFields.map((field) => (
              <FieldCell
                key={field.key}
                field={field}
                value={fieldValues[field.key] || ""}
                onChange={(v) => onFieldChange(field.key, v)}
                subcategory={subcategory.key}
                fieldValues={fieldValues}
              />
            ))}
          </div>
        )}

        {/* Card images */}
        {hasImageSlots && item && (
          <div className="mb-4">
            <InlineFileZone
              item={item}
              fileSlots={imageSlots}
              onUploaded={onUploaded}
            />
          </div>
        )}

        {/* 3-column grid for remaining fields */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          {gridFields.map((field) => (
            <div
              key={field.key}
              className={field.type === "textarea" ? "col-span-3" : ""}
            >
              <FieldCell
                field={field}
                value={fieldValues[field.key] || ""}
                onChange={(v) => onFieldChange(field.key, v)}
                subcategory={subcategory.key}
                fieldValues={fieldValues}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────── Field Cell (label on top) ──────────────────────── */
/**
 * Single form field with a label above and the appropriate input type below.
 * Renders different inputs based on field.type:
 *   - "provider"  → ProviderCombobox (searchable dropdown)
 *   - "select"    → shadcn Select with options from field.options[]
 *   - "textarea"  → multi-line Textarea
 *   - "number"    → text Input with $ prefix
 *   - "date"      → date Input
 *   - default     → text Input
 *
 * Spacing: space-y-1 between label and input. Input height: h-9.
 */
function FieldCell({
  field,
  value,
  onChange,
  subcategory,
  fieldValues,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (v: string) => void;
  subcategory?: string;
  fieldValues?: Record<string, string>;
}) {
  const label = field.label;

  // Visa-specific field handling
  const isVisaSubcategory = subcategory === "visa";
  const isCountryField = isVisaSubcategory && field.key === "country";
  const isVisaTypeField = isVisaSubcategory && field.key === "visa_type";
  const isPassportNumberField = isVisaSubcategory && field.key === "passport_number";

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {isCountryField ? (
        <CountryCombobox
          value={value}
          onChange={onChange}
          placeholder="Select country..."
        />
      ) : isVisaTypeField ? (
        <VisaTypeCombobox
          value={value}
          onChange={onChange}
          country={fieldValues?.country || ""}
          placeholder="Select visa type..."
        />
      ) : isPassportNumberField ? (
        <PassportSelector
          value={value}
          onChange={onChange}
          placeholder="Select passport..."
        />
      ) : field.type === "provider" ? (
        <ProviderCombobox
          value={value}
          onChange={onChange}
          placeholder={`Select ${label.toLowerCase()}...`}
        />
      ) : field.type === "person" ? (
        <PersonSelector
          value={value}
          onChange={onChange}
          placeholder={`Select ${label.toLowerCase()}...`}
        />
      ) : field.type === "select" && field.options ? (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="h-9 text-sm w-full">
            <SelectValue placeholder={<span className="text-gray-400">{`Select...`}</span>} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className="resize-none min-h-[60px] text-sm"
        />
      ) : field.type === "number" ? (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <Input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0.00"
            className="h-9 text-sm pl-7"
          />
        </div>
      ) : (
        <Input
          type={field.type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.type === "date" ? "" : `Enter ${label.toLowerCase()}...`}
          className="h-9 text-sm"
        />
      )}
    </div>
  );
}

/* ──────────────────────── Inline File Zone ──────────────────────── */
/**
 * InlineFileZone — 2-column grid showing card image upload slots inside the Overview tab.
 * Each slot is either:
 *   - FileSlotDisplay: shows the uploaded image with zoom/delete hover actions
 *   - FileSlotUploader: drag-drop zone that opens the ImageEditor before uploading
 *
 * Card slots (front_image, back_image, etc.) use CARD_ASPECT (≈1.588) for aspect ratio.
 * Clicking an image opens a lightbox overlay; clicking edit in lightbox opens ImageEditor.
 *
 * SLOT_LABELS maps slot keys (e.g. "front_image") to display names ("Front of Card").
 * CARD_SLOTS is the set of slots that get the card aspect ratio enforced.
 */

const SLOT_LABELS: Record<string, string> = {
  front_image: "Front of Card",
  back_image: "Back of Card",
  card_front: "Front of Card",
  card_back: "Back of Card",
  id_card_front: "Front of ID Card",
  id_card_back: "Back of ID Card",
  insurance_card: "Insurance Card",
  document: "Document",
  policy_document: "Policy Document",
};

function slotLabel(slot: string) {
  return SLOT_LABELS[slot] || slot.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Standard credit/ID card aspect ratio (~3.375 : 2.125) */
const CARD_ASPECT = 3.375 / 2.125; // ≈ 1.588

/** Insurance card aspect — measured from actual Progressive card (1865×803px) */
const INSURANCE_CARD_ASPECT = 1865 / 803; // ≈ 2.322

const CARD_SLOTS = new Set([
  "front_image", "back_image",
  "card_front", "card_back",
  "id_card_front", "id_card_back",
  "insurance_card",
]);

/** Per-slot aspect ratio overrides */
const SLOT_ASPECT_OVERRIDES: Record<string, number> = {
  insurance_card: INSURANCE_CARD_ASPECT,
};

function slotAspect(slot: string): number | undefined {
  if (SLOT_ASPECT_OVERRIDES[slot]) return SLOT_ASPECT_OVERRIDES[slot];
  return CARD_SLOTS.has(slot) ? CARD_ASPECT : undefined;
}

/** Loads an image via authenticated fetch and returns an object URL */
function useAuthImage(fileId: string | undefined) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fileId) return;
    let revoked = false;
    api.files.getBlobUrl(fileId).then((url) => {
      if (!revoked) setBlobUrl(url);
    }).catch(() => {});
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);
  return blobUrl;
}

/** Detect whether a loaded image is portrait (taller than wide) */
function useImageOrientation(blobUrl: string | null): "landscape" | "portrait" | null {
  const [orientation, setOrientation] = useState<"landscape" | "portrait" | null>(null);
  useEffect(() => {
    if (!blobUrl) { setOrientation(null); return; }
    const img = new Image();
    img.onload = () => {
      setOrientation(img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait");
    };
    img.src = blobUrl;
  }, [blobUrl]);
  return orientation;
}

function InlineFileZone({
  item,
  fileSlots,
  onUploaded,
}: {
  item: Item;
  fileSlots: string[];
  onUploaded: () => void;
}) {
  const slotFiles = item.files.filter((f) =>
    fileSlots.includes(f.purpose || ""),
  );

  // Determine if any slot has an uploaded file (to stretch empty slots to match)
  const hasAnyUpload = slotFiles.length > 0;

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = useState("");
  const [editingFile, setEditingFile] = useState<{ id: string; name: string; purpose: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const lightboxOrientation = useImageOrientation(lightboxUrl);

  async function handleEditSave(blob: Blob) {
    if (!editingFile) return;
    const editedFile = createFileFromBlob(blob, editingFile.name);
    try {
      await api.files.delete(editingFile.id);
      await api.files.upload(item.id, editedFile, editingFile.purpose);
      onUploaded();
    } catch (err) {
      console.error("Failed to save edited image:", err);
    }
    setEditorOpen(false);
    setLightboxUrl(null);
    setEditingFile(null);
  }

  return (
    <>
      <div className={`grid gap-4 ${fileSlots.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {fileSlots.map((slot) => {
          const existing = slotFiles.find((f) => f.purpose === slot);
          const isImage = existing?.mime_type?.startsWith("image/");
          return (
            <div key={slot}>
              {existing ? (
                <FileSlotDisplay
                  file={existing}
                  slot={slot}
                  isImage={!!isImage}
                  onDelete={async () => { await api.files.delete(existing.id); onUploaded(); }}
                  onEnlarge={(url, fileInfo) => {
                    setLightboxUrl(url);
                    setLightboxLabel(slotLabel(slot));
                    setEditingFile(fileInfo);
                  }}
                  onView={async () => {
                    const url = await api.files.getBlobUrl(existing.id);
                    window.open(url, "_blank");
                  }}
                />
              ) : (
                <FileSlotUploader
                  itemId={item.id}
                  slot={slot}
                  label={slotLabel(slot)}
                  onUploaded={onUploaded}
                  matchHeight={hasAnyUpload}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox overlay */}
      {lightboxUrl && !editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setLightboxUrl(null); setEditingFile(null); }}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt={lightboxLabel}
              className={`rounded-lg shadow-2xl max-w-full max-h-[85vh] object-contain ${
                lightboxOrientation === "portrait" ? "rotate-90" : ""
              }`}
            />
            <p className="text-white text-sm text-center mt-2 opacity-80">{lightboxLabel}</p>
            {/* Edit button */}
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="absolute -top-3 -right-12 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
            >
              <Pencil className="h-4 w-4 text-gray-700" />
            </button>
            {/* Close button */}
            <button
              type="button"
              onClick={() => { setLightboxUrl(null); setEditingFile(null); }}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>
      )}

      {/* Image editor (from lightbox edit) */}
      {editorOpen && lightboxUrl && (
        <ImageEditor
          open={editorOpen}
          imageSrc={lightboxUrl}
          onSave={handleEditSave}
          onCancel={() => setEditorOpen(false)}
          title={`Edit ${lightboxLabel}`}
          aspect={editingFile ? slotAspect(editingFile.purpose) : undefined}
        />
      )}
    </>
  );
}

/* ──────────────────────── File Slot Display (with auth image) ──────────────────────── */

function FileSlotDisplay({
  file,
  slot,
  isImage,
  onDelete,
  onEnlarge,
  onView,
}: {
  file: { id: string; file_name: string; mime_type: string; purpose?: string | null };
  slot: string;
  isImage: boolean;
  onDelete: () => void;
  onEnlarge: (blobUrl: string, fileInfo: { id: string; name: string; purpose: string }) => void;
  onView: () => void;
}) {
  const blobUrl = useAuthImage(isImage ? file.id : undefined);
  const isCard = CARD_SLOTS.has(slot);

  // For card slots use the appropriate aspect ratio; otherwise fall back to fixed h-40
  const aspect = slotAspect(slot);
  const containerStyle = isCard ? { aspectRatio: `${aspect}` } : undefined;
  const fallbackH = isCard ? "" : "h-40";

  return (
    <div className="relative group rounded-lg border bg-gray-50 overflow-hidden">
      {isImage && blobUrl ? (
        <div
          className="relative cursor-pointer overflow-hidden"
          style={containerStyle}
          onClick={() => onEnlarge(blobUrl, { id: file.id, name: file.file_name, purpose: slot })}
        >
          <img
            src={blobUrl}
            alt={slotLabel(slot)}
            className={`w-full ${fallbackH} object-cover`}
            style={isCard ? { width: "100%", height: "100%", objectFit: "cover" } : undefined}
          />
          {/* Hover zoom overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
          </div>
        </div>
      ) : isImage && !blobUrl ? (
        <div className={`w-full ${fallbackH} flex items-center justify-center`} style={containerStyle}>
          <Loader2 className="h-5 w-5 text-gray-300 animate-spin" />
        </div>
      ) : (
        <div className={`w-full ${fallbackH} flex items-center justify-center`} style={containerStyle}>
          <p className="text-xs text-gray-500 truncate px-3">{file.file_name}</p>
        </div>
      )}
      {/* Label bar with view + delete icons */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 border-t bg-white">
        <p className="text-[10px] text-gray-500">{slotLabel(slot)}</p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onView(); }}
          title="View in browser"
          className="text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Eye className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────── PDF → Image helper ──────────────────────── */

/**
 * Renders the first page of a PDF file to a PNG image blob URL.
 * Uses pdf.js (pdfjs-dist) to render on a canvas at 3× scale for crisp output.
 */
async function pdfToImageSrc(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  // Worker is copied to /public by CopyPlugin in next.config.ts
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const scale = 3; // High-res render for crisp crop
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;

  // Convert canvas to blob URL
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
  return URL.createObjectURL(blob);
}

/* ──────────────────────── File Slot Uploader (small inline) ──────────────────────── */

function FileSlotUploader({
  itemId,
  slot,
  label,
  onUploaded,
  matchHeight,
}: {
  itemId: string;
  slot: string;
  label?: string;
  onUploaded: () => void;
  matchHeight?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  function handleFile(file: File) {
    if (file.type.startsWith("image/")) {
      // Open editor for images
      const src = URL.createObjectURL(file);
      setPendingFile(file);
      setPendingImageSrc(src);
      setEditorOpen(true);
    } else if (file.type === "application/pdf" && CARD_SLOTS.has(slot)) {
      // PDF in a card slot → convert first page to image, then open editor for cropping
      (async () => {
        setConverting(true);
        try {
          const src = await pdfToImageSrc(file);
          // Use original filename but .png extension for the cropped output
          const pngName = file.name.replace(/\.pdf$/i, ".png");
          setPendingFile(new File([new Blob()], pngName, { type: "image/png" }));
          setPendingImageSrc(src);
          setEditorOpen(true);
        } catch (err) {
          console.error("PDF conversion failed:", err);
          // Fall back to direct upload
          try {
            await api.files.upload(itemId, file, slot);
            onUploaded();
          } catch (uploadErr) {
            console.error("Upload failed:", uploadErr);
          }
        } finally {
          setConverting(false);
        }
      })();
    } else {
      // Direct upload for non-images (PDFs in non-card slots, docs, etc.)
      (async () => {
        try {
          await api.files.upload(itemId, file, slot);
          onUploaded();
        } catch (err) {
          console.error("Upload failed:", err);
        }
      })();
    }
  }

  async function handleEditorSave(blob: Blob) {
    setEditorOpen(false);
    if (pendingFile) {
      const editedFile = createFileFromBlob(blob, pendingFile.name);
      try {
        await api.files.upload(itemId, editedFile, slot);
        onUploaded();
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    cleanup();
  }

  function handleEditorCancel() {
    setEditorOpen(false);
    cleanup();
  }

  function cleanup() {
    if (pendingImageSrc) URL.revokeObjectURL(pendingImageSrc);
    setPendingFile(null);
    setPendingImageSrc(null);
  }

  return (
    <>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        style={CARD_SLOTS.has(slot) ? { aspectRatio: `${slotAspect(slot)}` } : undefined}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors ${
          CARD_SLOTS.has(slot) ? "" : matchHeight ? "h-full min-h-[10.75rem]" : "h-36"
        } ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        {converting ? (
          <>
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin mb-1.5" />
            <p className="text-xs text-blue-500 text-center leading-tight font-medium">
              Converting PDF…
            </p>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-gray-300 mb-1.5" />
            <p className="text-xs text-blue-500 text-center leading-tight font-medium">
              {label || slotLabel(slot)}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Drop or click to upload
            </p>
          </>
        )}
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      {/* Image editor (pre-upload) */}
      {editorOpen && pendingImageSrc && (
        <ImageEditor
          open={editorOpen}
          imageSrc={pendingImageSrc}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          title={`Edit ${label || slotLabel(slot)}`}
          aspect={slotAspect(slot)}
        />
      )}
    </>
  );
}

/* ──────────────────────── Files Tab ──────────────────────── */
/**
 * Files tab — white card (p-6) with FileUploader (drag-drop) + FileList (table of files).
 * Separated by a <Separator /> divider.
 */
function FilesTab({
  item,
  subcategory,
  onUploaded,
}: {
  item: Item | null;
  subcategory: SubcategoryInfo;
  onUploaded: () => void;
}) {
  if (!item) return null;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <FileUploader
          itemId={item.id}
          fileSlots={subcategory.file_slots}
          onUploaded={onUploaded}
        />
        <Separator />
        <FileList files={item.files} onDeleted={onUploaded} />
      </CardContent>
    </Card>
  );
}

/* ──────────────────────── Notes Tab ──────────────────────── */
/** Notes tab — white card (p-6) with a borderless textarea. */
function NotesTab({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <Textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Add notes about this item..."
          className="min-h-[200px] resize-none border-none shadow-none p-0 text-sm focus-visible:ring-0"
        />
      </CardContent>
    </Card>
  );
}

/* ──────────────────────── Right Sidebar ──────────────────────── */
/**
 * RightSidebar — fixed-width (w-64) panel to the right of the tabs.
 * Only visible on lg: screens. Uses pt-[64px] to align with tab content card.
 *
 * Contains two sections separated by a <Separator />:
 *   1. REMINDERS — create, list, delete custom reminders with repeat options.
 *   2. LINKED CONTACTS — create, list, edit, delete, drag-to-reorder contacts.
 *      Contact types: phone, email, url, address.
 *      Address contacts use structured fields (line1, line2, city, state, zip)
 *      stored as separate backend columns.
 *
 * Uses forwardRef + useImperativeHandle to expose methods to parent:
 *   - getPendingReminders/Contacts: for create mode queuing
 *   - addContacts: merge provider-populated contacts
 *   - replaceProviderContacts: swap all contacts when provider changes
 *
 * CONTACT LABELS: DEFAULT_CONTACT_LABELS provides autocomplete suggestions
 * (Customer Care, TTY, Prior Authorization, etc.) in the label input dropdown.
 */


interface PendingReminder {
  title: string;
  remind_date: string;
  note: string | null;
  repeat: string | null;
}

interface PendingContact {
  label: string;
  value: string;
  contact_type: string;
  address_line1?: string;
  address_line2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
}

interface RightSidebarHandle {
  getPendingReminders: () => PendingReminder[];
  getPendingContacts: () => PendingContact[];
  addContacts: (contacts: PendingContact[]) => void;
  replaceProviderContacts: (contacts: PendingContact[]) => void;
  refreshReminders: () => void;
}

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

/** Format structured address fields for display (falls back to value if no structured fields) */
function formatAddressLines(contact: { value?: string; address_line1?: string | null; address_line2?: string | null; address_city?: string | null; address_state?: string | null; address_zip?: string | null }): string[] {
  // If structured fields exist, use them
  if (contact.address_line1 || contact.address_city || contact.address_state || contact.address_zip) {
    const lines: string[] = [];
    if (contact.address_line1) lines.push(contact.address_line1);
    if (contact.address_line2) lines.push(contact.address_line2);
    const cityState = [contact.address_city, contact.address_state].filter(Boolean).join(", ");
    const cityStateZip = [cityState, contact.address_zip].filter(Boolean).join(" ");
    if (cityStateZip) lines.push(cityStateZip);
    return lines;
  }
  // Fallback: show the raw value (for legacy/provider-populated addresses)
  if (contact.value) return [contact.value];
  return [];
}

/** Shape of the address form state used by AddressInput (local to frontend). */
interface AddressFields {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * AddressInput — renders 5 input fields for structured address entry.
 * Used in the create-contact and edit-contact forms when contact_type === "address".
 *
 * Layout:
 *   [Address Line 1          ]
 *   [Address Line 2          ]
 *   [City    ] [State ] [ZIP ]  ← grid-cols-3
 *
 * Props:
 *   fields    — current AddressFields values
 *   onChange  — called with updated AddressFields on any field change
 *   className / inputClassName — override container/input styles (edit form uses smaller h-7)
 */
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

interface RightSidebarProps {
  itemId?: string;
  isCreate: boolean;
  subcategoryKey?: string;
  isArchived?: boolean;
  categorySlug?: string;
}

const RightSidebar = React.forwardRef<RightSidebarHandle, RightSidebarProps>(
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
    }, [fetchReminders, fetchContacts]);

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

    const showRenewButton = subcategoryKey === "auto_insurance" && !isCreate && !isArchived && !!itemId;

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

        {/* Linked Contacts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Linked Contacts</h3>
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
