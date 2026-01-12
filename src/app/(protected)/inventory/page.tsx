import { Suspense } from "react";
import {
  getLowStockItems,
  getRecentlyUpdated,
  getInventoryStats,
} from "@/app/actions/inventory";
import {
  WarehouseOverviewSkeleton,
} from "@/components/inventory/WarehouseOverview";
import { InventoryContent } from "./InventoryContent";

export default async function InventoryPage() {
  // Prefetch dashboard data for Zero State
  const [lowStockResult, recentlyUpdatedResult, statsResult] = await Promise.all([
    getLowStockItems(),
    getRecentlyUpdated(),
    getInventoryStats(),
  ]);

  const lowStock = lowStockResult.success ? lowStockResult.data : [];
  const recentlyUpdated = recentlyUpdatedResult.success ? recentlyUpdatedResult.data : [];
  const stats = statsResult.success
    ? statsResult.data
    : { totalItems: 0, totalQuantity: 0, conditionBreakdown: {} };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Search and manage warehouse stock
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-32 bg-muted/50 rounded-xl animate-pulse" />
            <WarehouseOverviewSkeleton />
          </div>
        }
      >
        <InventoryContent
          lowStock={lowStock}
          recentlyUpdated={recentlyUpdated}
          stats={stats}
        />
      </Suspense>
    </div>
  );
}
