"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Calendar, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Reminder } from "@/lib/api";
import { ReminderCard } from "@/components/items/ReminderCard";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const [daysAhead, setDaysAhead] = useState(90);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    api.reminders.list(daysAhead)
      .then((data) => { if (active) setReminders(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [daysAhead, retry]);

  async function handleDelete(id: string) {
    try {
      await api.reminders.delete(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete reminder:", err);
    }
  }

  const overdue = reminders.filter((r) => r.is_overdue);
  const upcoming = reminders.filter((r) => !r.is_overdue);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Reminders</h1>

      <div className="mb-6">
        <label htmlFor="reminder-horizon" className="mr-3 font-medium">Date range</label>
        <select id="reminder-horizon" value={daysAhead}
          onChange={(event) => setDaysAhead(Number(event.target.value))}
          className="rounded border border-gray-300 p-2">
          <option value={30}>Next 30 days</option>
          <option value={90}>Next 90 days</option>
          <option value={365}>Next 365 days</option>
        </select>
        <p className="mt-2 text-sm text-gray-500">Overdue reminders are always included.</p>
      </div>
      {loading && <p role="status">Loading reminders...</p>}
      {!loading && error && <div role="alert">
        Unable to load reminders. <button onClick={() => setRetry((value) => value + 1)}>Try again</button>
      </div>}
      {!loading && !error && <>
      {reminders.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No upcoming expirations</p>
            <p className="text-sm text-gray-400 mt-1">
              Items with expiration or end dates will appear here, along with
              any custom reminders you create.
            </p>
          </CardContent>
        </Card>
      )}

      {overdue.length > 0 && (
        <div className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-red-600 mb-3">
            <AlertTriangle className="h-5 w-5" />
            Overdue ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((r) => (
              <ReminderCard
                key={r.id || `${r.item_id}-${r.field_label}`}
                reminder={r}
                onDelete={r.is_custom && r.id ? () => handleDelete(r.id!) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
            <Clock className="h-5 w-5" />
            Upcoming ({upcoming.length})
          </h2>
          <div className="space-y-2">
            {upcoming.map((r) => (
              <ReminderCard
                key={r.id || `${r.item_id}-${r.field_label}`}
                reminder={r}
                onDelete={r.is_custom && r.id ? () => handleDelete(r.id!) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

