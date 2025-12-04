"use client";

import { useState, useCallback, useTransition } from "react";
import { InventoryOmnibar } from "@/components/inventory/InventoryOmnibar";
import { WarehouseOverview } from "@/components/inventory/WarehouseOverview";
import { InventoryTable, InventoryTableSkeleton } from "@/components/inventory/InventoryTable";
import { InventoryCardList, InventoryCardListSkeleton } from "@/components/inventory/InventoryCard";
import {
  searchInventory,
  type ConditionFilter,
  type InventoryItem,
  type LowStockItem,
  type RecentlyUpdatedItem,
  type InventoryStats,
} from "@/app/actions/inventory";

interface InventoryContentProps {
  lowStock: LowStockItem[];
  recentlyUpdated: RecentlyUpdatedItem[];
  stats: InventoryStats;
}

export function InventoryContent({
  lowStock,
  recentlyUpdated,
  stats,
}: InventoryContentProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback((searchQuery: string, condition: ConditionFilter) => {
    setQuery(searchQuery);

    if (searchQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    startTransition(async () => {
      const result = await searchInventory(searchQuery, condition);
      if (result.success) {
        setResults(result.data);
      } else {
        setResults([]);
      }
    });
  }, []);

  const handleCreateRO = useCallback((item: InventoryItem) => {
    // TODO: Integrate with AddRODialog
    // For now, show alert with part details
    alert(`Create RO for: ${item.partNumber}\n\nThis will be integrated with the Add RO dialog.`);
  }, []);

  // Show Zero State (Warehouse Overview) when not searching
  const showZeroState = !hasSearched || query.trim().length < 2;

  return (
    <div className="space-y-6">
      {/* Omnibar (always visible) */}
      <InventoryOmnibar onSearch={handleSearch} isSearching={isPending} />

      {/* Conditional Content */}
      {showZeroState ? (
        <WarehouseOverview
          lowStock={lowStock}
          recentlyUpdated={recentlyUpdated}
          stats={stats}
        />
      ) : (
        <>
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isPending ? (
                "Searching..."
              ) : (
                <>
                  Found <span className="font-medium text-foreground">{results.length}</span>{" "}
                  {results.length === 1 ? "part" : "parts"}
                  {results.length === 50 && " (showing first 50)"}
                </>
              )}
            </p>
          </div>

          {/* Results Display */}
          {isPending ? (
            <>
              {/* Desktop skeleton */}
              <div className="hidden sm:block">
                <InventoryTableSkeleton />
              </div>
              {/* Mobile skeleton */}
              <div className="sm:hidden">
                <InventoryCardListSkeleton />
              </div>
            </>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <InventoryTable items={results} onCreateRO={handleCreateRO} />
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden">
                <InventoryCardList items={results} onCreateRO={handleCreateRO} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
