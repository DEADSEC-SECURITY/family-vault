"use client";

import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Item } from "@/lib/api";
import { IDItemCard } from "./IDItemCard";
import { InsuranceItemCard } from "./InsuranceItemCard";
import { BusinessItemCard } from "./BusinessItemCard";

interface ItemCardProps {
  item: Item;
  categorySlug: string;
}

export function ItemCard({ item, categorySlug }: ItemCardProps) {
  if (categorySlug === "ids") return <IDItemCard item={item} categorySlug={categorySlug} />;
  if (categorySlug === "insurance") return <InsuranceItemCard item={item} categorySlug={categorySlug} />;
  if (categorySlug === "business") return <BusinessItemCard item={item} categorySlug={categorySlug} />;

  // Fallback for unknown categories
  const previewFields = item.fields
    .filter((f) => f.field_value)
    .slice(0, 2);

  return (
    <Link href={`/${categorySlug}/${item.id}`}>
      <Card className={`transition-shadow hover:shadow-md cursor-pointer h-full ${item.is_archived ? "opacity-60" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
              {item.is_archived && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-gray-200 text-gray-600">
                  Expired
                </Badge>
              )}
            </div>
            {item.files.length > 0 && (
              <Paperclip className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
            )}
          </div>
          {previewFields.length > 0 && (
            <div className="mt-2 space-y-1">
              {previewFields.map((f) => (
                <p key={f.field_key} className="text-xs text-gray-500 truncate">
                  {f.field_value}
                </p>
              ))}
            </div>
          )}
          {item.files.length > 0 && (
            <p className="mt-2 text-xs text-gray-400">
              {item.files.length} file{item.files.length > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
