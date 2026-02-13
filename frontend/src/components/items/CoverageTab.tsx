"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  X,
  Building2,
  Phone,
  MapPin,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import type {
  CoverageDefinition,
  CoverageRow,
  CoverageRowIn,
  PlanLimit,
  PlanLimitIn,
  InNetworkProviderType,
} from "@/lib/api";

interface CoverageTabProps {
  itemId: string;
  coverageDefinition: CoverageDefinition;
  onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "failed") => void;
}

export function CoverageTab({
  itemId,
  coverageDefinition,
  onSaveStatusChange,
}: CoverageTabProps) {
  const { layout } = coverageDefinition;

  if (layout === "health") {
    return (
      <HealthCoverageLayout
        itemId={itemId}
        coverageDefinition={coverageDefinition}
        onSaveStatusChange={onSaveStatusChange}
      />
    );
  }

  if (layout === "life") {
    return (
      <LifeCoverageLayout
        itemId={itemId}
        coverageDefinition={coverageDefinition}
        onSaveStatusChange={onSaveStatusChange}
      />
    );
  }

  // Standard layout (auto, home, other, business)
  return (
    <StandardCoverageLayout
      itemId={itemId}
      coverageDefinition={coverageDefinition}
      onSaveStatusChange={onSaveStatusChange}
    />
  );
}

/* ──────────────────────────────────────────────────────────────
   Shared hook: rows + limits auto-save
   ────────────────────────────────────────────────────────────── */

function useCoverageData(
  itemId: string,
  coverageDefinition: CoverageDefinition,
  onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "failed") => void,
) {
  const [rows, setRows] = useState<CoverageRowIn[]>([]);
  const [limits, setLimits] = useState<PlanLimitIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRows = useRef(rows);
  const latestLimits = useRef(limits);
  latestRows.current = rows;
  latestLimits.current = limits;

  // Fetch existing data
  useEffect(() => {
    (async () => {
      try {
        const [existingRows, existingLimits] = await Promise.all([
          api.coverage.getRows(itemId),
          api.coverage.getLimits(itemId),
        ]);

        if (existingRows.length > 0) {
          setRows(existingRows.map(rowToIn));
        } else {
          // Pre-populate from definition defaults
          setRows(
            coverageDefinition.default_rows.map((d) => ({
              service_key: d.key,
              service_label: d.label,
              sort_order: d.sort_order,
              in_deductible_applies: "no",
              out_deductible_applies: "no",
            })),
          );
        }

        if (existingLimits.length > 0) {
          setLimits(existingLimits.map(limitToIn));
        } else if (coverageDefinition.plan_limits.length > 0) {
          setLimits(
            coverageDefinition.plan_limits.map((l) => ({
              limit_key: l.key,
              limit_label: l.label,
              sort_order: l.sort_order,
            })),
          );
        }

        setInitialized(true);
      } catch (err) {
        console.error("Failed to load coverage data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [itemId, coverageDefinition]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      onSaveStatusChange?.("saving");
      try {
        const promises: Promise<unknown>[] = [
          api.coverage.upsertRows({ item_id: itemId, rows: latestRows.current }),
        ];
        if (latestLimits.current.length > 0) {
          promises.push(
            api.coverage.upsertLimits({ item_id: itemId, limits: latestLimits.current }),
          );
        }
        await Promise.all(promises);
        onSaveStatusChange?.("saved");
      } catch (err) {
        console.error("Failed to save coverage:", err);
        onSaveStatusChange?.("failed");
      }
    }, 800);
  }, [itemId, onSaveStatusChange]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function updateRow(index: number, partial: Partial<CoverageRowIn>) {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...partial };
      return updated;
    });
    if (initialized) scheduleSave();
  }

  function addRow(key: string, label: string) {
    setRows((prev) => [
      ...prev,
      {
        service_key: key,
        service_label: label,
        sort_order: prev.length,
      },
    ]);
    scheduleSave();
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    scheduleSave();
  }

  function updateLimit(index: number, value: string) {
    setLimits((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], limit_value: value || null };
      return updated;
    });
    if (initialized) scheduleSave();
  }

  return {
    rows,
    limits,
    loading,
    updateRow,
    addRow,
    removeRow,
    updateLimit,
  };
}

