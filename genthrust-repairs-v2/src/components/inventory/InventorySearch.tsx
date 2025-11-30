"use client";

import { useState, useTransition, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { searchInventory } from "@/app/actions/inventory";
import { useDebounce } from "@/hooks/useDebounce";

type InventoryItem = {
  indexId: number;
  partNumber: string | null;
  description: string | null;
  qty: number | null;
  location: string | null;
  condition: string | null;
  tableName: string | null;
  serialNumber: string | null;
  lastSeen: string | null;
};

export function InventorySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const debouncedQuery = useDebounce(query, 300);

  // Auto-search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await searchInventory(debouncedQuery);
      if (result.success) {
        setResults(result.data);
      } else {
        setError(result.error);
        setResults([]);
      }
    });
  }, [debouncedQuery]);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search by part number or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full"
        />
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            Searching...
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && <div className="text-red-500 text-sm">{error}</div>}

      {/* Results Table */}
      {results.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part Number</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Condition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item) => (
              <TableRow key={item.indexId}>
                <TableCell className="font-mono">
                  {item.partNumber ?? "—"}
                </TableCell>
                <TableCell>{item.description ?? "—"}</TableCell>
                <TableCell className="text-right">{item.qty ?? 0}</TableCell>
                <TableCell>{item.location ?? "—"}</TableCell>
                <TableCell>{item.condition ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Empty State */}
      {results.length === 0 && !isPending && query.length >= 2 && (
        <div className="text-muted-foreground text-center py-8">
          No results found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
