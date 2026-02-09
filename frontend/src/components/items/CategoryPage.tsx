"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CategoryDetail, Item } from "@/lib/api";
import { SubcategorySection } from "./SubcategorySection";

interface CategoryPageProps {
  categorySlug: string;
}

export function CategoryPage({ categorySlug }: CategoryPageProps) {
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cat, itemsRes] = await Promise.all([
        api.categories.get(categorySlug),
        api.items.list({ category: categorySlug, include_archived: showArchived }),
      ]);
      setCategory(cat);
      setItems(itemsRes.items);
    } catch (err) {
      console.error("Failed to load category:", err);
    } finally {
      setLoading(false);
    }
  }, [categorySlug, showArchived]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  if (!category) {
    return <div className="text-red-500">Category not found</div>;
  }

  const isInsurance = categorySlug === "insurance";

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {category.label}
        </h1>

        {isInsurance && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            Show past policies
          </label>
        )}
      </div>

      {category.subcategories.map((sub) => {
        const subItems = items.filter((i) => i.subcategory === sub.key);
        return (
          <SubcategorySection
            key={sub.key}
            subcategory={sub}
            items={subItems}
            categorySlug={categorySlug}
          />
        );
      })}
    </div>
  );
}
