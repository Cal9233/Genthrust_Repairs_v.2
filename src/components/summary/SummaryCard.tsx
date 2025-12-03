"use client";

import { NormalizedRepairOrder } from "@/app/actions/dashboard";
import { ROSummary } from "@/lib/summary-generator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  ro: NormalizedRepairOrder;
  summary: ROSummary;
  onClick?: () => void;
};

/**
 * Priority badge colors
 */
function getPriorityStyles(priority: ROSummary["priority"]): {
  badgeClass: string;
  borderClass: string;
} {
  switch (priority) {
    case 1: // OVERDUE
      return {
        badgeClass: "bg-danger/20 text-danger border-danger/30",
        borderClass: "border-l-danger",
      };
    case 2: // ACTION REQUIRED
      return {
        badgeClass: "bg-warning/20 text-warning border-warning/30",
        borderClass: "border-l-warning",
      };
    case 3: // ARRIVING SOON
      return {
        badgeClass: "bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30",
        borderClass: "border-l-accent-cyan",
      };
    default:
      return {
        badgeClass: "",
        borderClass: "",
      };
  }
}

export function SummaryCard({ ro, summary, onClick }: Props) {
  const { badgeClass, borderClass } = getPriorityStyles(summary.priority);
  const hasUrgency = summary.priority <= 3;

  return (
    <Card
      className={cn(
        "transition-all hover:bg-muted/30 cursor-pointer",
        hasUrgency && "border-l-4",
        borderClass
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            {/* Priority badge */}
            {summary.priorityLabel && (
              <Badge
                variant="outline"
                className={cn("text-xs font-semibold uppercase", badgeClass)}
              >
                {summary.priorityLabel}
                {summary.daysOverdue && summary.priority === 1 && (
                  <span className="ml-1">({summary.daysOverdue}d)</span>
                )}
              </Badge>
            )}
            {/* One-liner */}
            <p className="text-sm leading-relaxed font-medium">
              {summary.oneLiner}
            </p>
          </div>
          <StatusBadge status={ro.curentStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Snapshot bullets */}
        <ul className="space-y-1 text-sm text-muted-foreground">
          {summary.snapshot.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-muted-foreground/50 select-none">-</span>
              <span className="font-mono text-xs break-all">{bullet}</span>
            </li>
          ))}
        </ul>

        {/* Next Step */}
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-md text-sm",
            summary.priority === 1
              ? "bg-danger/10 text-danger"
              : summary.priority === 2
              ? "bg-warning/10 text-warning"
              : "bg-accent-cyan/10 text-accent-cyan"
          )}
        >
          <ArrowRight className="h-4 w-4 shrink-0" />
          <span>{summary.nextStep}</span>
        </div>
      </CardContent>
    </Card>
  );
}
