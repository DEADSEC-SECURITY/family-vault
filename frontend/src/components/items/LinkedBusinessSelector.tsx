/**
 * LinkedBusinessSelector.tsx — Selector for linking a business license to a business entity.
 *
 * Thin wrapper around SearchableSelector<Item>.
 * Used in the OverviewTab for business_license subcategory items.
 *
 * Unlike other selectors that store a string value, this one manages an item_link
 * (link/unlink API calls) and displays the linked business entity name.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Item, LinkedParent } from "@/lib/api";
import { SearchableSelector } from "./SearchableSelector";

const BUSINESS_ENTITY_SUBS = new Set([
  "llc",
  "corporation",
  "partnership",
  "sole_proprietorship",
]);

const subcategoryLabel = (sub: string) => {
  const labels: Record<string, string> = {
    llc: "LLC",
    corporation: "Corporation",
    partnership: "Partnership/LLP",
    sole_proprietorship: "Sole Proprietorship",
  };
  return labels[sub] || sub;
};

interface LinkedBusinessSelectorProps {
  itemId: string | undefined;
}

export function LinkedBusinessSelector({ itemId }: LinkedBusinessSelectorProps) {
  const [linked, setLinked] = useState<LinkedParent | null>(null);

  const fetchLinked = useCallback(async () => {
    if (!itemId) return;
    try {
      const parent = await api.itemLinks.getParent(itemId);
      setLinked(parent);
    } catch {
      // ignore
    }
  }, [itemId]);

  useEffect(() => {
    fetchLinked();
  }, [fetchLinked]);

  const handleChange = async (value: string) => {
    if (!itemId) return;
    if (!value) {
      // Clear / unlink
      try {
        await api.itemLinks.unlink(itemId);
        setLinked(null);
      } catch {
        // ignore
      }
      return;
    }
    // Link to selected business
    try {
      const result = await api.itemLinks.link(itemId, value);
      setLinked(result);
    } catch {
      // ignore
    }
  };

  if (!itemId) return null;

  return (
    <SearchableSelector<Item>
      value={linked?.item_id || ""}
      onChange={handleChange}
      placeholder="Select a business..."
      fetchItems={async () => {
        const res = await api.items.list({ category: "business", limit: 200 });
        return res.items.filter(
          (i) => BUSINESS_ENTITY_SUBS.has(i.subcategory) && !i.is_archived,
        );
      }}
      filterItems={(items, q) =>
        items.filter((i) => i.name.toLowerCase().includes(q))
      }
      getKey={(i) => i.id}
      getDisplayLabel={(i) => i.name}
      getValue={(i) => i.id}
      getSubtext={(i) => subcategoryLabel(i.subcategory)}
      icon={Building2}
      searchPlaceholder="Search businesses..."
      emptyLabel="No business entities found"
      searchEmptyLabel="No matches"
    />
  );
}
