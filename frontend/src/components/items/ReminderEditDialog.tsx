"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type Reminder } from "@/lib/api";
import { toast } from "sonner";

interface ReminderEditDialogProps {
  open: boolean;
  onClose: () => void;
  reminder?: Reminder; // Optional for create mode
  itemId?: string; // Required for create mode
  onSaved: () => void;
}

export default function ReminderEditDialog({
  open,
  onClose,
  reminder,
  itemId,
  onSaved,
}: ReminderEditDialogProps) {
  const isCreateMode = !reminder;

  const [title, setTitle] = useState(reminder?.field_label || "");
  const [remindDate, setRemindDate] = useState(reminder?.date || "");
  const [note, setNote] = useState(reminder?.note || "");
  const [repeat, setRepeat] = useState(reminder?.repeat || "none");
  const [remindDaysBefore, setRemindDaysBefore] = useState(reminder?.remind_days_before ?? 7);
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when switching between reminders or opening in create mode
  useEffect(() => {
    if (open) {
      setTitle(reminder?.field_label || "");
      setRemindDate(reminder?.date || "");
      setNote(reminder?.note || "");
      setRepeat(reminder?.repeat || "none");
      setRemindDaysBefore(reminder?.remind_days_before ?? 7);
    }
  }, [open, reminder]);

  const handleSave = async () => {
    if (isCreateMode) {
      // Create mode
      if (!itemId || !title.trim() || !remindDate) return;

      setIsLoading(true);
      try {
        await api.reminders.create({
          item_id: itemId,
          title: title.trim(),
          remind_date: remindDate,
          note: note || null,
          repeat: repeat === "none" ? null : repeat,
          remind_days_before: remindDaysBefore,
        });

        toast.success("Reminder created successfully");
        onSaved();
        onClose();
      } catch (error) {
        toast.error("Failed to create reminder", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Edit mode
      if (!reminder?.id) return;

      setIsLoading(true);
      try {
        await api.reminders.update(reminder.id, {
          title,
          remind_date: remindDate,
          note: note || null,
          repeat: repeat === "none" ? null : repeat,
          remind_days_before: remindDaysBefore,
        });

        toast.success("Reminder updated successfully");
        onSaved();
        onClose();
      } catch (error) {
        toast.error("Failed to update reminder", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? "Add Reminder" : "Edit Reminder"}</DialogTitle>
          {!isCreateMode && reminder?.is_auto_generated && (
            <p className="text-xs text-muted-foreground mt-1">
              This was auto-generated. Editing will make it a custom reminder.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reminder title"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="remind-date">Date</Label>
            <Input
              id="remind-date"
              type="date"
              value={remindDate}
              onChange={(e) => setRemindDate(e.target.value)}
            />
          </div>

          {/* Remind me before and Repeat - side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="remind-before">Remind me</Label>
              <Select
                value={String(remindDaysBefore)}
                onValueChange={(val) => setRemindDaysBefore(Number(val))}
              >
                <SelectTrigger id="remind-before" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">On the day</SelectItem>
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="7">1 week before</SelectItem>
                  <SelectItem value="14">2 weeks before</SelectItem>
                  <SelectItem value="30">1 month before</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repeat">Repeat</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger id="repeat" className="w-full">
                  <SelectValue placeholder="No repeat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No repeat</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="biennial">Every 2 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional details..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isLoading || !title || !remindDate}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
