"use client";

import { use } from "react";
import { ItemPage } from "@/components/items/ItemPage";

export default function InsuranceDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = use(params);
  return <ItemPage categorySlug="insurance" itemId={itemId} />;
}
