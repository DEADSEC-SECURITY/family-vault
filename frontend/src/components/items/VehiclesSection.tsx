/**
 * VehiclesSection.tsx — Org-wide vehicle management for auto insurance items.
 *
 * Rendered inside OverviewTab only when subcategory.key === "auto_insurance".
 * Shows vehicles assigned to this item with add/create/edit/unassign controls.
 *
 * FEATURES:
 *   - Lists vehicles assigned to the current item (name, plate, VIN)
 *   - "+ Add" button: create a new vehicle OR assign an existing org vehicle
 *   - Edit (pencil icon): inline edit name/plate/VIN
 *   - Remove (X): unassigns vehicle from item (does NOT delete from org)
 *   - Create mode: queues locally, saves after item creation
 *
 * API CALLS:
 *   api.vehicles.listForItem(itemId)  — GET assigned vehicles
 *   api.vehicles.list()               — GET all org vehicles (for "assign existing")
 *   api.vehicles.create(data)         — POST new vehicle to org
 *   api.vehicles.update(id, data)     — PATCH vehicle details
 *   api.vehicles.assign(itemId, vid)  — POST assign vehicle to item
 *   api.vehicles.unassign(itemId, vid)— DELETE unassign vehicle from item
 */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Car, Pencil, Plus, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { Vehicle } from "@/lib/api";


interface VehiclesSectionProps {
  itemId: string | undefined; // undefined in create mode
}

const emptyForm = { name: "", plate: "", vin: "" };

