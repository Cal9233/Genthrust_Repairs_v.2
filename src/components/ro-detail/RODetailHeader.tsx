"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { Pencil, Save, X, ExternalLink } from "lucide-react";
import type { RepairOrder } from "@/app/actions/dashboard";
import type { RepairOrderUpdateFields } from "@/app/actions/repair-orders";
import { ROTrackingPopup } from "./ROTrackingPopup";

const STATUS_OPTIONS = [
  "WAITING QUOTE",
  "APPROVED",
  "IN WORK",
  "IN PROGRESS",
  "SHIPPED",
  "IN TRANSIT",
  "RECEIVED",
  "COMPLETE",
  "BER",
  "RAI",
  "CANCELLED",
  "SCRAP",
] as const;

interface RODetailHeaderProps {
  data: RepairOrder;
  editMode: boolean;
  saving: boolean;
  editedFields: RepairOrderUpdateFields;
  onEditModeChange: (editMode: boolean) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onStatusChange: (status: string) => void;
}

export function RODetailHeader({
  data,
  editMode,
  saving,
  editedFields,
  onEditModeChange,
  onSave,
  onCancel,
  onStatusChange,
}: RODetailHeaderProps) {
  const [trackingPopupOpen, setTrackingPopupOpen] = useState(false);
  const currentStatus =
    (editedFields.curentStatus as string) || data.curentStatus || "";

  const hasTracking =
    data.trackingNumberPickingUp && data.trackingNumberPickingUp.trim() !== "";

  return (
    <div className="flex flex-col gap-4 py-4 border-b border-border">
      {/* Status Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Status:
          </span>
          {editMode ? (
            <Select value={currentStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StatusBadge status={currentStatus} />
          )}
        </div>

        {/* Edit/Save Buttons */}
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? (
                  <TurbineSpinner size="sm" className="mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditModeChange(true)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Quick Info Row */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Shop:</span>
          <span className="font-medium">{data.shopName || "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Part:</span>
          <span className="font-mono">{data.part || "—"}</span>
        </div>
        {hasTracking && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Tracking:</span>
            <button
              onClick={() => setTrackingPopupOpen(true)}
              className="font-mono text-primary hover:underline flex items-center gap-1"
            >
              {data.trackingNumberPickingUp}
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Tracking Popup */}
      {hasTracking && (
        <ROTrackingPopup
          trackingNumber={data.trackingNumberPickingUp!}
          open={trackingPopupOpen}
          onOpenChange={setTrackingPopupOpen}
        />
      )}
    </div>
  );
}
