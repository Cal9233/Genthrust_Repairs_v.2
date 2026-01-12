"use client";

import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FLOW = [
  { key: "WAITING QUOTE", label: "Waiting Quote", short: "Quote" },
  { key: "APPROVED", label: "Approved", short: "Approved" },
  { key: "IN WORK", label: "In Work", short: "Work" },
  { key: "SHIPPED", label: "Shipped", short: "Shipped" },
  { key: "RECEIVED", label: "Received", short: "Received" },
  { key: "COMPLETE", label: "Complete", short: "Done" },
] as const;

// Map alternative status names to canonical ones
const STATUS_ALIASES: Record<string, string> = {
  "WAITING FOR QUOTE": "WAITING QUOTE",
  "AWAITING QUOTE": "WAITING QUOTE",
  PENDING: "WAITING QUOTE",
  "IN PROGRESS": "IN WORK",
  WORKING: "IN WORK",
  "IN TRANSIT": "SHIPPED",
  "CURRENTLY BEING SHIPPED": "SHIPPED",
  SHIPPING: "SHIPPED",
  COMPLETED: "COMPLETE",
  DONE: "COMPLETE",
};

function normalizeStatus(status: string | null | undefined): string {
  if (!status) return "";
  const normalized = status.toUpperCase().trim();
  // Handle "APPROVED >>>>" variants
  if (normalized.startsWith("APPROVED")) return "APPROVED";
  return STATUS_ALIASES[normalized] || normalized;
}

function getStatusIndex(status: string | null | undefined): number {
  const normalized = normalizeStatus(status);
  return STATUS_FLOW.findIndex((s) => s.key === normalized);
}

interface ROStatusFlowchartProps {
  currentStatus: string | null | undefined;
}

export function ROStatusFlowchart({ currentStatus }: ROStatusFlowchartProps) {
  const currentIndex = getStatusIndex(currentStatus);
  const normalizedStatus = normalizeStatus(currentStatus);

  // Check for terminal statuses
  const isTerminalStatus = ["BER", "RAI", "CANCELLED"].includes(normalizedStatus);

  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border">
      <h3 className="font-semibold text-sm mb-4">Status Progress</h3>

      {/* Terminal Status Banner */}
      {isTerminalStatus && (
        <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30">
          <p className="text-danger font-medium text-center">
            Order Status: {normalizedStatus}
          </p>
        </div>
      )}

      {/* Desktop View - Horizontal Flow */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute left-8 right-8 h-0.5 bg-border top-1/2 -translate-y-1/2 z-0" />

        {STATUS_FLOW.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.key}
              className="flex flex-col items-center relative z-10"
            >
              {/* Circle indicator */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                  isCompleted &&
                    "bg-success border-success text-success-foreground",
                  isCurrent &&
                    "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                  isPending && "bg-background border-muted-foreground/30"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center max-w-[80px]",
                  isCurrent && "text-primary",
                  isCompleted && "text-success",
                  isPending && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile View - Vertical Flow */}
      <div className="md:hidden space-y-2">
        {STATUS_FLOW.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.key} className="flex items-center gap-3">
              {/* Circle indicator */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0",
                  isCompleted &&
                    "bg-success border-success text-success-foreground",
                  isCurrent &&
                    "bg-primary border-primary text-primary-foreground",
                  isPending && "bg-background border-muted-foreground/30"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-semibold">{index + 1}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-sm font-medium",
                  isCurrent && "text-primary",
                  isCompleted && "text-success",
                  isPending && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>

              {/* Current indicator */}
              {isCurrent && (
                <ArrowRight className="h-4 w-4 text-primary ml-auto animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress percentage */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Progress</span>
          <span>
            {currentIndex >= 0
              ? Math.round(((currentIndex + 1) / STATUS_FLOW.length) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{
              width: `${
                currentIndex >= 0
                  ? ((currentIndex + 1) / STATUS_FLOW.length) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
