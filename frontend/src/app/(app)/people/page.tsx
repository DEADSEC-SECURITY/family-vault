"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Users, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Person } from "@/lib/api";

export default function PeoplePage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.people.list();
      setPeople(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const filtered = people.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.relationship && p.relationship.toLowerCase().includes(q))
    );
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Users className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">People</h1>
            <p className="text-sm text-gray-600">
              Manage family members and beneficiaries
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/people/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Person
        </Button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search people..."
            aria-label="Search people"
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
          icon={<Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />}
          spinnerClass="text-violet-600"
          hasResults={filtered.length > 0}
          searchActive={!!searchQuery}
          entityName="people"
          onAdd={() => router.push("/people/new")}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-6">
            {filtered.map((person) => (
              <Card
                key={person.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                role="link"
                tabIndex={0}
                aria-label={`View ${person.first_name} ${person.last_name}`}
                onClick={() => router.push(`/people/${person.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/people/${person.id}`); } }}
              >
                <CardContent className="p-4">
                  {/* 1:1 Photo */}
                  <div className="aspect-square mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                    {person.photo_url ? (
                      <img
                        src={person.photo_url}
                        alt={`${person.first_name} ${person.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-white">
                        {getInitials(person.first_name, person.last_name)}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="font-semibold text-sm text-gray-900 truncate">
                    {person.first_name} {person.last_name}
                  </h3>

                  {/* Relation */}
                  {person.relationship && (
                    <p className="text-xs text-gray-600 truncate">
                      {person.relationship}
                    </p>
                  )}

                  {/* Login indicator */}
                  {person.can_login && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                      Login Access
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </EmptyState>
      </div>
    </div>
  );
}