function rowToIn(r: CoverageRow): CoverageRowIn {
  return {
    service_key: r.service_key,
    service_label: r.service_label,
    sort_order: r.sort_order,
    in_copay: r.in_copay,
    in_coinsurance: r.in_coinsurance,
    in_deductible_applies: r.in_deductible_applies,
    in_notes: r.in_notes,
    out_copay: r.out_copay,
    out_coinsurance: r.out_coinsurance,
    out_deductible_applies: r.out_deductible_applies,
    out_notes: r.out_notes,
    coverage_limit: r.coverage_limit,
    deductible: r.deductible,
    notes: r.notes,
  };
}

function limitToIn(l: PlanLimit): PlanLimitIn {
  return {
    limit_key: l.limit_key,
    limit_label: l.limit_label,
    limit_value: l.limit_value,
    sort_order: l.sort_order,
  };
}

/* ──────────────────────── Tooltip text ──────────────────────── */

const LIMIT_TOOLTIPS: Record<string, string> = {
  deductible_individual_in: "The amount one person must pay out-of-pocket before the plan starts paying for in-network care.",
  deductible_family_in: "The combined amount the family must pay out-of-pocket before the plan starts paying for in-network care.",
  oop_max_individual_in: "The most one person will pay in a year for in-network care. After this, the plan covers 100%.",
  oop_max_family_in: "The most the family will pay combined in a year for in-network care. After this, the plan covers 100%.",
  deductible_individual_out: "The amount one person must pay out-of-pocket before the plan starts paying for out-of-network care.",
  deductible_family_out: "The combined amount the family must pay out-of-pocket before the plan starts paying for out-of-network care.",
  oop_max_individual_out: "The most one person will pay in a year for out-of-network care. After this, the plan covers 100%.",
  oop_max_family_out: "The most the family will pay combined in a year for out-of-network care. After this, the plan covers 100%.",
};

/* ──────────────────────────────────────────────────────────────
   HEALTH INSURANCE LAYOUT
   ────────────────────────────────────────────────────────────── */

