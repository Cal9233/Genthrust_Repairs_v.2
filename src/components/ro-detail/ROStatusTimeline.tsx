"use client";

import { Clock, User, ArrowRight } from "lucide-react";
import type { StatusHistoryEntry } from "@/app/actions/repair-orders";

interface ROStatusTimelineProps {
  history: StatusHistoryEntry[];
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function getStatusColor(status: string): string {
  const normalized = status.toUpperCase().trim();

  if (normalized.startsWith("APPROVED")) return "bg-success";
  if (["WAITING QUOTE", "PENDING"].includes(normalized)) return "bg-warning";
  if (["IN WORK", "IN PROGRESS"].includes(normalized)) return "bg-primary";
  if (["SHIPPED", "IN TRANSIT"].includes(normalized)) return "bg-info";
  if (["RECEIVED", "COMPLETE"].includes(normalized)) return "bg-success";
  if (["BER", "RAI", "CANCELLED"].includes(normalized)) return "bg-danger";

  return "bg-muted-foreground";
}

export function ROStatusTimeline({ history }: ROStatusTimelineProps) {
  if (!history.length) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 border border-border">
        <h3 className="font-semibold text-sm mb-4">Status History</h3>
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No status history recorded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border">
      <h3 className="font-semibold text-sm mb-4">Status History</h3>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-4">
          {history.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-4 pl-8">
              {/* Timeline dot */}
              <div
                className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full ${getStatusColor(
                  entry.status
                )} ring-4 ring-background`}
              />

              <div className="flex-1 min-w-0">
                {/* Status change */}
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.previousStatus && (
                    <>
                      <span className="text-sm text-muted-foreground">
                        {entry.previousStatus}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </>
                  )}
                  <span className="font-medium text-sm">{entry.status}</span>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(entry.changedAt)}
                  </span>
                  {entry.changedByName && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {entry.changedByName}
                    </span>
                  )}
                </div>

                {/* Notes */}
                {entry.notes && (
                  <p className="mt-2 text-sm text-muted-foreground bg-background/50 rounded p-2">
                    {entry.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
