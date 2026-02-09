"use client";

import { use } from "react";
import { ItemPage } from "@/components/items/ItemPage";

export default function BusinessDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = use(params);
  return <ItemPage categorySlug="business" itemId={itemId} />;
}
