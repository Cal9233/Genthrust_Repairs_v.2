"use client";

import {
  Clock,
  User,
  FileText,
  Edit3,
  Plus,
  Trash2,
  Link,
  Mail,
} from "lucide-react";
import type { ActivityLogEntry } from "@/app/actions/repair-orders";

interface ROActivityLogProps {
  activities: ActivityLogEntry[];
}

const ACTION_CONFIG: Record<
  string,
  { icon: typeof Edit3; label: string; color: string }
> = {
  FIELD_UPDATED: {
    icon: Edit3,
    label: "Updated",
    color: "text-info",
  },
  STATUS_CHANGED: {
    icon: FileText,
    label: "Status changed",
    color: "text-primary",
  },
  NOTE_ADDED: {
    icon: Plus,
    label: "Note added",
    color: "text-success",
  },
  DOCUMENT_UPLOADED: {
    icon: FileText,
    label: "Document uploaded",
    color: "text-success",
  },
  DOCUMENT_DELETED: {
    icon: Trash2,
    label: "Document deleted",
    color: "text-danger",
  },
  RELATION_ADDED: {
    icon: Link,
    label: "Linked RO",
    color: "text-info",
  },
  RELATION_REMOVED: {
    icon: Link,
    label: "Unlinked RO",
    color: "text-warning",
  },
  EMAIL_SENT: {
    icon: Mail,
    label: "Email sent",
    color: "text-success",
  },
  EMAIL_RECEIVED: {
    icon: Mail,
    label: "Email received",
    color: "text-info",
  },
  CREATED: {
    icon: Plus,
    label: "Created",
    color: "text-success",
  },
};

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

function formatFieldName(field: string | null): string {
  if (!field) return "";
  // Convert camelCase or snake_case to Title Case
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function truncateValue(value: string | null, maxLength: number = 50): string {
  if (!value) return "—";
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + "...";
}

export function ROActivityLog({ activities }: ROActivityLogProps) {
  if (!activities.length) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 border border-border">
        <h3 className="font-semibold text-sm mb-4">Activity Log</h3>
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No activity recorded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Activity Log</h3>
        <span className="text-xs text-muted-foreground">
          {activities.length} {activities.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity) => {
          const config = ACTION_CONFIG[activity.action] || {
            icon: Edit3,
            label: activity.action,
            color: "text-muted-foreground",
          };
          const Icon = config.icon;

          return (
            <div
              key={activity.id}
              className="flex gap-3 p-3 bg-background/50 rounded-lg border border-border/50"
            >
              {/* Icon */}
              <div
                className={`shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center`}
              >
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {config.label}
                      {activity.field && (
                        <span className="text-muted-foreground">
                          {" "}
                          {formatFieldName(activity.field)}
                        </span>
                      )}
                    </p>

                    {/* Value change display */}
                    {(activity.oldValue || activity.newValue) && (
                      <div className="mt-1 text-xs">
                        {activity.oldValue && activity.newValue ? (
                          <p className="text-muted-foreground">
                            <span className="line-through text-danger/70">
                              {truncateValue(activity.oldValue)}
                            </span>
                            <span className="mx-2">→</span>
                            <span className="text-success">
                              {truncateValue(activity.newValue)}
                            </span>
                          </p>
                        ) : activity.newValue ? (
                          <p className="text-success">
                            {truncateValue(activity.newValue)}
                          </p>
                        ) : (
                          <p className="text-danger/70 line-through">
                            {truncateValue(activity.oldValue)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(activity.createdAt)}
                  </span>
                  {activity.userName && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {activity.userName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
