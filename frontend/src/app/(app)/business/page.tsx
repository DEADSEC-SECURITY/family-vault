"use client";

import { CategoryPage } from "@/components/items/CategoryPage";

export default function BusinessPage() {
  return (
    <CategoryPage
      categorySlug="business"
      title="Businesses"
      subcategoryFilter={["llc", "corporation", "partnership", "sole_proprietorship"]}
    />
  );
}
