"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, DollarSign, FileText, Building2, Package } from "lucide-react";
import type { RepairOrder } from "@/app/actions/dashboard";
import type { RepairOrderUpdateFields } from "@/app/actions/repair-orders";

interface FieldConfig {
  key: keyof RepairOrder;
  label: string;
  type: "text" | "number" | "date" | "currency";
  editable: boolean;
}

const FIELD_SECTIONS: {
  title: string;
  icon: typeof Calendar;
  fields: FieldConfig[];
}[] = [
  {
    title: "Basic Information",
    icon: FileText,
    fields: [
      { key: "ro", label: "RO Number", type: "number", editable: false },
      { key: "dateMade", label: "Date Made", type: "date", editable: true },
      { key: "part", label: "Part Number", type: "text", editable: true },
      { key: "serial", label: "Serial Number", type: "text", editable: true },
      { key: "partDescription", label: "Part Description", type: "text", editable: true },
      { key: "reqWork", label: "Required Work", type: "text", editable: true },
    ],
  },
  {
    title: "Shop Information",
    icon: Building2,
    fields: [
      { key: "shopName", label: "Shop Name", type: "text", editable: true },
      { key: "shopRef", label: "Shop Reference", type: "text", editable: true },
      { key: "shopStatus", label: "Shop Status", type: "text", editable: true },
      { key: "terms", label: "Terms", type: "text", editable: true },
    ],
  },
  {
    title: "Dates",
    icon: Calendar,
    fields: [
      { key: "dateDroppedOff", label: "Date Dropped Off", type: "date", editable: true },
      { key: "estimatedDeliveryDate", label: "Est. Delivery Date", type: "date", editable: true },
      { key: "curentStatusDate", label: "Status Date", type: "date", editable: true },
      { key: "lastDateUpdated", label: "Last Updated", type: "date", editable: false },
      { key: "nextDateToUpdate", label: "Next Update Due", type: "date", editable: true },
    ],
  },
  {
    title: "Costs",
    icon: DollarSign,
    fields: [
      { key: "estimatedCost", label: "Estimated Cost", type: "currency", editable: true },
      { key: "finalCost", label: "Final Cost", type: "currency", editable: true },
    ],
  },
  {
    title: "Shipping",
    icon: Package,
    fields: [
      { key: "trackingNumberPickingUp", label: "Tracking Number", type: "text", editable: true },
    ],
  },
];

interface ROInfoGridProps {
  data: RepairOrder;
  editMode: boolean;
  editedFields: RepairOrderUpdateFields;
  onUpdateField: <K extends keyof RepairOrderUpdateFields>(
    key: K,
    value: RepairOrderUpdateFields[K]
  ) => void;
}

/**
 * Format a date string to human-readable format
 */
function formatDate(value: string): string {
  // Try to parse the date
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    // If parsing fails, return the original string
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatValue(
  value: unknown,
  type: FieldConfig["type"]
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (type === "currency" && typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  if (type === "date" && typeof value === "string") {
    return formatDate(value);
  }

  // Strip markdown symbols like **bold** from display text
  if (typeof value === "string") {
    return value.replace(/\*\*/g, "");
  }

  return String(value);
}

export function ROInfoGrid({
  data,
  editMode,
  editedFields,
  onUpdateField,
}: ROInfoGridProps) {
  const getFieldValue = (key: keyof RepairOrder): unknown => {
    // Check if field has been edited
    if (key in editedFields) {
      return editedFields[key as keyof RepairOrderUpdateFields];
    }
    return data[key];
  };

  return (
    <div className="space-y-8">
      {FIELD_SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <div
            key={section.title}
            className="bg-muted/30 rounded-lg p-5 border border-border"
          >
            <div className="flex items-center gap-2 mb-5">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">{section.title}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {section.fields.map((field) => {
                const value = getFieldValue(field.key);
                const canEdit = editMode && field.editable;

                return (
                  <div key={field.key} className="space-y-2">
                    <Label
                      htmlFor={field.key}
                      className="text-xs text-muted-foreground uppercase tracking-wide"
                    >
                      {field.label}
                    </Label>

                    {canEdit ? (
                      <Input
                        id={field.key}
                        type={field.type === "currency" ? "number" : "text"}
                        value={value as string | number ?? ""}
                        onChange={(e) => {
                          const newValue =
                            field.type === "currency" || field.type === "number"
                              ? e.target.value
                                ? parseFloat(e.target.value)
                                : null
                              : e.target.value;
                          onUpdateField(
                            field.key as keyof RepairOrderUpdateFields,
                            newValue as never
                          );
                        }}
                        className="h-10 bg-background"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    ) : (
                      <p
                        className={`text-sm font-medium pt-1 pb-3 ${
                          !value || value === "—"
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {formatValue(value, field.type)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Status Section (Read-only) */}
      <div className="bg-muted/30 rounded-lg p-5 border border-border">
        <div className="flex items-center gap-2 mb-5">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Status Information</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Current Status
            </Label>
            <p className="text-sm font-medium pt-1 pb-3">
              {data.curentStatus?.replace(/\*\*/g, "") || "—"}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              GenThrust Status
            </Label>
            <p className="text-sm font-medium pt-1 pb-3">
              {data.genthrustStatus?.replace(/\*\*/g, "") || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
