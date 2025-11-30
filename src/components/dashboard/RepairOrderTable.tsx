"use client";

import { useState, useEffect, useTransition } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  getRepairOrders,
  type RepairOrder,
  type RepairOrderFilter,
} from "@/app/actions/dashboard";
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
import { RODetailDialog } from "./RODetailDialog";
import { Search, Loader2, AlertCircle } from "lucide-react";

/**
 * Format a number as RO# display
 */
const formatRO = (ro: number | null) => {
  if (!ro) return "-";
  return ro.toString();
};

/**
 * Format currency
 */
const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return "-";
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
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(date);
    }
    // Fallback: return original string if parsing fails
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

type RepairOrderTableProps = {
  filter?: RepairOrderFilter;
};

export function RepairOrderTable({ filter = "all" }: RepairOrderTableProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RepairOrder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [selectedRoId, setSelectedRoId] = useState<number | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch data when query, page, or filter changes
  useEffect(() => {
    startTransition(async () => {
      const result = await getRepairOrders(debouncedQuery, page, filter);
      if (result.success) {
        setData(result.data.data);
        setTotalPages(result.data.totalPages);
        setTotalCount(result.data.totalCount);
      } else {
        console.error(result.error);
        setData([]);
      }
    });
  }, [debouncedQuery, page, filter]);

  // Reset to page 1 when search query or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filter]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <Card className="shadow-vibrant">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Repair Orders</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount} total records {filter === "overdue" && "(Overdue)"}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search RO, shop, part, serial..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
            {isPending && (
              <div className="absolute right-2 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">RO #</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Part / Serial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Update</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && !isPending ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((ro) => (
                  <TableRow
                    key={ro.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedRoId(Number(ro.id))}
                  >
                    <TableCell className="font-medium font-mono">
                      {formatRO(ro.ro)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={ro.shopName || ""}>
                      {ro.shopName || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{ro.part || "-"}</span>
                        <span className="text-xs text-muted-foreground">
                          S/N: {ro.serial || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ro.curentStatus} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {isOverdue(ro.nextDateToUpdate) ? (
                        <span className="text-danger-red flex items-center gap-1 font-medium">
                          <AlertCircle className="h-4 w-4" />
                          {formatDate(ro.nextDateToUpdate)}
                        </span>
                      ) : (
                        formatDate(ro.nextDateToUpdate)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(ro.estimatedCost)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex justify-end">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </CardContent>

      <RODetailDialog
        roId={selectedRoId}
        open={!!selectedRoId}
        onOpenChange={(open) => {
          if (!open) setSelectedRoId(null);
        }}
      />
    </Card>
  );
}
