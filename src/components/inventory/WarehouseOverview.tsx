"use client";

import { AlertTriangle, Clock, BarChart3, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  LowStockItem,
  RecentlyUpdatedItem,
  InventoryStats,
} from "@/app/actions/inventory";

interface WarehouseOverviewProps {
  lowStock: LowStockItem[];
  recentlyUpdated: RecentlyUpdatedItem[];
  stats: InventoryStats;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getConditionBadgeColor(condition: string | null): string {
  if (!condition) return "bg-zinc-500/20 text-zinc-400";
  const code = condition.toUpperCase();
  if (code.includes("NE") || code.includes("NEW")) return "bg-sky-500/20 text-sky-400";
  if (code.includes("OH") || code.includes("OVERHAUL")) return "bg-emerald-500/20 text-emerald-400";
  if (code.includes("SV") || code.includes("SERVICEABLE")) return "bg-teal-500/20 text-teal-400";
  if (code.includes("AR") || code.includes("AS REMOVED")) return "bg-zinc-400/20 text-zinc-300";
  if (code.includes("RP") || code.includes("REPAIR")) return "bg-amber-500/20 text-amber-400";
  return "bg-zinc-500/20 text-zinc-400";
}

function getConditionLabel(condition: string | null): string {
  if (!condition) return "?";
  const code = condition.toUpperCase();
  if (code.includes("NE") || code.includes("NEW")) return "NE";
  if (code.includes("OH") || code.includes("OVERHAUL")) return "OH";
  if (code.includes("SV") || code.includes("SERVICEABLE")) return "SV";
  if (code.includes("AR") || code.includes("AS REMOVED")) return "AR";
  if (code.includes("RP") || code.includes("REPAIR")) return "RP";
  return condition.slice(0, 2).toUpperCase();
}

export function WarehouseOverview({
  lowStock,
  recentlyUpdated,
  stats,
}: WarehouseOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Low Stock Alerts */}
      <Card className="border-l-4 border-l-danger bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-danger" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              All stock levels healthy
            </p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {lowStock.map((item) => (
                <li
                  key={item.indexId}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-medium text-foreground truncate">
                      {item.partNumber || "No P/N"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description || "No description"}
                    </p>
                  </div>
                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold text-danger bg-danger/10">
                    {item.qty ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recently Updated */}
      <Card className="border-l-4 border-l-muted-foreground/30 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recently Updated
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {recentlyUpdated.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity
            </p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {recentlyUpdated.map((item) => (
                <li
                  key={item.indexId}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-medium text-foreground truncate">
                      {item.partNumber || "No P/N"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description || "No description"}
                    </p>
                  </div>
                  <div className="ml-2 flex items-center gap-2 shrink-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${getConditionBadgeColor(
                        item.condition
                      )}`}
                    >
                      {getConditionLabel(item.condition)}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(item.lastSeen)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Inventory Stats */}
      <Card className="border-l-4 border-l-sky-500 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-sky-500" />
            Inventory Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4">
            {/* Total Items */}
            <div className="text-center py-3 rounded-lg bg-muted/50">
              <Package className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {stats.totalItems.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Items</p>
            </div>

            {/* Total Quantity */}
            <div className="text-center py-3 rounded-lg bg-muted/50">
              <BarChart3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {stats.totalQuantity.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Units</p>
            </div>
          </div>

          {/* Condition Breakdown */}
          {Object.keys(stats.conditionBreakdown).length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">By Condition:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats.conditionBreakdown)
                  .slice(0, 5)
                  .map(([condition, count]) => (
                    <span
                      key={condition}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getConditionBadgeColor(
                        condition
                      )}`}
                    >
                      {getConditionLabel(condition)}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Skeleton for loading state
export function WarehouseOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-card/80 backdrop-blur-sm animate-pulse">
          <CardHeader className="pb-2">
            <div className="h-5 w-32 bg-muted rounded" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-8 bg-muted rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
