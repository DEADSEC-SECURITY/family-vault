"use client";

import { useEffect, useState } from "react";
import { X, BellOff, AlertTriangle, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { Reminder } from "@/lib/api";
import { ReminderCard } from "@/components/items/ReminderCard";

interface RemindersPanelProps {
  open: boolean;
  onClose: () => void;
}

export function RemindersPanel({ open, onClose }: RemindersPanelProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.reminders
      .list()
      .then(setReminders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  const overdue = reminders.filter((r) => r.is_overdue);
  const upcoming = reminders.filter((r) => !r.is_overdue);

  return (
    <div
      className={`flex h-screen flex-col border-r bg-white transition-all duration-300 overflow-hidden shrink-0 ${
        open ? "w-72" : "w-0"
      }`}
    >
      {open && (
        <div className="flex h-full w-72 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Reminders</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <Separator />

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-400">Loading...</p>
              </div>
            )}

            {!loading && reminders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <BellOff className="h-10 w-10 text-gray-200 mb-3" />
                <p className="text-sm text-gray-500">No reminders.</p>
              </div>
            )}

            {!loading && overdue.length > 0 && (
              <div className="px-4 pt-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Overdue
                </h3>
                <div className="space-y-1">
                  {overdue.map((r) => (
                    <ReminderCard
                      key={r.id || `${r.item_id}-${r.field_label}`}
                      reminder={r}
                      variant="compact"
                      onClose={onClose}
                    />
                  ))}
                </div>
              </div>
            )}

            {!loading && upcoming.length > 0 && (
              <div className="px-4 pt-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Clock className="h-3.5 w-3.5" />
                  Upcoming
                </h3>
                <div className="space-y-1">
                  {upcoming.map((r) => (
                    <ReminderCard
                      key={r.id || `${r.item_id}-${r.field_label}`}
                      reminder={r}
                      variant="compact"
                      onClose={onClose}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
