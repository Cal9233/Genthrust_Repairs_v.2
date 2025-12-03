"use client";

import { useState, useEffect, useTransition } from "react";
import { getRepairOrdersForSummary } from "@/app/actions/summary";
import { NormalizedRepairOrder } from "@/app/actions/dashboard";
import { generateSummary, sortByPriority, ROSummary, Priority } from "@/lib/summary-generator";
import { SummaryCard } from "./SummaryCard";
import { RODetailPanel } from "@/components/ro-detail";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { AlertCircle, Clock, Truck, Wrench } from "lucide-react";
import { useRefresh } from "@/contexts/RefreshContext";

type SummaryItem = {
  ro: NormalizedRepairOrder;
  summary: ROSummary;
};

type PriorityGroup = {
  priority: Priority;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  items: SummaryItem[];
};

/**
 * Group summaries by priority level with section headers
 */
function groupByPriority(items: SummaryItem[]): PriorityGroup[] {
  const groups: Record<Priority, SummaryItem[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };

  for (const item of items) {
    groups[item.summary.priority].push(item);
  }

  const result: PriorityGroup[] = [];

  if (groups[1].length > 0) {
    result.push({
      priority: 1,
      label: "Overdue",
      icon: <AlertCircle className="h-5 w-5" />,
      colorClass: "text-danger",
      items: groups[1],
    });
  }

  if (groups[2].length > 0) {
    result.push({
      priority: 2,
      label: "Action Required",
      icon: <Clock className="h-5 w-5" />,
      colorClass: "text-warning",
      items: groups[2],
    });
  }

  if (groups[3].length > 0) {
    result.push({
      priority: 3,
      label: "Arriving Soon",
      icon: <Truck className="h-5 w-5" />,
      colorClass: "text-accent-cyan",
      items: groups[3],
    });
  }

  if (groups[4].length > 0) {
    result.push({
      priority: 4,
      label: "Standard Work in Progress",
      icon: <Wrench className="h-5 w-5" />,
      colorClass: "text-muted-foreground",
      items: groups[4],
    });
  }

  return result;
}

export function SummaryList() {
  const [data, setData] = useState<NormalizedRepairOrder[]>([]);
  const [isPending, startTransition] = useTransition();
  const [selectedRoId, setSelectedRoId] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { refreshKey } = useRefresh();

  // Fetch all active ROs on mount and when refresh is triggered
  useEffect(() => {
    startTransition(async () => {
      const result = await getRepairOrdersForSummary();
      if (result.success) {
        setData(result.data);
      } else {
        console.error("Failed to fetch repair orders:", result.error);
        setData([]);
      }
    });
  }, [refreshTrigger, refreshKey]);

  // Generate summaries and sort by priority
  const summaries: SummaryItem[] = data.map((ro) => ({
    ro,
    summary: generateSummary(ro),
  }));

  const sortedSummaries = sortByPriority(summaries);
  const priorityGroups = groupByPriority(sortedSummaries);

  // Count stats
  const overdueCount = summaries.filter((s) => s.summary.priority === 1).length;
  const actionCount = summaries.filter((s) => s.summary.priority === 2).length;
  const arrivingCount = summaries.filter((s) => s.summary.priority === 3).length;

  return (
    <>
      <Card className="shadow-vibrant">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {data.length} active repair orders
                {overdueCount > 0 && (
                  <span className="text-danger font-medium ml-2">
                    ({overdueCount} overdue)
                  </span>
                )}
              </p>
              {isPending && <TurbineSpinner size="sm" className="text-muted-foreground" />}
            </div>
            {/* Stats badges - horizontal scroll on mobile */}
            <div className="flex items-center gap-3 sm:gap-4 text-sm overflow-x-auto pb-1 sm:pb-0">
              {overdueCount > 0 && (
                <div className="flex items-center gap-1 text-danger min-w-fit">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">{overdueCount}</span>
                </div>
              )}
              {actionCount > 0 && (
                <div className="flex items-center gap-1 text-warning min-w-fit">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{actionCount}</span>
                </div>
              )}
              {arrivingCount > 0 && (
                <div className="flex items-center gap-1 text-accent-cyan min-w-fit">
                  <Truck className="h-4 w-4" />
                  <span className="font-medium">{arrivingCount}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {isPending && data.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <TurbineSpinner size="lg" className="text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No active repair orders found.
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {priorityGroups.map((group) => (
                <div key={group.priority} className="space-y-2 sm:space-y-3">
                  {/* Section Header */}
                  <div className={`flex items-center gap-2 ${group.colorClass}`}>
                    {group.icon}
                    <h3 className="font-semibold text-sm sm:text-base">
                      {group.label}
                      <span className="ml-2 text-xs sm:text-sm font-normal opacity-80">
                        ({group.items.length})
                      </span>
                    </h3>
                  </div>

                  {/* Cards - single column on mobile, 2 columns on lg+ */}
                  <div className="grid gap-2 sm:gap-3 grid-cols-1 lg:grid-cols-2">
                    {group.items.map(({ ro, summary }) => (
                      <SummaryCard
                        key={ro.id}
                        ro={ro}
                        summary={summary}
                        onClick={() => setSelectedRoId(Number(ro.id))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RODetailPanel
        roId={selectedRoId}
        open={!!selectedRoId}
        onOpenChange={(open) => {
          if (!open) setSelectedRoId(null);
        }}
        onDataChanged={() => setRefreshTrigger((x) => x + 1)}
      />
    </>
  );
}
