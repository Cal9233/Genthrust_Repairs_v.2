"use client";

import { ArrowRight, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/app/actions/inventory";

interface InventoryCardProps {
  item: InventoryItem;
  onCreateRO?: (item: InventoryItem) => void;
}

// Get condition badge styling
function getConditionStyles(condition: string | null): {
  dotColor: string;
  bgColor: string;
  label: string;
} {
  if (!condition) return { dotColor: "bg-zinc-500", bgColor: "bg-zinc-500/10", label: "?" };
  const code = condition.toUpperCase();

  if (code.includes("NE") || code.includes("NEW")) {
    return { dotColor: "bg-sky-500", bgColor: "bg-sky-500/10", label: "NE" };
  }
  if (code.includes("OH") || code.includes("OVERHAUL")) {
    return { dotColor: "bg-emerald-500", bgColor: "bg-emerald-500/10", label: "OH" };
  }
  if (code.includes("SV") || code.includes("SERVICEABLE")) {
    return { dotColor: "bg-teal-500", bgColor: "bg-teal-500/10", label: "SV" };
  }
  if (code.includes("AR") || code.includes("AS REMOVED")) {
    return { dotColor: "bg-zinc-400", bgColor: "bg-zinc-400/10", label: "AR" };
  }
  if (code.includes("RP") || code.includes("REPAIR")) {
    return { dotColor: "bg-amber-500", bgColor: "bg-amber-500/10", label: "RP" };
  }
  return { dotColor: "bg-zinc-500", bgColor: "bg-zinc-500/10", label: condition.slice(0, 2).toUpperCase() };
}

// Get stock level styling
function getStockStyles(qty: number | null): {
  borderColor: string;
  textColor: string;
} {
  const q = qty ?? 0;
  if (q >= 10) {
    return { borderColor: "border-l-emerald-500", textColor: "text-emerald-500" };
  }
  if (q >= 5) {
    return { borderColor: "border-l-amber-500", textColor: "text-amber-500" };
  }
  return { borderColor: "border-l-red-500", textColor: "text-red-500" };
}

// Determine smart action based on condition
function getRowAction(condition: string | null): {
  label: string;
  action: "issue" | "createRO";
  icon: typeof ArrowRight | typeof Plus;
} {
  const code = (condition || "").toUpperCase();

  if (
    code.includes("NE") ||
    code.includes("NEW") ||
    code.includes("SV") ||
    code.includes("SERVICEABLE")
  ) {
    return { label: "Issue", action: "issue", icon: ArrowRight };
  }

  return { label: "Create RO", action: "createRO", icon: Plus };
}

export function InventoryCard({ item, onCreateRO }: InventoryCardProps) {
  const conditionStyles = getConditionStyles(item.condition);
  const stockStyles = getStockStyles(item.qty);
  const rowAction = getRowAction(item.condition);
  const ActionIcon = rowAction.icon;

  const handleIssue = () => {
    const details = [
      item.partNumber,
      item.description,
      `Qty: ${item.qty ?? 0}`,
      item.location ? `Location: ${item.location}` : null,
      item.condition ? `Condition: ${item.condition}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    navigator.clipboard.writeText(details);
    toast.success("Part details copied to clipboard", {
      description: item.partNumber || "Unknown part",
    });
  };

  const handleAction = () => {
    if (rowAction.action === "issue") {
      handleIssue();
    } else if (onCreateRO) {
      onCreateRO(item);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        "border-l-4",
        stockStyles.borderColor,
        "active:bg-muted/50"
      )}
    >
      {/* Header Row: Part Number + Condition + Qty */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono font-semibold text-foreground truncate">
            {item.partNumber || "No P/N"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Condition Badge */}
          <span
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
              conditionStyles.bgColor
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", conditionStyles.dotColor)} />
            {conditionStyles.label}
          </span>
          {/* Quantity */}
          <span className={cn("text-lg font-bold tabular-nums", stockStyles.textColor)}>
            {item.qty ?? 0}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
        {item.description || "No description"}
      </p>

      {/* Footer Row: Location + Action */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        {/* Location */}
        {item.location ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted font-mono text-xs">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            {item.location}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No location</span>
        )}

        {/* Action Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAction}
          className="gap-1.5 min-h-[36px]"
        >
          <ActionIcon className="h-3.5 w-3.5" />
          {rowAction.label}
        </Button>
      </div>
    </div>
  );
}

// List wrapper for mobile cards
interface InventoryCardListProps {
  items: InventoryItem[];
  onCreateRO?: (item: InventoryItem) => void;
}

export function InventoryCardList({ items, onCreateRO }: InventoryCardListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No parts found</p>
        <p className="text-sm mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <InventoryCard key={item.indexId} item={item} onCreateRO={onCreateRO} />
      ))}
    </div>
  );
}

// Skeleton for loading state
export function InventoryCardListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-lg border bg-card p-4 border-l-4 border-l-muted animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="flex gap-2">
              <div className="h-5 w-12 bg-muted rounded-full" />
              <div className="h-6 w-8 bg-muted rounded" />
            </div>
          </div>
          <div className="h-4 w-48 bg-muted rounded mt-2" />
          <div className="flex justify-between mt-4 pt-3 border-t border-border/50">
            <div className="h-5 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
