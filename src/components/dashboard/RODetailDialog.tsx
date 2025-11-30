"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "./StatusBadge";
import { getRepairOrderById, type RepairOrder } from "@/app/actions/dashboard";
import {
  Building2,
  Calendar,
  Truck,
  FileText,
  DollarSign,
  Wrench,
  Hash,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface RODetailDialogProps {
  roId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Format a date string for display
 */
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  // If already in readable format, return as-is
  if (dateString.includes("/")) return dateString;
  // Try to parse and format
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-US");
}

/**
 * Format a number as USD currency
 */
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Check if a string looks like a tracking number/URL
 */
function isTrackingUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.includes("ups.com") ||
    value.includes("fedex.com") ||
    value.includes("usps.com")
  );
}

/**
 * Clean notes field - extract actual notes from HISTORY JSON format
 * Format: "HISTORY:[{...}]|NOTES:actual notes here"
 */
function cleanNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;

  // Check if notes contain HISTORY format
  if (notes.includes("HISTORY:[")) {
    // Try to extract text after |NOTES:
    const notesMatch = notes.match(/\|NOTES:(.*)/);
    if (notesMatch && notesMatch[1]) {
      const cleanedNotes = notesMatch[1].trim();
      return cleanedNotes || null;
    }
    // If no |NOTES: section found, return null (only history, no actual notes)
    return null;
  }

  // Return original notes if no HISTORY format
  return notes;
}

/**
 * Detail row component for consistent styling
 */
function DetailRow({
  icon: Icon,
  label,
  value,
  isLink = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  isLink?: boolean;
}) {
  const displayValue = value || "-";

  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isLink && value ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary-bright-blue hover:underline flex items-center gap-1"
          >
            {displayValue}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="text-sm font-medium truncate">{displayValue}</p>
        )}
      </div>
    </div>
  );
}

export function RODetailDialog({
  roId,
  open,
  onOpenChange,
}: RODetailDialogProps) {
  const [data, setData] = useState<RepairOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data when roId changes
  useEffect(() => {
    if (roId === null) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    getRepairOrderById(roId)
      .then((result) => {
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [roId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-vibrant bg-white dark:bg-slate-950 sm:max-w-2xl">
        {/* Always render DialogHeader with Title for accessibility */}
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-2xl font-bold tabular-nums">
              {loading
                ? "Loading..."
                : error
                  ? "Error"
                  : data
                    ? `RO #${data.ro}`
                    : "Repair Order"}
            </DialogTitle>
            {data && (
              <StatusBadge status={data.curentStatus} className="text-sm" />
            )}
          </div>
          <DialogDescription className="sr-only">
            {data
              ? `Details for repair order ${data.ro} from ${data.shopName || "Unknown Shop"}`
              : "Repair order details"}
          </DialogDescription>
          {data && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {data.shopName || "Unknown Shop"}
            </p>
          )}
        </DialogHeader>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Data Content */}
        {data && (
          <>
            {/* 2-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
              {/* Left Column - Part Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Part Information
                </h3>
                <DetailRow icon={Hash} label="Part Number" value={data.part} />
                <DetailRow
                  icon={Hash}
                  label="Serial Number"
                  value={data.serial}
                />
                <DetailRow
                  icon={Wrench}
                  label="Description"
                  value={data.partDescription}
                />
                {data.reqWork && (
                  <DetailRow
                    icon={FileText}
                    label="Requested Work"
                    value={data.reqWork}
                  />
                )}
              </div>

              {/* Right Column - Dates & Logistics */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dates & Logistics
                </h3>
                <DetailRow
                  icon={Calendar}
                  label="Date Dropped Off"
                  value={formatDate(data.dateDroppedOff)}
                />
                <DetailRow
                  icon={Calendar}
                  label="Estimated Delivery"
                  value={formatDate(data.estimatedDeliveryDate)}
                />
                <DetailRow
                  icon={Calendar}
                  label="Next Update"
                  value={formatDate(data.nextDateToUpdate)}
                />
                <DetailRow
                  icon={Truck}
                  label="Tracking Number"
                  value={data.trackingNumberPickingUp}
                  isLink={isTrackingUrl(data.trackingNumberPickingUp)}
                />
              </div>
            </div>

            {/* Notes Section */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Notes
              </h3>
              <div className="rounded-lg border bg-muted/30 p-4 min-h-[60px]">
                <p className="text-sm whitespace-pre-wrap">
                  {cleanNotes(data.notes) || (
                    <span className="text-muted-foreground italic">
                      No notes
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Cost Summary */}
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Est. Cost:</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(data.estimatedCost)}
                </span>
              </div>
              {data.finalCost && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Final Cost:
                  </span>
                  <span className="font-semibold tabular-nums text-success-green">
                    {formatCurrency(data.finalCost)}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
