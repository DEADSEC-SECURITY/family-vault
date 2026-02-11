"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldDefinition, FieldGroup, SubcategoryInfo, Item } from "@/lib/api";
import { ProviderCombobox } from "./ProviderCombobox";
import { PersonSelector } from "./PersonSelector";
import { PassportSelector } from "./PassportSelector";
import { CountryCombobox, VisaTypeCombobox } from "./VisaFieldCombobox";
import { InlineFileZone } from "./InlineFileZone";
import { VehiclesSection } from "./VehiclesSection";

/* ──────────────────────── Overview Tab ──────────────────────── */

interface OverviewTabProps {
  fields: FieldDefinition[];
  fieldGroups?: FieldGroup[];
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  item: Item | null;
  subcategory: SubcategoryInfo;
  onUploaded: () => void;
}

export function OverviewTab({
  fields,
  fieldGroups,
  fieldValues,
  onFieldChange,
  item,
  subcategory,
  onUploaded,
}: OverviewTabProps) {
  return (
    <>
      {renderDynamicFieldCards({
        fields,
        fieldGroups,
        fieldValues,
        onFieldChange,
        item,
        subcategory,
        onUploaded,
      })}

      {/* Vehicles section (auto insurance only) */}
      {subcategory.key === "auto_insurance" && (
        <div className="mt-4">
          <VehiclesSection itemId={item?.id} />
        </div>
      )}

    </>
  );
}

/* ──────────────────────── Reusable Field Cards Renderer ──────────────────────── */

function renderDynamicFieldCards({
  fields,
  fieldGroups,
  fieldValues,
  onFieldChange,
  item,
  subcategory,
  onUploaded,
}: {
  fields: FieldDefinition[];
  fieldGroups?: FieldGroup[];
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  item: Item | null;
  subcategory: SubcategoryInfo;
  onUploaded: () => void;
}) {
  const imageSlots = subcategory.file_slots.filter(
    (s) => s.includes("front") || s.includes("back") || s.includes("card"),
  );
  const hasImageSlots = imageSlots.length > 0;

  // ════════════════════════════════════════════════════════════
  // Multi-card layout (when field_groups exists)
  // ════════════════════════════════════════════════════════════
  if (fieldGroups && fieldGroups.length > 0) {
    return (
      <div className="space-y-4">
        {fieldGroups.map((group, groupIndex) => {
          const groupFields = group.fields;

          // Only show provider row and image slots in the first group
          const isFirstGroup = groupIndex === 0;
          const providerIndex = isFirstGroup
            ? groupFields.findIndex((f) => f.type === "provider")
            : -1;
          const topFields = providerIndex >= 0
            ? groupFields.slice(providerIndex, providerIndex + 2)
            : [];
          const gridFields = providerIndex >= 0
            ? [...groupFields.slice(0, providerIndex), ...groupFields.slice(providerIndex + 2)]
            : groupFields;

          return (
            <Card key={group.label}>
              <CardContent className="p-5">
                {/* Group label as heading */}
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  {group.label}
                </h3>

                {/* Provider + Member ID row (first group only) */}
                {isFirstGroup && topFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 mb-4">
                    {topFields.map((field) => (
                      <FieldCell
                        key={field.key}
                        field={field}
                        value={fieldValues[field.key] || ""}
                        onChange={(v) => onFieldChange(field.key, v)}
                        subcategory={subcategory.key}
                        fieldValues={fieldValues}
                      />
                    ))}
                  </div>
                )}

                {/* Card images (first group only) */}
                {isFirstGroup && hasImageSlots && item && (
                  <div className="mb-4">
                    <InlineFileZone
                      item={item}
                      fileSlots={imageSlots}
                      onUploaded={onUploaded}
                    />
                  </div>
                )}

                {/* 3-column grid for fields */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                  {gridFields.map((field) => (
                    <div
                      key={field.key}
                      className={field.type === "textarea" ? "col-span-3" : ""}
                    >
                      <FieldCell
                        field={field}
                        value={fieldValues[field.key] || ""}
                        onChange={(v) => onFieldChange(field.key, v)}
                        subcategory={subcategory.key}
                        fieldValues={fieldValues}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // Single card layout (backwards compatible - flat fields)
  // ════════════════════════════════════════════════════════════
  const providerIndex = fields.findIndex((f) => f.type === "provider");
  const topFields = providerIndex >= 0
    ? fields.slice(providerIndex, providerIndex + 2)
    : [];
  const gridFields = providerIndex >= 0
    ? [...fields.slice(0, providerIndex), ...fields.slice(providerIndex + 2)]
    : fields;

  return (
    <Card>
      <CardContent className="p-5">
        {/* Provider + Member ID row */}
        {topFields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 mb-4">
            {topFields.map((field) => (
              <FieldCell
                key={field.key}
                field={field}
                value={fieldValues[field.key] || ""}
                onChange={(v) => onFieldChange(field.key, v)}
                subcategory={subcategory.key}
                fieldValues={fieldValues}
              />
            ))}
          </div>
        )}

        {/* Card images */}
        {hasImageSlots && item && (
          <div className="mb-4">
            <InlineFileZone
              item={item}
              fileSlots={imageSlots}
              onUploaded={onUploaded}
            />
          </div>
        )}

        {/* 3-column grid for remaining fields */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          {gridFields.map((field) => (
            <div
              key={field.key}
              className={field.type === "textarea" ? "col-span-3" : ""}
            >
              <FieldCell
                field={field}
                value={fieldValues[field.key] || ""}
                onChange={(v) => onFieldChange(field.key, v)}
                subcategory={subcategory.key}
                fieldValues={fieldValues}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────── Field Cell ──────────────────────── */

function FieldCell({
  field,
  value,
  onChange,
  subcategory,
  fieldValues,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (v: string) => void;
  subcategory?: string;
  fieldValues?: Record<string, string>;
}) {
  const label = field.label;

  // Visa-specific field handling
  const isVisaSubcategory = subcategory === "visa";
  const isCountryField = isVisaSubcategory && field.key === "country";
  const isVisaTypeField = isVisaSubcategory && field.key === "visa_type";
  const isPassportNumberField = isVisaSubcategory && field.key === "passport_number";

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {isCountryField ? (
        <CountryCombobox
          value={value}
          onChange={onChange}
          placeholder="Select country..."
        />
      ) : isVisaTypeField ? (
        <VisaTypeCombobox
          value={value}
          onChange={onChange}
          country={fieldValues?.country || ""}
          placeholder="Select visa type..."
        />
      ) : isPassportNumberField ? (
        <PassportSelector
          value={value}
          onChange={onChange}
          placeholder="Select passport..."
        />
      ) : field.type === "provider" ? (
        <ProviderCombobox
          value={value}
          onChange={onChange}
          placeholder={`Select ${label.toLowerCase()}...`}
        />
      ) : field.type === "person" ? (
        <PersonSelector
          value={value}
          onChange={onChange}
          placeholder={`Select ${label.toLowerCase()}...`}
        />
      ) : field.type === "select" && field.options ? (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="h-9 text-sm w-full">
            <SelectValue placeholder={<span className="text-gray-400">{`Select...`}</span>} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className="resize-none min-h-[60px] text-sm"
        />
      ) : field.type === "number" ? (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <Input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0.00"
            className="h-9 text-sm pl-7"
          />
        </div>
      ) : (
        <Input
          type={field.type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.type === "date" ? "" : `Enter ${label.toLowerCase()}...`}
          className="h-9 text-sm"
        />
      )}
    </div>
  );
}
