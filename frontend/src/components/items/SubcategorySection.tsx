"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemCard } from "./ItemCard";
import type { Item, SubcategoryInfo } from "@/lib/api";

interface SubcategorySectionProps {
  subcategory: SubcategoryInfo;
  items: Item[];
  categorySlug: string;
}

export function SubcategorySection({
  subcategory,
  items,
  categorySlug,
}: SubcategorySectionProps) {
  const router = useRouter();

  function handleAdd() {
    router.push(`/${categorySlug}/new?subcategory=${subcategory.key}`);
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {subcategory.label}
        </h2>
        {subcategory.recommended && items.length === 0 && (
          <Badge variant="secondary" className="text-xs">
            Recommended
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} categorySlug={categorySlug} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">
          No {subcategory.label.toLowerCase()} added yet.
        </p>
      )}
    </section>
  );
}
