"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BookUser, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { SavedContact } from "@/lib/api";

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.savedContacts.list();
      setContacts(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = contacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.role && c.role.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <BookUser className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm text-gray-600">
              Manage professional contacts and service providers
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/contacts/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search contacts..."
            aria-label="Search contacts"
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
          icon={<BookUser className="mx-auto h-12 w-12 text-gray-400 mb-4" />}
          spinnerClass="text-teal-600"
          hasResults={filtered.length > 0}
          searchActive={!!searchQuery}
          entityName="contacts"
          onAdd={() => router.push("/contacts/new")}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-6">
            {filtered.map((contact) => (
              <Card
                key={contact.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                role="link"
                tabIndex={0}
                aria-label={`View ${contact.name}`}
                onClick={() => router.push(`/contacts/${contact.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/contacts/${contact.id}`); } }}
              >
                <CardContent className="p-4">
                  {/* Avatar */}
                  <div className="aspect-square mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {getInitials(contact.name)}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="font-semibold text-sm text-gray-900 truncate">
                    {contact.name}
                  </h3>

                  {/* Role / Company */}
                  {(contact.role || contact.company) && (
                    <p className="text-xs text-gray-600 truncate">
                      {contact.role}
                      {contact.role && contact.company && " at "}
                      {contact.company}
                    </p>
                  )}

                  {/* Phone */}
                  {contact.phone && (
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {contact.phone}
                    </p>
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
