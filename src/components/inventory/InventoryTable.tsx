"use client";

import { ArrowRight, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/app/actions/inventory";

interface InventoryTableProps {
  items: InventoryItem[];
  onCreateRO?: (item: InventoryItem) => void;
}

// Get condition badge styling
function getConditionStyles(condition: string | null): {
  dotColor: string;
  label: string;
} {
  if (!condition) return { dotColor: "bg-zinc-500", label: "?" };
  const code = condition.toUpperCase();

  if (code.includes("NE") || code.includes("NEW")) {
    return { dotColor: "bg-sky-500", label: "NE" };
  }
  if (code.includes("OH") || code.includes("OVERHAUL")) {
    return { dotColor: "bg-emerald-500", label: "OH" };
  }
  if (code.includes("SV") || code.includes("SERVICEABLE")) {
    return { dotColor: "bg-teal-500", label: "SV" };
  }
  if (code.includes("AR") || code.includes("AS REMOVED")) {
    return { dotColor: "bg-zinc-400", label: "AR" };
  }
  if (code.includes("RP") || code.includes("REPAIR")) {
    return { dotColor: "bg-amber-500", label: "RP" };
  }
  return { dotColor: "bg-zinc-500", label: condition.slice(0, 2).toUpperCase() };
}

// Get stock level styling
function getStockStyles(qty: number | null): {
  borderColor: string;
  textColor: string;
  level: "good" | "low" | "critical";
} {
  const q = qty ?? 0;
  if (q >= 10) {
    return { borderColor: "border-l-emerald-500", textColor: "text-emerald-500", level: "good" };
  }
  if (q >= 5) {
    return { borderColor: "border-l-amber-500", textColor: "text-amber-500", level: "low" };
  }
  return { borderColor: "border-l-red-500", textColor: "text-red-500", level: "critical" };
}

// Determine smart action based on condition
function getRowAction(condition: string | null): {
  label: string;
  action: "issue" | "createRO";
  icon: typeof ArrowRight | typeof Plus;
} {
  const code = (condition || "").toUpperCase();

  // Serviceable conditions → Issue (copy to clipboard)
  if (
    code.includes("NE") ||
    code.includes("NEW") ||
    code.includes("SV") ||
    code.includes("SERVICEABLE")
  ) {
    return { label: "Issue", action: "issue", icon: ArrowRight };
  }

  // Repairable conditions → Create RO
  return { label: "Create RO", action: "createRO", icon: Plus };
}

export function InventoryTable({ items, onCreateRO }: InventoryTableProps) {
  const handleIssue = (item: InventoryItem) => {
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

  const handleAction = (item: InventoryItem, action: "issue" | "createRO") => {
    if (action === "issue") {
      handleIssue(item);
    } else if (action === "createRO" && onCreateRO) {
      onCreateRO(item);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No parts found</p>
        <p className="text-sm mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card/80 backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b-2">
            <TableHead className="w-[300px] uppercase tracking-wide text-xs font-semibold">
              Part
            </TableHead>
            <TableHead className="uppercase tracking-wide text-xs font-semibold">
              Location
            </TableHead>
            <TableHead className="uppercase tracking-wide text-xs font-semibold">
              Condition
            </TableHead>
            <TableHead className="text-right uppercase tracking-wide text-xs font-semibold">
              Qty
            </TableHead>
            <TableHead className="w-[120px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const conditionStyles = getConditionStyles(item.condition);
            const stockStyles = getStockStyles(item.qty);
            const rowAction = getRowAction(item.condition);
            const ActionIcon = rowAction.icon;

            return (
              <TableRow
                key={item.indexId}
                className={cn(
                  "group cursor-pointer transition-colors border-l-4",
                  stockStyles.borderColor,
                  "hover:bg-muted/50"
                )}
              >
                {/* Part Identity (stacked) */}
                <TableCell className="py-3">
                  <div className="space-y-0.5">
                    <p className="font-mono font-semibold text-foreground">
                      {item.partNumber || "No P/N"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate max-w-[280px]">
                      {item.description || "No description"}
                    </p>
                  </div>
                </TableCell>

                {/* Location Tag */}
                <TableCell>
                  {item.location ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted font-mono text-xs">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {item.location}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>

                {/* Condition Badge */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("h-2.5 w-2.5 rounded-full", conditionStyles.dotColor)}
                    />
                    <span className="text-sm font-medium">{conditionStyles.label}</span>
                  </div>
                </TableCell>

                {/* Quantity */}
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "text-xl font-bold tabular-nums",
                      stockStyles.textColor
                    )}
                  >
                    {item.qty ?? 0}
                  </span>
                </TableCell>

                {/* Action Button (ghost, slide-in) */}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(item, rowAction.action);
                    }}
                    className={cn(
                      "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
                      "transition-all duration-200 ease-out",
                      "hover:bg-muted gap-1.5"
                    )}
                  >
                    <ActionIcon className="h-3.5 w-3.5" />
                    {rowAction.label}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Skeleton for loading state
export function InventoryTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card/80 backdrop-blur-sm overflow-hidden animate-pulse">
      <div className="p-4 border-b">
        <div className="flex gap-4">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-12 bg-muted rounded ml-auto" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 border-b last:border-0">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
            <div className="h-5 w-16 bg-muted rounded" />
            <div className="h-4 w-10 bg-muted rounded" />
            <div className="h-6 w-8 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
