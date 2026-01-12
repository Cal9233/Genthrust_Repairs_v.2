"use client";

import { AlertCircle, Clock } from "lucide-react";
import type { DueDateStatus } from "./useRODetail";
import { parseDate } from "@/lib/date-utils";

interface RODueDateAlertProps {
  status: DueDateStatus;
  nextDateToUpdate: string | null | undefined;
}

export function RODueDateAlert({ status, nextDateToUpdate }: RODueDateAlertProps) {
  if (status === "on_track" || status === "no_date") {
    return null;
  }

  const nextDate = nextDateToUpdate ? parseDate(nextDateToUpdate) : null;
  const formattedDate = nextDate
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(nextDate)
    : "Unknown";

  const config = {
    overdue: {
      icon: AlertCircle,
      bgClass: "bg-danger/10 border-danger/30",
      textClass: "text-danger",
      title: "Overdue",
      description: `Update was due on ${formattedDate}`,
      animate: true,
    },
    due_soon: {
      icon: Clock,
      bgClass: "bg-warning/10 border-warning/30",
      textClass: "text-warning",
      title: "Due Soon",
      description: `Next update due on ${formattedDate}`,
      animate: false,
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border mb-4 ${config.bgClass} ${
        config.animate ? "animate-pulse" : ""
      }`}
    >
      <Icon className={`h-5 w-5 ${config.textClass} flex-shrink-0`} />
      <div className="flex-1">
        <p className={`font-semibold ${config.textClass}`}>{config.title}</p>
        <p className={`text-sm ${config.textClass} opacity-80`}>
          {config.description}
        </p>
      </div>
    </div>
  );
}
