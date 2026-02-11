"use client";

import { CategoryPage } from "@/components/items/CategoryPage";

export default function LicensesPage() {
  return (
    <CategoryPage
      categorySlug="business"
      title="Business Licenses"
      subcategoryFilter={["business_license"]}
    />
  );
}
