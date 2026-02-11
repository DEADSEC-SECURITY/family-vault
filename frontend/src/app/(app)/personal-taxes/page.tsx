"use client";

import { CategoryPage } from "@/components/items/CategoryPage";

export default function PersonalTaxesPage() {
  return (
    <CategoryPage
      categorySlug="ids"
      title="Taxes"
      subcategoryFilter={["personal_tax"]}
    />
  );
}