function HealthCoverageLayout({
  itemId,
  coverageDefinition,
  onSaveStatusChange,
}: {
  itemId: string;
  coverageDefinition: CoverageDefinition;
  onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "failed") => void;
}) {
  const { rows, limits, loading, updateRow, addRow, removeRow, updateLimit } =
    useCoverageData(itemId, coverageDefinition, onSaveStatusChange);

  const [providers, setProviders] = useState<InNetworkProviderType[]>([]);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderSpecialty, setNewProviderSpecialty] = useState("");
  const [newProviderPhone, setNewProviderPhone] = useState("");
  const [newProviderAddress, setNewProviderAddress] = useState("");
  const [addingCustomRow, setAddingCustomRow] = useState(false);
  const [customRowLabel, setCustomRowLabel] = useState("");

  useEffect(() => {
    api.coverage.getProviders(itemId).then(setProviders).catch(() => {});
  }, [itemId]);

  async function handleAddProvider() {
    if (!newProviderName.trim()) return;
    try {
      const p = await api.coverage.createProvider({
        item_id: itemId,
        provider_name: newProviderName.trim(),
        specialty: newProviderSpecialty.trim() || null,
        phone: newProviderPhone.trim() || null,
        address: newProviderAddress.trim() || null,
      });
      setProviders((prev) => [...prev, p]);
      setNewProviderName("");
      setNewProviderSpecialty("");
      setNewProviderPhone("");
      setNewProviderAddress("");
      setShowProviderForm(false);
    } catch (err) {
      console.error("Failed to add provider:", err);
    }
  }

  async function handleDeleteProvider(id: string) {
    try {
      await api.coverage.deleteProvider(id);
      setProviders((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete provider:", err);
    }
  }

  function handleAddCustomRow() {
    if (!customRowLabel.trim()) return;
    const key = `custom_${Date.now()}`;
    addRow(key, customRowLabel.trim());
    setCustomRowLabel("");
    setAddingCustomRow(false);
  }

  // Group rows by section for health insurance
  const rowsBySection = React.useMemo(() => {
    const sectionMap = new Map<string, typeof rows>();
    const sectionOrder: string[] = [];

    // Get section info from coverage definition
    const sectionLookup = new Map<string, string>();
    coverageDefinition.default_rows.forEach((def) => {
      if (def.section) {
        sectionLookup.set(def.key, def.section);
      }
    });

    rows.forEach((row) => {
      const section = sectionLookup.get(row.service_key) || "";
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
        sectionOrder.push(section);
      }
      sectionMap.get(section)!.push(row);
    });

    return { sectionMap, sectionOrder };
  }, [rows, coverageDefinition]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const inLimits = limits.filter((l) => l.limit_key.endsWith("_in"));
  const outLimits = limits.filter((l) => l.limit_key.endsWith("_out"));

  return (
    <div className="space-y-6">
      {/* Plan Limits */}
      {limits.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Plan Limits</h3>
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-green-700 mb-3 uppercase tracking-wider">In-Network</p>
                  <div className="space-y-3">
                    {inLimits.map((lim) => {
                      const idx = limits.findIndex((l) => l.limit_key === lim.limit_key);
                      return (
                        <div key={lim.limit_key} className="flex items-center gap-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-gray-600 w-36 shrink-0 cursor-help flex items-center gap-1">
                                {lim.limit_label}
                                <HelpCircle className="h-2.5 w-2.5 text-gray-300" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[220px] text-xs">
                              {LIMIT_TOOLTIPS[lim.limit_key] || `The ${lim.limit_label.toLowerCase()} for in-network services.`}
                            </TooltipContent>
                          </Tooltip>
                          <Input
                            value={lim.limit_value || ""}
                            onChange={(e) => updateLimit(idx, e.target.value)}
                            placeholder="$0"
                            className="h-8 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-orange-700 mb-3 uppercase tracking-wider">Out-of-Network</p>
                  <div className="space-y-3">
                    {outLimits.map((lim) => {
                      const idx = limits.findIndex((l) => l.limit_key === lim.limit_key);
                      return (
                        <div key={lim.limit_key} className="flex items-center gap-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-gray-600 w-36 shrink-0 cursor-help flex items-center gap-1">
                                {lim.limit_label}
                                <HelpCircle className="h-2.5 w-2.5 text-gray-300" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[220px] text-xs">
                              {LIMIT_TOOLTIPS[lim.limit_key] || `The ${lim.limit_label.toLowerCase()} for out-of-network services.`}
                            </TooltipContent>
                          </Tooltip>
                          <Input
                            value={lim.limit_value || ""}
                            onChange={(e) => updateLimit(idx, e.target.value)}
                            placeholder="$0"
                            className="h-8 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}

      {/* Service Coverage — inline table layout */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-gray-900">Service Coverage</h3>
          </div>

          {/* Table Header */}
          <TooltipProvider delayDuration={200}>
            {/* Top-level header: In-Network / Out-of-Network */}
            <div className="grid grid-cols-[minmax(180px,1fr)_repeat(6,minmax(90px,1fr))] gap-2 px-6 py-2 bg-gray-50 border-t text-xs font-semibold uppercase tracking-wider">
              <div></div>
              <div className="col-span-3 text-center text-green-700">In-Network</div>
              <div className="col-span-3 text-center text-orange-700">Out-of-Network</div>
            </div>
            {/* Sub-headers: Copay, Coins., Ded? */}
            <div className="grid grid-cols-[minmax(180px,1fr)_repeat(6,minmax(90px,1fr))] gap-2 px-6 py-2 bg-gray-50 border-b text-[10px] font-medium uppercase tracking-wider">
              <div className="text-gray-500">Service</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-gray-600 text-center cursor-help flex items-center justify-center gap-0.5">
                    Copay <HelpCircle className="h-2.5 w-2.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Fixed amount you pay at visit (e.g. $30).
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-gray-600 text-center cursor-help flex items-center justify-center gap-0.5">
                    Coins. <HelpCircle className="h-2.5 w-2.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Percentage you pay after deductible (e.g. 20%).
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-gray-600 text-center cursor-help flex items-center justify-center gap-0.5">
                    Ded? <HelpCircle className="h-2.5 w-2.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Must meet deductible before coverage?
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-gray-600 text-center cursor-help flex items-center justify-center gap-0.5">
                    Copay <HelpCircle className="h-2.5 w-2.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Fixed amount you pay at visit.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-gray-600 text-center cursor-help flex items-center justify-center gap-0.5">
                    Coins. <HelpCircle className="h-2.5 w-2.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Percentage you pay after deductible.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-gray-600 text-center cursor-help flex items-center justify-center gap-0.5">
                    Ded? <HelpCircle className="h-2.5 w-2.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Must meet deductible before coverage?
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* Service rows grouped by section */}
          {rowsBySection.sectionOrder.map((section, sectionIdx) => {
            const sectionRows = rowsBySection.sectionMap.get(section) || [];
            return (
              <React.Fragment key={section || `section-${sectionIdx}`}>
                {/* Section Header */}
                {section && (
                  <div className="px-6 py-2 bg-gray-100 border-b">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {section}
                    </h4>
                  </div>
                )}

                {/* Section Rows */}
                {sectionRows.map((row) => {
                  const globalIndex = rows.findIndex(r => r.service_key === row.service_key);
                  return (
                    <div
                      key={row.service_key}
                      className="group grid grid-cols-[minmax(180px,1fr)_repeat(6,minmax(90px,1fr))] gap-2 px-6 py-2 border-b last:border-b-0 hover:bg-gray-50/50 items-center"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-800">{row.service_label}</span>
                        <button
                          type="button"
                          onClick={() => removeRow(globalIndex)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {/* In-network fields */}
                      <Input
                        value={row.in_copay || ""}
                        onChange={(e) => updateRow(globalIndex, { in_copay: e.target.value || null })}
                        placeholder="$0"
                        className="h-7 text-xs text-center"
                      />
                      <Input
                        value={row.in_coinsurance || ""}
                        onChange={(e) => updateRow(globalIndex, { in_coinsurance: e.target.value || null })}
                        placeholder="0%"
                        className="h-7 text-xs text-center"
                      />
                      <div className="flex items-center justify-center">
                        <Switch
                          checked={row.in_deductible_applies === "yes"}
                          onCheckedChange={(checked) => updateRow(globalIndex, { in_deductible_applies: checked ? "yes" : "no" })}
                        />
                      </div>
                      {/* Out-of-network fields */}
                      <Input
                        value={row.out_copay || ""}
                        onChange={(e) => updateRow(globalIndex, { out_copay: e.target.value || null })}
                        placeholder="$0"
                        className="h-7 text-xs text-center"
                      />
                      <Input
                        value={row.out_coinsurance || ""}
                        onChange={(e) => updateRow(globalIndex, { out_coinsurance: e.target.value || null })}
                        placeholder="0%"
                        className="h-7 text-xs text-center"
                      />
                      <div className="flex items-center justify-center">
                        <Switch
                          checked={row.out_deductible_applies === "yes"}
                          onCheckedChange={(checked) => updateRow(globalIndex, { out_deductible_applies: checked ? "yes" : "no" })}
                        />
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {rows.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              No coverage rows yet. Click below to add one.
            </div>
          )}

          {/* Add Custom Row */}
          <div className="px-6 py-3 border-t">
            {addingCustomRow ? (
              <div className="flex items-center gap-2">
                <Input
                  value={customRowLabel}
                  onChange={(e) => setCustomRowLabel(e.target.value)}
                  placeholder="Service name..."
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCustomRow();
                    if (e.key === "Escape") { setAddingCustomRow(false); setCustomRowLabel(""); }
                  }}
                />
                <Button size="sm" className="h-8 text-xs" onClick={handleAddCustomRow} disabled={!customRowLabel.trim()}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingCustomRow(false); setCustomRowLabel(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCustomRow(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Service
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* In-Network Providers */}
      {coverageDefinition.supports_providers && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">In-Network Providers</h3>
              <button
                type="button"
                onClick={() => setShowProviderForm(!showProviderForm)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                {showProviderForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>

            {showProviderForm && (
              <div className="rounded-lg border bg-gray-50 p-3 mb-4 space-y-2.5">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Provider / Hospital Name</Label>
                  <Input
                    value={newProviderName}
                    onChange={(e) => setNewProviderName(e.target.value)}
                    placeholder="e.g. Mount Sinai Hospital"
                    className="h-8 text-sm bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Specialty</Label>
                    <Input
                      value={newProviderSpecialty}
                      onChange={(e) => setNewProviderSpecialty(e.target.value)}
                      placeholder="e.g. Primary Care"
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Phone</Label>
                    <Input
                      value={newProviderPhone}
                      onChange={(e) => setNewProviderPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Address</Label>
                  <Input
                    value={newProviderAddress}
                    onChange={(e) => setNewProviderAddress(e.target.value)}
                    placeholder="123 Medical Center Dr..."
                    className="h-8 text-sm bg-white"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={handleAddProvider}
                    disabled={!newProviderName.trim()}
                  >
                    Add Provider
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => setShowProviderForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {providers.length === 0 && !showProviderForm && (
              <p className="text-xs text-gray-400">No in-network providers added</p>
            )}

            {providers.length > 0 && (
              <div className="space-y-2">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-start gap-3 rounded-lg border p-3 hover:bg-gray-50 transition-colors"
                  >
                    <Building2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{p.provider_name}</p>
                      {p.specialty && (
                        <p className="text-xs text-gray-500 mt-0.5">{p.specialty}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-blue-500 hover:underline">
                            <Phone className="h-3 w-3" />
                            {p.phone}
                          </a>
                        )}
                        {p.address && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {p.address}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteProvider(p.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   STANDARD LAYOUT (Auto, Home, Other, Business Insurance)
   ────────────────────────────────────────────────────────────── */

function StandardCoverageLayout({
  itemId,
  coverageDefinition,
  onSaveStatusChange,
}: {
  itemId: string;
  coverageDefinition: CoverageDefinition;
  onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "failed") => void;
}) {
  const { rows, loading, updateRow, addRow, removeRow } = useCoverageData(
    itemId,
    coverageDefinition,
    onSaveStatusChange,
  );

  const [addingCustomRow, setAddingCustomRow] = useState(false);
  const [customRowLabel, setCustomRowLabel] = useState("");

  function handleAddCustomRow() {
    if (!customRowLabel.trim()) return;
    const key = `custom_${Date.now()}`;
    addRow(key, customRowLabel.trim());
    setCustomRowLabel("");
    setAddingCustomRow(false);
  }

  // Group rows by section for auto insurance
  const rowsBySection = React.useMemo(() => {
    const sectionMap = new Map<string, typeof rows>();
    const sectionOrder: string[] = [];

    // Get section info from coverage definition
    const sectionLookup = new Map<string, string>();
    coverageDefinition.default_rows.forEach((def) => {
      if (def.section) {
        sectionLookup.set(def.key, def.section);
      }
    });

    rows.forEach((row) => {
      const section = sectionLookup.get(row.service_key) || "";
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
        sectionOrder.push(section);
      }
      sectionMap.get(section)!.push(row);
    });

    return { sectionMap, sectionOrder };
  }, [rows, coverageDefinition]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-gray-900">Coverage Details</h3>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_150px_150px_200px] gap-2 px-6 py-2 bg-gray-50 border-y text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          <div>Coverage</div>
          <div className="text-center">Limit</div>
          <div className="text-center">Deductible</div>
          <div>Notes</div>
        </div>

        {/* Rows grouped by section */}
        {rowsBySection.sectionOrder.map((section, sectionIdx) => {
          const sectionRows = rowsBySection.sectionMap.get(section) || [];
          return (
            <React.Fragment key={section || `section-${sectionIdx}`}>
              {/* Section Header */}
              {section && (
                <div className="px-6 py-2 bg-gray-100 border-b">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {section}
                  </h4>
                </div>
              )}

              {/* Section Rows */}
              {sectionRows.map((row) => {
                const globalIndex = rows.findIndex(r => r.service_key === row.service_key);
                return (
                  <div
                    key={row.service_key}
                    className="group grid grid-cols-[1fr_150px_150px_200px] gap-2 px-6 py-2 border-b last:border-b-0 hover:bg-gray-50/50 items-center"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-800">{row.service_label}</span>
                      <button
                        type="button"
                        onClick={() => removeRow(globalIndex)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <Input
                      value={row.coverage_limit || ""}
                      onChange={(e) => updateRow(globalIndex, { coverage_limit: e.target.value || null })}
                      placeholder="$0"
                      className="h-7 text-xs text-center"
                    />
                    <Input
                      value={row.deductible || ""}
                      onChange={(e) => updateRow(globalIndex, { deductible: e.target.value || null })}
                      placeholder="$0"
                      className="h-7 text-xs text-center"
                    />
                    <Input
                      value={row.notes || ""}
                      onChange={(e) => updateRow(globalIndex, { notes: e.target.value || null })}
                      placeholder="Notes..."
                      className="h-7 text-xs"
                    />
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}

        {rows.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            No coverage rows yet. Click below to add one.
          </div>
        )}

        {/* Add Custom Row */}
        <div className="px-6 py-3 border-t">
          {addingCustomRow ? (
            <div className="flex items-center gap-2">
              <Input
                value={customRowLabel}
                onChange={(e) => setCustomRowLabel(e.target.value)}
                placeholder="Coverage name..."
                className="h-8 text-sm flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCustomRow();
                  if (e.key === "Escape") { setAddingCustomRow(false); setCustomRowLabel(""); }
                }}
              />
              <Button size="sm" className="h-8 text-xs" onClick={handleAddCustomRow} disabled={!customRowLabel.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingCustomRow(false); setCustomRowLabel(""); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCustomRow(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Coverage
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────
   LIFE INSURANCE LAYOUT
   ────────────────────────────────────────────────────────────── */

function LifeCoverageLayout({
  itemId,
  coverageDefinition,
  onSaveStatusChange,
}: {
  itemId: string;
  coverageDefinition: CoverageDefinition;
  onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "failed") => void;
}) {
  const { rows, loading, updateRow, addRow, removeRow } = useCoverageData(
    itemId,
    coverageDefinition,
    onSaveStatusChange,
  );

  const [addingCustomRow, setAddingCustomRow] = useState(false);
  const [customRowLabel, setCustomRowLabel] = useState("");

  function handleAddCustomRow() {
    if (!customRowLabel.trim()) return;
    const key = `custom_${Date.now()}`;
    addRow(key, customRowLabel.trim());
    setCustomRowLabel("");
    setAddingCustomRow(false);
  }

  // Group rows by section for life insurance
  const rowsBySection = React.useMemo(() => {
    const sectionMap = new Map<string, typeof rows>();
    const sectionOrder: string[] = [];

    // Get section info from coverage definition
    const sectionLookup = new Map<string, string>();
    coverageDefinition.default_rows.forEach((def) => {
      if (def.section) {
        sectionLookup.set(def.key, def.section);
      }
    });

    rows.forEach((row) => {
      const section = sectionLookup.get(row.service_key) || "";
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
        sectionOrder.push(section);
      }
      sectionMap.get(section)!.push(row);
    });

    return { sectionMap, sectionOrder };
  }, [rows, coverageDefinition]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-gray-900">Policy Details</h3>
        </div>

        {rowsBySection.sectionOrder.map((section, sectionIdx) => {
          const sectionRows = rowsBySection.sectionMap.get(section) || [];
          return (
            <React.Fragment key={section || `section-${sectionIdx}`}>
              {/* Section Header */}
              {section && (
                <div className="px-6 py-2 bg-gray-100 border-y">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {section}
                  </h4>
                </div>
              )}

              {/* Section Rows */}
              {sectionRows.map((row, localIdx) => {
                const globalIndex = rows.findIndex(r => r.service_key === row.service_key);
                return (
                  <div key={row.service_key}>
                    {localIdx > 0 && <Separator />}
                    <div className="group flex items-center gap-4 px-6 py-4 min-h-[56px] hover:bg-gray-50/50">
                      <div className="flex items-center gap-1.5 w-44 shrink-0">
                        <span className="text-sm font-medium text-gray-600">{row.service_label}</span>
                        <button
                          type="button"
                          onClick={() => removeRow(globalIndex)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex-1">
                        <Input
                          value={row.notes || ""}
                          onChange={(e) => updateRow(globalIndex, { notes: e.target.value || null })}
                          placeholder={`+ ${row.service_label}`}
                          className="border-none shadow-none p-0 h-auto text-sm focus-visible:ring-0 placeholder:text-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}

        {rows.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            No policy details yet. Click below to add one.
          </div>
        )}

        {/* Add Custom Row */}
        <Separator />
        <div className="px-6 py-3">
          {addingCustomRow ? (
            <div className="flex items-center gap-2">
              <Input
                value={customRowLabel}
                onChange={(e) => setCustomRowLabel(e.target.value)}
                placeholder="Detail name..."
                className="h-8 text-sm flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCustomRow();
                  if (e.key === "Escape") { setAddingCustomRow(false); setCustomRowLabel(""); }
                }}
              />
              <Button size="sm" className="h-8 text-xs" onClick={handleAddCustomRow} disabled={!customRowLabel.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingCustomRow(false); setCustomRowLabel(""); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCustomRow(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Detail
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
