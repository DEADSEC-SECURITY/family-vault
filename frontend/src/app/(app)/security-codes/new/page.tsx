"use client";

import { useSearchParams } from "next/navigation";
import { ItemPage } from "@/components/items/ItemPage";

export default function NewSecurityCodePage() {
  const searchParams = useSearchParams();
  const subcategory = searchParams.get("subcategory") || "backup_codes";

  return (
    <ItemPage categorySlug="security_codes" subcategoryKey={subcategory} />
  );
}
