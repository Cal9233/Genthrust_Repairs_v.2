"use client";

import { useState, useEffect, useTransition } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { getRepairOrders, type RepairOrder } from "@/app/actions/dashboard";
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
import { Search, Loader2 } from "lucide-react";

/**
 * Format a number as RO# display
 */
function formatRO(ro: number | null | undefined): string {
  if (ro === null || ro === undefined) return "-";
  return ro.toString();
}

/**
 * Format a date string for display
 */
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  // If already in readable format, return as-is
  if (dateString.includes("/")) return dateString;
  // Try to parse and format
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-US");
}

/**
 * Format a number as USD currency
 */
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function RepairOrderTable() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RepairOrder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch data when query or page changes
  useEffect(() => {
    startTransition(async () => {
      const result = await getRepairOrders(debouncedQuery, page);
      if (result.success) {
        setData(result.data.data);
        setTotalPages(result.data.totalPages);
        setTotalCount(result.data.totalCount);
        setError(null);
      } else {
        setError(result.error);
        setData([]);
      }
    });
  }, [debouncedQuery, page]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Repair Orders</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount} total records
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search RO, shop, part, serial..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        <div className="relative overflow-x-auto">
          {isPending && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">RO #</TableHead>
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
                    {query ? "No results found" : "No repair orders"}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((ro) => (
                  <TableRow key={ro.id}>
                    <TableCell className="font-medium tabular-nums">
                      {formatRO(ro.ro)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ro.shopName || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[200px]">
                          {ro.part || "-"}
                        </span>
                        {ro.serial && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            S/N: {ro.serial}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ro.curentStatus} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(ro.nextDateToUpdate)}
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

        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
