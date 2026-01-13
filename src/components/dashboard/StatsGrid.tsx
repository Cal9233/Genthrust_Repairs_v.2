"use client";

import { Package, AlertTriangle, Clock, DollarSign, Truck, Calendar, FileCheck } from "lucide-react";
import { HeroStatCard } from "./HeroStatCard";
import { StatCard } from "./StatCard";
import type { RepairOrderFilter } from "@/app/actions/dashboard";
import { useStatsStore } from "@/stores/stats-store";

type StatsGridProps = {
  activeFilter?: RepairOrderFilter;
};

/**
 * Format a number as USD currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function StatsGrid({ activeFilter = "all" }: StatsGridProps) {
  // Get stats from Zustand store - automatically updates when data changes
  const stats = useStatsStore((state) => state.stats);
  const loading = useStatsStore((state) => state.loading);

  // Show loading skeleton while fetching
  if (loading || !stats) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {/* Hero skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 sm:h-32 rounded-xl sm:rounded-2xl bg-muted animate-pulse"
            />
          ))}
        </div>
        {/* Secondary skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 sm:h-20 rounded-lg sm:rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Row - 3 large gradient cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <HeroStatCard
          title="Total Active"
          value={stats.totalActive}
          icon={Package}
          variant="primary"
          href="/dashboard"
          isActive={activeFilter === "all"}
        />
        <HeroStatCard
          title="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          variant="danger"
          href="/dashboard?filter=overdue"
          isActive={activeFilter === "overdue"}
          subtitle="Requires attention"
        />
        <HeroStatCard
          title="Value in Work"
          value={formatCurrency(stats.valueInWork)}
          icon={DollarSign}
          variant="success"
        />
      </div>

      {/* Secondary Row - 4 smaller cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Waiting Quote"
          value={stats.waitingQuote}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={FileCheck}
          variant="default"
        />
        <StatCard
          title="Shipped"
          value={stats.shipped}
          icon={Truck}
          variant="default"
        />
        <StatCard
          title="NET 30"
          value={stats.net30}
          icon={Calendar}
          variant="default"
        />
      </div>
    </div>
  );
}
