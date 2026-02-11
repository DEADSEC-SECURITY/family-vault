"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FileText, ChevronRight, Loader2, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { LinkedChild } from "@/lib/api";

interface TaxDocsTabProps {
  itemId: string;
  categorySlug: string;
}

export function TaxDocsTab({ itemId, categorySlug }: TaxDocsTabProps) {
  const router = useRouter();
  const [items, setItems] = useState<LinkedChild[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.itemLinks.getChildren(itemId);
      setItems(data.filter((c) => c.subcategory === "tax_document"));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">
          No tax documents linked to this business.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Create a Tax Document and use its &quot;Linked Business&quot; selector to connect it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card
          key={item.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          role="link"
          tabIndex={0}
          aria-label={`View ${item.name}`}
          onClick={() => router.push(`/${categorySlug}/${item.item_id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(`/${categorySlug}/${item.item_id}`);
            }
          }}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {item.name}
                </h4>
                {item.is_archived && (
                  <span className="inline-flex px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">
                    Archived
                  </span>
                )}
                {item.tax_year && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded">
                    <Calendar className="h-2.5 w-2.5" />
                    {item.tax_year}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {item.document_type && (
                  <span className="text-xs text-gray-500 truncate">
                    {item.document_type}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
