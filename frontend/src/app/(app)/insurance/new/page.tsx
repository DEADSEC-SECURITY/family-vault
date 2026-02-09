"use client";

import { useSearchParams } from "next/navigation";
import { ItemPage } from "@/components/items/ItemPage";

export default function NewInsurancePage() {
  const searchParams = useSearchParams();
  const subcategory = searchParams.get("subcategory") || "auto_insurance";

  return <ItemPage categorySlug="insurance" subcategoryKey={subcategory} />;
}
