"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Car, Check, ChevronsUpDown, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Vehicle, Person } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vin, setVin] = useState("");
  const [acquiredDate, setAcquiredDate] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [primaryDriverId, setPrimaryDriverId] = useState<string | null>(null);

  // Person selector state
  const [people, setPeople] = useState<Person[]>([]);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [driverOpen, setDriverOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");

  // Policies state
  const [policies, setPolicies] = useState<
    Array<{
      id: string;
      name: string;
      is_archived: boolean;
      created_at: string;
      updated_at: string;
    }>
  >([]);

  // Unwrap params Promise and fetch vehicle
  useEffect(() => {
    let mounted = true;

    const loadVehicle = async () => {
      setLoading(true);
      try {
        const { id } = await params;
        setVehicleId(id);

        const [vehicleData, peopleData, policiesData] = await Promise.all([
          api.vehicles.get(id),
          api.people.list(),
          api.vehicles.getPolicies(id),
        ]);

        if (!mounted) return;

        setVehicle(vehicleData);
        setPeople(peopleData);
        setPolicies(policiesData);

        // Populate form state
        setName(vehicleData.name);
        setLicensePlate(vehicleData.license_plate || "");
        setVin(vehicleData.vin || "");
        setAcquiredDate(vehicleData.acquired_date || "");
        setOwnerId(vehicleData.owner_id);
        setPrimaryDriverId(vehicleData.primary_driver_id);
      } catch (err) {
        console.error("Failed to load vehicle:", err);
        if (mounted) {
          router.push("/vehicles");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadVehicle();

    return () => {
      mounted = false;
    };
  }, [params, router]);

  const handleSave = async () => {
    if (!vehicleId || !name.trim()) {
      setError("Vehicle name is required.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const updated = await api.vehicles.update(vehicleId, {
        name: name.trim(),
        license_plate: licensePlate.trim() || null,
        vin: vin.trim() || null,
        acquired_date: acquiredDate || null,
        owner_id: ownerId,
        primary_driver_id: primaryDriverId,
      });
      setVehicle(updated);
      setEditing(false);
    } catch (err) {
      console.error("Failed to update vehicle:", err);
      setError("Failed to update vehicle. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!vehicleId) return;

    setDeleting(true);
    try {
      await api.vehicles.delete(vehicleId);
      router.push("/vehicles");
    } catch (err) {
      console.error("Failed to delete vehicle:", err);
      setError("Failed to delete vehicle. Please try again.");
      setDeleting(false);
    }
  };

  const getOwnerName = () => {
    if (!ownerId) return "Select owner...";
    const owner = people.find((p) => p.id === ownerId);
    return owner ? `${owner.first_name} ${owner.last_name}` : "Select owner...";
  };

  const getDriverName = () => {
    if (!primaryDriverId) return "Select driver...";
    const driver = people.find((p) => p.id === primaryDriverId);
    return driver
      ? `${driver.first_name} ${driver.last_name}`
      : "Select driver...";
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-600">Vehicle not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to vehicles"
            onClick={() => router.push("/vehicles")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Car className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{vehicle.name}</h1>
              <p className="text-sm text-gray-600">
                {vehicle.license_plate && `Plate: ${vehicle.license_plate}`}
                {!vehicle.license_plate && vehicle.vin && `VIN: ${vehicle.vin}`}
                {!vehicle.license_plate && !vehicle.vin && "No plate or VIN"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{vehicle.name}&quot; and remove it
                  from all insurance policies it&apos;s assigned to. This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}
        <div className="grid gap-6 pb-6">
          {/* Vehicle Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  {editing ? (
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. 2020 Toyota Camry"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 py-2">{vehicle.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licensePlate">License Plate</Label>
                  {editing ? (
                    <Input
                      id="licensePlate"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      placeholder="e.g. ABC-1234"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 py-2">
                      {vehicle.license_plate || "—"}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN</Label>
                  {editing ? (
                    <Input
                      id="vin"
                      value={vin}
                      onChange={(e) => setVin(e.target.value)}
                      placeholder="17-character VIN"
                      maxLength={17}
                    />
                  ) : (
                    <p className="text-sm text-gray-900 py-2">
                      {vehicle.vin || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acquiredDate">Date Acquired</Label>
                  {editing ? (
                    <Input
                      id="acquiredDate"
                      type="date"
                      value={acquiredDate}
                      onChange={(e) => setAcquiredDate(e.target.value)}
                    />
                  ) : (
                    <p className="text-sm text-gray-900 py-2">
                      {vehicle.acquired_date
                        ? new Date(vehicle.acquired_date).toLocaleDateString()
                        : "—"}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner">Owner</Label>
                  {editing ? (
                    <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={ownerOpen}
                          className="w-full justify-between font-normal"
                        >
                          {getOwnerName()}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <div className="p-2 border-b">
                          <Input
                            placeholder="Search people..."
                            value={ownerSearch}
                            onChange={(e) => setOwnerSearch(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto p-1">
                          <button
                            type="button"
                            className={cn(
                              "relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors",
                              ownerId === null && "bg-blue-50"
                            )}
                            onClick={() => {
                              setOwnerId(null);
                              setOwnerOpen(false);
                              setOwnerSearch("");
                            }}
                          >
                            (None)
                            {ownerId === null && (
                              <Check className="ml-auto h-4 w-4 text-blue-600" />
                            )}
                          </button>
                          {people
                            .filter((p) => {
                              const fullName =
                                `${p.first_name} ${p.last_name}`.toLowerCase();
                              return fullName.includes(ownerSearch.toLowerCase());
                            })
                            .map((person) => (
                              <button
                                key={person.id}
                                type="button"
                                className={cn(
                                  "relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors",
                                  ownerId === person.id && "bg-blue-50"
                                )}
                                onClick={() => {
                                  setOwnerId(person.id);
                                  setOwnerOpen(false);
                                  setOwnerSearch("");
                                }}
                              >
                                {person.first_name} {person.last_name}
                                {ownerId === person.id && (
                                  <Check className="ml-auto h-4 w-4 text-blue-600" />
                                )}
                              </button>
                            ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <p className="text-sm text-gray-900 py-2">
                      {vehicle.owner_name || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryDriver">Primary Driver</Label>
                  {editing ? (
                    <Popover open={driverOpen} onOpenChange={setDriverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={driverOpen}
                          className="w-full justify-between font-normal"
                        >
                          {getDriverName()}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <div className="p-2 border-b">
                          <Input
                            placeholder="Search people..."
                            value={driverSearch}
                            onChange={(e) => setDriverSearch(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto p-1">
                          <button
                            type="button"
                            className={cn(
                              "relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors",
                              primaryDriverId === null && "bg-blue-50"
                            )}
                            onClick={() => {
                              setPrimaryDriverId(null);
                              setDriverOpen(false);
                              setDriverSearch("");
                            }}
                          >
                            (None)
                            {primaryDriverId === null && (
                              <Check className="ml-auto h-4 w-4 text-blue-600" />
                            )}
                          </button>
                          {people
                            .filter((p) => {
                              const fullName =
                                `${p.first_name} ${p.last_name}`.toLowerCase();
                              return fullName.includes(driverSearch.toLowerCase());
                            })
                            .map((person) => (
                              <button
                                key={person.id}
                                type="button"
                                className={cn(
                                  "relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors",
                                  primaryDriverId === person.id && "bg-blue-50"
                                )}
                                onClick={() => {
                                  setPrimaryDriverId(person.id);
                                  setDriverOpen(false);
                                  setDriverSearch("");
                                }}
                              >
                                {person.first_name} {person.last_name}
                                {primaryDriverId === person.id && (
                                  <Check className="ml-auto h-4 w-4 text-blue-600" />
                                )}
                              </button>
                            ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <p className="text-sm text-gray-900 py-2">
                      {vehicle.primary_driver_name || "—"}
                    </p>
                  )}
                </div>
              </div>

              {editing && (
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      // Reset form
                      setName(vehicle.name);
                      setLicensePlate(vehicle.license_plate || "");
                      setVin(vehicle.vin || "");
                      setAcquiredDate(vehicle.acquired_date || "");
                      setOwnerId(vehicle.owner_id);
                      setPrimaryDriverId(vehicle.primary_driver_id);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={!name.trim() || saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Policies Card */}
          <Card>
            <CardHeader>
              <CardTitle>Insurance Policies</CardTitle>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No insurance policies associated with this vehicle.
                </p>
              ) : (
                <div className="space-y-2">
                  {policies.map((policy) => (
                    <button
                      key={policy.id}
                      type="button"
                      className="flex items-center justify-between w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/insurance/${policy.id}`)}
                      aria-label={`View policy: ${policy.name}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {policy.name}
                            {policy.is_archived && (
                              <span className="ml-2 text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                Expired
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-600">
                            Created {new Date(policy.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
