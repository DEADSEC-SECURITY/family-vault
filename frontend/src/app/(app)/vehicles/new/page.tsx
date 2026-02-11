"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Car, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Person } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function NewVehiclePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
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

  // Load people for selectors
  useEffect(() => {
    const loadPeople = async () => {
      try {
        const data = await api.people.list();
        setPeople(data);
      } catch (err) {
        console.error("Failed to load people:", err);
      }
    };
    loadPeople();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Vehicle name is required.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const vehicle = await api.vehicles.create({
        name: name.trim(),
        license_plate: licensePlate.trim() || null,
        vin: vin.trim() || null,
        acquired_date: acquiredDate || null,
        owner_id: ownerId,
        primary_driver_id: primaryDriverId,
      });
      router.push(`/vehicles/${vehicle.id}`);
    } catch (err) {
      console.error("Failed to create vehicle:", err);
      setError("Failed to create vehicle. Please try again.");
    } finally {
      setSaving(false);
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-6">
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
            <h1 className="text-2xl font-bold text-gray-900">Add Vehicle</h1>
            <p className="text-sm text-gray-600">
              Create a new vehicle in your organization
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
            <CardTitle>Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 2020 Toyota Camry"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="licensePlate">License Plate</Label>
                <Input
                  id="licensePlate"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="e.g. ABC-1234"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vin">VIN</Label>
                <Input
                  id="vin"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  placeholder="17-character VIN"
                  maxLength={17}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acquiredDate">Date Acquired</Label>
                <Input
                  id="acquiredDate"
                  type="date"
                  value={acquiredDate}
                  onChange={(e) => setAcquiredDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryDriver">Primary Driver</Label>
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
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/vehicles")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!name.trim() || saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Vehicle
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
