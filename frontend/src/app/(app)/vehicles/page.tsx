"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Car, Plus, Search, Loader2, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import type { Vehicle } from "@/lib/api";

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formName, setFormName] = useState("");
  const [formPlate, setFormPlate] = useState("");
  const [formVin, setFormVin] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.vehicles.list();
      setVehicles(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const filtered = vehicles.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.license_plate && v.license_plate.toLowerCase().includes(q)) ||
      (v.vin && v.vin.toLowerCase().includes(q))
    );
  });

  const openEdit = (e: React.MouseEvent, v: Vehicle) => {
    e.stopPropagation();
    setEditingVehicle(v);
    setFormName(v.name);
    setFormPlate(v.license_plate || "");
    setFormVin(v.vin || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingVehicle) {
        await api.vehicles.update(editingVehicle.id, {
          name: formName.trim(),
          license_plate: formPlate.trim() || null,
          vin: formVin.trim() || null,
        });
      } else {
        await api.vehicles.create({
          name: formName.trim(),
          license_plate: formPlate.trim() || null,
          vin: formVin.trim() || null,
        });
      }
      setDialogOpen(false);
      fetchVehicles();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.vehicles.delete(id);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch {
      // silently fail
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Car className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
            <p className="text-sm text-gray-600">
              Manage your vehicles and assign them to insurance policies
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/vehicles/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search vehicles..."
            aria-label="Search vehicles"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <EmptyState
          loading={loading}
          icon={<Car className="mx-auto h-12 w-12 text-gray-400 mb-4" />}
          spinnerClass="text-blue-600"
          hasResults={filtered.length > 0}
          searchActive={!!searchQuery}
          entityName="vehicles"
          onAdd={() => router.push("/vehicles/new")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
            {filtered.map((vehicle) => (
              <Card
                key={vehicle.id}
                className="group cursor-pointer hover:shadow-lg transition-shadow relative"
                role="link"
                tabIndex={0}
                aria-label={`View ${vehicle.name}`}
                onClick={() => router.push(`/vehicles/${vehicle.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/vehicles/${vehicle.id}`); } }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Vehicle Icon */}
                    <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Car className="w-6 h-6 text-blue-600" />
                    </div>

                    {/* Vehicle Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate mb-1">
                        {vehicle.name}
                      </h3>
                      <div className="space-y-0.5">
                        {vehicle.license_plate && (
                          <p className="text-xs text-gray-600 truncate">
                            Plate: {vehicle.license_plate}
                          </p>
                        )}
                        {vehicle.owner_name && (
                          <p className="text-xs text-gray-600 truncate">
                            Owner: {vehicle.owner_name}
                          </p>
                        )}
                        {!vehicle.license_plate && !vehicle.owner_name && vehicle.vin && (
                          <p className="text-xs text-gray-600 truncate">
                            VIN: {vehicle.vin}
                          </p>
                        )}
                        {!vehicle.license_plate && !vehicle.owner_name && !vehicle.vin && (
                          <p className="text-xs text-gray-500 truncate">
                            No details
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Hover actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 bg-white/90 hover:bg-white shadow-sm"
                        aria-label={`Edit ${vehicle.name}`}
                        onClick={(e) => openEdit(e, vehicle)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-gray-600" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 bg-white/90 hover:bg-white shadow-sm"
                            aria-label={`Delete ${vehicle.name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete &quot;{vehicle.name}&quot; and remove it from all
                              insurance policies it&apos;s assigned to. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => handleDelete(e, vehicle.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </EmptyState>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingVehicle ? "Edit Vehicle" : "Add Vehicle"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 2020 Toyota Camry"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">License Plate</Label>
              <Input
                value={formPlate}
                onChange={(e) => setFormPlate(e.target.value)}
                placeholder="e.g. ABC-1234"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">VIN</Label>
              <Input
                value={formVin}
                onChange={(e) => setFormVin(e.target.value)}
                placeholder="17-character VIN"
                maxLength={17}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!formName.trim() || saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingVehicle ? "Save Changes" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
