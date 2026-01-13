"use client";

import { useState, useEffect, useTransition } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  getRepairOrdersBySheet,
  type NormalizedRepairOrder,
  type RepairOrderFilter,
  type SheetFilter,
  type DashboardFilters,
} from "@/app/actions/dashboard";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { isOverdue } from "@/lib/date-utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "./StatusBadge";
import { SheetFilterDropdown } from "./SheetFilterDropdown";
import { AddRODialog } from "./AddRODialog";
import { RODetailPanel } from "@/components/ro-detail";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { Search, AlertCircle, ChevronRight } from "lucide-react";
import { useRefreshStore } from "@/stores/refresh-store";
import { useSyncStore } from "@/stores/sync-store";
import { cn } from "@/lib/utils";

/**
 * Format a number as RO# display
 */
const formatRO = (ro: number | null) => {
  if (!ro) return "-";
  return ro.toString();
};

/**
 * Format currency - returns JSX for proper styling
 */
const formatCurrency = (value: number | null): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/50">-</span>;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Format date string safely
 */
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    // If it's a valid date object, format it nicely
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      // Catch absurd dates (SQL "end of time" or parsing errors like year 45988)
      if (year > 2100 || year < 1900) return "-";
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(date);
    }
    // Fallback: return original string if parsing fails
    return dateStr;
  } catch {
    return dateStr;
  }
};

/**
 * Calculate days overdue for a date
 */
const getDaysOverdue = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  // Don't calculate for absurd dates
  if (year > 2100 || year < 1900) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
};

type RepairOrderTableProps = {
  filter?: RepairOrderFilter;
  sheet?: SheetFilter;
};

/**
 * Get the sheet display name for the table title
 */
const getSheetDisplayName = (sheet: SheetFilter): string => {
  const names: Record<SheetFilter, string> = {
    active: "Active",
    net: "Net",
    paid: "Paid",
    returns: "Returns",
  };
  return names[sheet];
};

/**
 * Mobile card component for a single repair order
 */
