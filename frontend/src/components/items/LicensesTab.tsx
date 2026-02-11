"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FileCheck, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { LinkedChild } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface LicensesTabProps {
  itemId: string;
  categorySlug: string;
}

export function LicensesTab({ itemId, categorySlug }: LicensesTabProps) {
  const router = useRouter();
  const [licenses, setLicenses] = useState<LinkedChild[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.itemLinks.getChildren(itemId);
      setLicenses(data.filter((c) => c.subcategory === "business_license"));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (licenses.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileCheck className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">
          No licenses linked to this business.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Create a Business License and use its &quot;Linked Business&quot; selector to connect it here.
        </p>
      </div>
    );
  }

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="space-y-2">
      {licenses.map((license) => {
        const expired = isExpired(license.expiration_date);
        return (
          <Card
            key={license.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            role="link"
            tabIndex={0}
            aria-label={`View ${license.name}`}
            onClick={() => router.push(`/${categorySlug}/${license.item_id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/${categorySlug}/${license.item_id}`);
              }
            }}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-5 h-5 text-amber-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {license.name}
                  </h4>
                  {license.is_archived && (
                    <span className="inline-flex px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">
                      Archived
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {license.license_type && (
                    <span className="text-xs text-gray-500 truncate">
                      {license.license_type}
                    </span>
                  )}
                  {license.issuing_authority && (
                    <span className="text-xs text-gray-400 truncate">
                      {license.issuing_authority}
                    </span>
                  )}
                  {license.expiration_date && (
                    <span
                      className={`text-xs flex items-center gap-1 ml-auto ${
                        expired ? "text-red-500" : "text-gray-500"
                      }`}
                    >
                      {expired && <AlertTriangle className="h-3 w-3" />}
                      {expired ? "Expired" : "Expires"} {formatDate(license.expiration_date)}
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
