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
 * EXTRACTED COMPONENTS:
 * ─────────────────────
 * OverviewTab.tsx ........ Fields + image slots + vehicles section
 * InlineFileZone.tsx ..... Card image upload slots (front/back)
 * RightSidebar.tsx ....... Reminders + Linked Contacts (forwardRef)
 * CoverageTab.tsx ........ Coverage grid for insurance items
 *
 * AUTO-SAVE: Debounced 800ms. Any field change triggers scheduleAutoSave().
 * State is read from a ref (latestState) to avoid stale closures.
 */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Trash2,
  Check,
  Loader2,
  XCircle,
  ShieldCheck,
  IdCard,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  SubcategoryInfo,
} from "@/lib/api";
import { FileUploader } from "./FileUploader";
import { FileList } from "./FileList";
import { CoverageTab } from "./CoverageTab";
import { OverviewTab } from "./OverviewTab";
import { RightSidebar } from "./RightSidebar";
import type { RightSidebarHandle } from "./RightSidebar";
import { LicensesTab } from "./LicensesTab";
import { InsuranceTab } from "./InsuranceTab";
import { TaxDocsTab } from "./TaxDocsTab";

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
  const BUSINESS_ENTITY_SUBS = new Set(["llc", "corporation", "partnership", "sole_proprietorship"]);
  const isBusinessEntity = categorySlug === "business" && BUSINESS_ENTITY_SUBS.has(subcategory?.key ?? "");

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
            {isBusinessEntity && (
              <TabsTrigger
                value="licenses"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none bg-transparent px-1 pb-3 pt-1 text-sm font-medium"
              >
                Licenses
              </TabsTrigger>
            )}
            {isBusinessEntity && (
              <TabsTrigger
                value="insurance"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none bg-transparent px-1 pb-3 pt-1 text-sm font-medium"
              >
                Insurance
              </TabsTrigger>
            )}
            {isBusinessEntity && (
              <TabsTrigger
                value="tax-docs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none bg-transparent px-1 pb-3 pt-1 text-sm font-medium"
              >
                Tax Docs
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

            {isBusinessEntity && currentItemId && (
              <TabsContent value="licenses" className="mt-0">
                <LicensesTab itemId={currentItemId} categorySlug={categorySlug} />
              </TabsContent>
            )}

            {isBusinessEntity && currentItemId && (
              <TabsContent value="insurance" className="mt-0">
                <InsuranceTab itemId={currentItemId} categorySlug={categorySlug} />
              </TabsContent>
            )}

            {isBusinessEntity && currentItemId && (
              <TabsContent value="tax-docs" className="mt-0">
                <TaxDocsTab itemId={currentItemId} categorySlug={categorySlug} />
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

/* ──────────────────────── Files Tab ──────────────────────── */

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
