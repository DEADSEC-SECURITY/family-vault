"use client";

import { CategoryPage } from "@/components/items/CategoryPage";

export default function IdsPage() {
  return (
    <CategoryPage
      categorySlug="ids"
      subcategoryFilter={["drivers_license", "passport", "visa", "birth_certificate", "custom_id"]}
    />
  );
}
