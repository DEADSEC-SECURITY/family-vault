"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDefinition } from "@/lib/api";

interface FieldRendererProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}

export function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  const id = `field-${field.key}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
          required={field.required}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
          required={field.required}
        />
      )}
    </div>
  );
}
