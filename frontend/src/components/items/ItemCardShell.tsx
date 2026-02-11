/**
 * ItemCardShell.tsx — Shared card wrapper for category-specific item cards.
 *
 * Provides the consistent layout: Link > Card > top row (icon + name + badges) + grid area.
 * Category-specific cards (IDItemCard, InsuranceItemCard, BusinessItemCard) render
 * their left/right grid columns as children.
 */
import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Item } from "@/lib/api";
import { SubcategoryIcon } from "./SubcategoryIcon";

interface ItemCardShellProps {
  item: Item;
  categorySlug: string;
  subtitle?: string | null;
  children: React.ReactNode;
}

export function ItemCardShell({ item, categorySlug, subtitle, children }: ItemCardShellProps) {
  return (
    <Link href={`/${categorySlug}/${item.id}`}>
      <Card className={`transition-shadow hover:shadow-md cursor-pointer h-full ${item.is_archived ? "opacity-60" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-2">
            <SubcategoryIcon subcategory={item.subcategory} category={categorySlug} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 truncate leading-tight">
                  {item.name}
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.is_archived && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                      Expired
                    </Badge>
                  )}
                  {item.files.length > 0 && (
                    <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </div>
              </div>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
            {children}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
