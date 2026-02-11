"use client";

import { CategoryPage } from "@/components/items/CategoryPage";

export default function TaxesPage() {
  return (
    <CategoryPage
      categorySlug="business"
      title="Taxes"
      subcategoryFilter={["tax_document"]}
    />
  );
}
