"use client";

import { CategoryPage } from "@/components/items/CategoryPage";

export default function BusinessInsurancePage() {
  return (
    <CategoryPage
      categorySlug="business"
      title="Business Insurance"
      subcategoryFilter={[
        "general_liability", "professional_liability", "workers_compensation",
        "commercial_property", "commercial_auto", "bop", "cyber_liability",
        "other_business_insurance",
      ]}
    />
  );
}
