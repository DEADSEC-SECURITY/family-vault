"use client";

import Link from "next/link";
import { Bell, Pencil, X, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Reminder } from "@/lib/api";

interface ReminderCardProps {
  reminder: Reminder;
  variant?: "default" | "compact" | "sidebar";
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void; // For RemindersPanel - closes panel after click
  showItemLink?: boolean; // Whether to show as a link to the item
}

/**
 * Reusable reminder card component used across the application.
 *
 * Variants:
 * - `default`: Full card layout for reminders page (with urgency colors)
 * - `compact`: Compact list item for RemindersPanel
 * - `sidebar`: Border card for ItemPage RightSidebar (with edit/delete buttons)
 */
export function ReminderCard({
  reminder,
  variant = "default",
  onEdit,
  onDelete,
  onClose,
  showItemLink = true,
}: ReminderCardProps) {
  const repeatLabel = (repeat: string) => {
    const labels: Record<string, string> = {
      weekly: "Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      yearly: "Yearly",
      biennial: "Every 2y",
    };
    return labels[repeat] || repeat;
  };

  // Compact variant for RemindersPanel
  if (variant === "compact") {
    const content = (
      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50 group">
        {reminder.is_custom && (
          <Bell className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {reminder.item_name}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {reminder.field_label} &middot;{" "}
            {reminder.subcategory.replace(/_/g, " ")}
          </p>
        </div>
        <div className="text-right shrink-0">
          {reminder.is_overdue ? (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {Math.abs(reminder.days_until)}d overdue
            </Badge>
          ) : (
            <span className="text-xs text-gray-400">
              {reminder.days_until}d
            </span>
          )}
        </div>
      </div>
    );

    if (showItemLink) {
      return (
        <Link
          href={`/${reminder.category}/${reminder.item_id}`}
          onClick={onClose}
        >
          {content}
        </Link>
      );
    }
    return content;
  }

  // Sidebar variant for ItemPage RightSidebar
  if (variant === "sidebar") {
    return (
      <div className="group flex items-start gap-2 rounded-md border p-2.5 text-xs transition-colors hover:bg-gray-50">
        <Bell className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-gray-900 font-medium break-words">
            {reminder.field_label}
          </p>
          <p className="text-gray-500 mt-0.5">
            {new Date(reminder.date).toLocaleDateString()}
          </p>
          {reminder.is_overdue ? (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 mt-1">
              {Math.abs(reminder.days_until)}d overdue
            </Badge>
          ) : (
            <span className="text-gray-400 text-[10px]">
              in {reminder.days_until} days
            </span>
          )}
          {reminder.repeat && reminder.repeat !== "none" && (
            <span className="inline-flex items-center gap-0.5 text-gray-400 text-[10px] ml-1">
              <RefreshCw className="h-2.5 w-2.5" />
              {repeatLabel(reminder.repeat)}
            </span>
          )}
        </div>
        {reminder.id && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-gray-300 hover:text-blue-500 transition-colors"
                title={reminder.is_auto_generated ? "Edit (will become custom reminder)" : "Edit reminder"}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default variant for reminders page (full card)
  const urgencyColor = reminder.is_overdue
    ? "bg-red-50 border-red-200"
    : reminder.days_until <= 30
      ? "bg-yellow-50 border-yellow-200"
      : "bg-white";

  const cardContent = (
    <Card className={`transition-shadow hover:shadow-md ${showItemLink ? "cursor-pointer" : ""} ${urgencyColor}`}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {reminder.is_custom && (
            <Bell className="h-4 w-4 text-blue-400 shrink-0" />
          )}
          <div>
            <p className="font-medium text-gray-900">{reminder.item_name}</p>
            <p className="text-sm text-gray-500">
              {reminder.field_label} &middot;{" "}
              {reminder.subcategory.replace(/_/g, " ")}
            </p>
            {reminder.repeat && reminder.repeat !== "none" && (
              <span className="inline-flex items-center gap-1 text-gray-400 text-xs mt-0.5">
                <RefreshCw className="h-3 w-3" />
                {repeatLabel(reminder.repeat)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-sm font-medium">
            {new Date(reminder.date).toLocaleDateString()}
          </p>
          {reminder.is_overdue ? (
            <Badge variant="destructive" className="text-xs">
              {Math.abs(reminder.days_until)} days overdue
            </Badge>
          ) : (
            <p className="text-xs text-gray-500">
              in {reminder.days_until} days
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (showItemLink) {
    return (
      <div className="relative group">
        <Link href={`/${reminder.category}/${reminder.item_id}`}>
          {cardContent}
        </Link>
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return cardContent;
}
