"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldRenderer } from "./FieldRenderer";
import { api } from "@/lib/api";
import type { FieldDefinition, Item } from "@/lib/api";

interface ItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categorySlug: string;
  subcategoryKey: string;
  subcategoryLabel: string;
  fields: FieldDefinition[];
  editItem?: Item | null;
}

export function ItemFormDialog({
  open,
  onClose,
  onSaved,
  categorySlug,
  subcategoryKey,
  subcategoryLabel,
  fields,
  editItem,
}: ItemFormDialogProps) {
  const isEdit = !!editItem;

  const [name, setName] = useState(editItem?.name || "");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (editItem) {
      const vals: Record<string, string> = {};
      for (const fv of editItem.fields) {
        vals[fv.field_key] = fv.field_value || "";
      }
      return vals;
    }
    return {};
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFieldChange(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fieldPayload = fields
      .filter((f) => fieldValues[f.key] !== undefined && fieldValues[f.key] !== "")
      .map((f) => ({
        field_key: f.key,
        field_value: fieldValues[f.key] || null,
      }));

    try {
      if (isEdit && editItem) {
        await api.items.update(editItem.id, {
          name,
          fields: fieldPayload,
        });
      } else {
        await api.items.create({
          category: categorySlug,
          subcategory: subcategoryKey,
          name,
          fields: fieldPayload,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "Add"} {subcategoryLabel}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="item-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. John's ${subcategoryLabel}`}
              required
            />
          </div>

          {fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={fieldValues[field.key] || ""}
              onChange={(v) => handleFieldChange(field.key, v)}
            />
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