function MobileROCard({
  ro,
  onClick,
}: {
  ro: NormalizedRepairOrder;
  onClick: () => void;
}) {
  const overdueStatus = isOverdue(ro.nextDateToUpdate);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border bg-card/80 backdrop-blur-sm",
        "hover:bg-muted/50 cursor-pointer transition-colors min-h-[72px] active:bg-muted"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        {/* Row 1: RO# and Shop */}
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-sm tabular-nums">
            RO-{formatRO(ro.ro)}
          </span>
          <span className="text-muted-foreground text-sm truncate">
            {ro.shopName || "-"}
          </span>
        </div>

        {/* Row 2: Part and Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground truncate max-w-[140px] font-mono">
            {ro.part || "-"}
          </span>
          <StatusBadge status={ro.curentStatus} className="text-xs" />
        </div>

        {/* Row 3: Next Update (if overdue, highlight) */}
        {ro.nextDateToUpdate && (
          <div className="flex items-center gap-1 text-xs font-mono">
            {overdueStatus ? (
              <span className="text-danger flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3" />
                Overdue: {formatDate(ro.nextDateToUpdate)}
                {getDaysOverdue(ro.nextDateToUpdate) && (
                  <span className="opacity-75">
                    (+{getDaysOverdue(ro.nextDateToUpdate)}d)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Next: {formatDate(ro.nextDateToUpdate)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chevron indicator */}
      <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0 ml-2" />
    </div>
  );
}

export function RepairOrderTable({
  filter = "all",
  sheet = "active",
}: RepairOrderTableProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NormalizedRepairOrder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [selectedRoId, setSelectedRoId] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const debouncedQuery = useDebounce(query, 300);
  const refreshKey = useRefreshStore((state) => state.refreshKey);
  const isSyncing = useSyncStore((state) => state.isSyncing);

  // Fetch data when query, page, filter, sheet, filters, refreshTrigger, or refreshKey changes
  useEffect(() => {
    startTransition(async () => {
      const result = await getRepairOrdersBySheet(
        sheet,
        debouncedQuery,
        page,
        filter,
        filters
      );
      if (result.success) {
        setData(result.data.data);
        setTotalPages(result.data.totalPages);
        setTotalCount(result.data.totalCount);
      } else {
        console.error(result.error);
        setData([]);
      }
    });
  }, [debouncedQuery, page, filter, sheet, filters, refreshTrigger, refreshKey]);

  // Reset to page 1 when search query, filter, sheet, or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filter, sheet, filters]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Show loading spinner during Excel sync
  if (isSyncing) {
    return (
      <Card className="shadow-sm border-border/50">
        <CardContent className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <TurbineSpinner size="lg" />
          <p className="text-muted-foreground text-sm font-medium">Syncing from Excel...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold">
                {getSheetDisplayName(sheet)} Repair Orders
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1.5">
                {totalCount} total records{" "}
                {filter === "overdue" && "(Overdue)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SheetFilterDropdown currentSheet={sheet} />
              <AddRODialog />
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search RO, shop, part..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-10"
            />
            {isPending && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <TurbineSpinner size="sm" className="text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4">
          <DashboardFilterBar
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table View - hidden on mobile */}
        <div className="hidden sm:block rounded-lg border border-border/50 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                <TableHead className="h-12 w-[100px] px-4 uppercase tracking-wide text-xs font-semibold text-muted-foreground">RO #</TableHead>
                <TableHead className="h-12 px-4 uppercase tracking-wide text-xs font-semibold text-muted-foreground">Shop</TableHead>
                <TableHead className="h-12 px-4 uppercase tracking-wide text-xs font-semibold text-muted-foreground">Part / Serial</TableHead>
                <TableHead className="h-12 px-4 uppercase tracking-wide text-xs font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="h-12 px-4 uppercase tracking-wide text-xs font-semibold text-muted-foreground">Next Update</TableHead>
                <TableHead className="h-12 px-4 text-right uppercase tracking-wide text-xs font-semibold text-muted-foreground">Est. Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && !isPending ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((ro) => (
                  <TableRow
                    key={ro.id}
                    className="group cursor-pointer transition-all duration-150 hover:bg-muted/60 active:bg-muted/70 border-b border-border/50"
                    onClick={() => setSelectedRoId(Number(ro.id))}
                  >
                    <TableCell className="px-4 py-3 font-mono font-semibold tabular-nums">
                      {formatRO(ro.ro)}
                    </TableCell>
                    <TableCell className="px-4 py-3 max-w-[200px] truncate" title={ro.shopName || ""}>
                      {ro.shopName || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-medium text-sm">{ro.part || "-"}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          S/N: {ro.serial || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge status={ro.curentStatus} />
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono tabular-nums text-sm">
                      {isOverdue(ro.nextDateToUpdate) ? (
                        <span className="text-danger flex items-center gap-1.5 font-medium">
                          <AlertCircle className="h-4 w-4" />
                          {formatDate(ro.nextDateToUpdate)}
                          {getDaysOverdue(ro.nextDateToUpdate) && (
                            <span className="text-xs opacity-75">
                              (+{getDaysOverdue(ro.nextDateToUpdate)}d)
                            </span>
                          )}
                        </span>
                      ) : (
                        formatDate(ro.nextDateToUpdate)
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono tabular-nums text-sm font-medium">
                      {formatCurrency(ro.estimatedCost)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View - visible only on mobile */}
        <div className="sm:hidden space-y-2">
          {data.length === 0 && !isPending ? (
            <div className="py-12 text-center text-muted-foreground">
              No results found.
            </div>
          ) : (
            data.map((ro) => (
              <MobileROCard
                key={ro.id}
                ro={ro}
                onClick={() => setSelectedRoId(Number(ro.id))}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="mt-4 flex justify-center sm:justify-end">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </CardContent>

      <RODetailPanel
        roId={selectedRoId}
        open={!!selectedRoId}
        onOpenChange={(open) => {
          if (!open) setSelectedRoId(null);
        }}
        onDataChanged={() => setRefreshTrigger((x) => x + 1)}
      />
    </Card>
  );
}
