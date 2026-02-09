"use client";

import { useSearchParams } from "next/navigation";
import { ItemPage } from "@/components/items/ItemPage";

export default function NewBusinessPage() {
  const searchParams = useSearchParams();
  const subcategory = searchParams.get("subcategory") || "llcs";

  return <ItemPage categorySlug="business" subcategoryKey={subcategory} />;
}
