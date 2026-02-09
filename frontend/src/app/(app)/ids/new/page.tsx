"use client";

import { useSearchParams } from "next/navigation";
import { ItemPage } from "@/components/items/ItemPage";

export default function NewIdPage() {
  const searchParams = useSearchParams();
  const subcategory = searchParams.get("subcategory") || "drivers_license";

  return <ItemPage categorySlug="ids" subcategoryKey={subcategory} />;
}
