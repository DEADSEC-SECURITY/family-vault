"use client";

import { use } from "react";
import { ItemPage } from "@/components/items/ItemPage";

export default function IdDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = use(params);
  return <ItemPage categorySlug="ids" itemId={itemId} />;
}