export function VehiclesSection({ itemId }: VehiclesSectionProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allOrgVehicles, setAllOrgVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"create" | "existing" | null>(null);
  const [busy, setBusy] = useState(false);

  // Consolidated form state
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<{ id: string | null } & typeof emptyForm>({ id: null, ...emptyForm });
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const fetchVehicles = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const data = await api.vehicles.listForItem(itemId);
      setVehicles(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const fetchOrgVehicles = useCallback(async () => {
    try {
      const data = await api.vehicles.list();
      setAllOrgVehicles(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Available vehicles = org vehicles not yet assigned to this item
  const assignedIds = new Set(vehicles.map((v) => v.id));
  const availableVehicles = allOrgVehicles.filter((v) => !assignedIds.has(v.id));

  const handleCreate = async () => {
    if (!itemId || !createForm.name.trim()) return;
    setBusy(true);
    try {
      const vehicle = await api.vehicles.create({
        name: createForm.name.trim(),
        license_plate: createForm.plate.trim() || null,
        vin: createForm.vin.trim() || null,
      });
      await api.vehicles.assign(itemId, vehicle.id);
      setCreateForm(emptyForm);
      setAddOpen(false);
      setAddMode(null);
      fetchVehicles();
    } catch {
      // silently fail
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async () => {
    if (!itemId || !selectedVehicleId) return;
    setBusy(true);
    try {
      await api.vehicles.assign(itemId, selectedVehicleId);
      setSelectedVehicleId("");
      setAddOpen(false);
      setAddMode(null);
      fetchVehicles();
    } catch {
      // silently fail
    } finally {
      setBusy(false);
    }
  };

  const handleUnassign = async (vehicleId: string) => {
    if (!itemId) return;
    try {
      await api.vehicles.unassign(itemId, vehicleId);
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    } catch {
      // silently fail
    }
  };

  const startEdit = (v: Vehicle) => {
    setEditForm({ id: v.id, name: v.name, plate: v.license_plate || "", vin: v.vin || "" });
  };

  const handleSaveEdit = async () => {
    if (!editForm.id || !editForm.name.trim()) return;
    setBusy(true);
    try {
      await api.vehicles.update(editForm.id, {
        name: editForm.name.trim(),
        license_plate: editForm.plate.trim() || null,
        vin: editForm.vin.trim() || null,
      });
      setEditForm({ id: null, ...emptyForm });
      fetchVehicles();
    } catch {
      // silently fail
    } finally {
      setBusy(false);
    }
  };

  const handleAddOpen = (open: boolean) => {
    setAddOpen(open);
    if (open) {
      fetchOrgVehicles();
      setAddMode(null);
      setCreateForm(emptyForm);
      setSelectedVehicleId("");
    }
  };

  if (!itemId) return null; // Don't show in create mode

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Vehicles Covered</h3>
        </div>
        <Popover open={addOpen} onOpenChange={handleAddOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            {!addMode ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-3">Add Vehicle</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-sm"
                  onClick={() => setAddMode("create")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Vehicle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-sm"
                  onClick={() => setAddMode("existing")}
                  disabled={availableVehicles.length === 0}
                >
                  <Car className="h-4 w-4 mr-2" />
                  Assign Existing Vehicle
                  {availableVehicles.length === 0 && (
                    <span className="ml-auto text-xs text-gray-400">None available</span>
                  )}
                </Button>
              </div>
            ) : addMode === "create" ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">New Vehicle</p>
                <div>
                  <Label className="text-xs text-gray-500">
                    Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. 2020 Toyota Camry"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">License Plate</Label>
                  <Input
                    value={createForm.plate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, plate: e.target.value }))}
                    placeholder="e.g. ABC-1234"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">VIN</Label>
                  <Input
                    value={createForm.vin}
                    onChange={(e) => setCreateForm((f) => ({ ...f, vin: e.target.value }))}
                    placeholder="17-character VIN"
                    maxLength={17}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddMode(null)}
                    className="text-xs"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreate}
                    disabled={!createForm.name.trim() || busy}
                    className="ml-auto text-xs"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 mr-1" />
                    )}
                    Create & Add
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Assign Existing Vehicle</p>
                {availableVehicles.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    All vehicles are already assigned to this item.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableVehicles.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className={`w-full text-left p-2 rounded text-sm hover:bg-gray-50 border ${
                            selectedVehicleId === v.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200"
                          }`}
                          onClick={() => setSelectedVehicleId(v.id)}
                        >
                          <span className="font-medium">{v.name}</span>
                          {(v.license_plate || v.vin) && (
                            <span className="block text-xs text-gray-500 mt-0.5">
                              {[
                                v.license_plate && `Plate: ${v.license_plate}`,
                                v.vin && `VIN: ${v.vin}`,
                              ]
                                .filter(Boolean)
                                .join(" \u00B7 ")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddMode(null)}
                        className="text-xs"
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAssign}
                        disabled={!selectedVehicleId || busy}
                        className="ml-auto text-xs"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1" />
                        )}
                        Assign
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading vehicles...
        </div>
      ) : vehicles.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          No vehicles assigned. Click + Add to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) =>
            editForm.id === v.id ? (
              /* ─── Edit mode row ─── */
              <div
                key={v.id}
                className="border border-blue-200 bg-blue-50/50 rounded-lg p-3 space-y-2"
              >
                <div>
                  <Label className="text-xs text-gray-500">Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">License Plate</Label>
                    <Input
                      value={editForm.plate}
                      onChange={(e) => setEditForm((f) => ({ ...f, plate: e.target.value }))}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">VIN</Label>
                    <Input
                      value={editForm.vin}
                      onChange={(e) => setEditForm((f) => ({ ...f, vin: e.target.value }))}
                      maxLength={17}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditForm({ id: null, ...emptyForm })}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editForm.name.trim() || busy}
                    className="text-xs"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              /* ─── Display mode row ─── */
              <div
                key={v.id}
                className="group flex items-start justify-between border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {v.name}
                    </span>
                  </div>
                  {(v.license_plate || v.vin) && (
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      {[
                        v.license_plate && `Plate: ${v.license_plate}`,
                        v.vin && `VIN: ${v.vin}`,
                      ]
                        .filter(Boolean)
                        .join(" \u00B7 ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                    onClick={() => startEdit(v)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                    onClick={() => handleUnassign(v.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
