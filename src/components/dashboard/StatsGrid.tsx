import Link from "next/link";
import { Package, AlertTriangle, Clock, DollarSign } from "lucide-react";
import { StatCard } from "./StatCard";
import type { DashboardStats, RepairOrderFilter } from "@/app/actions/dashboard";

type StatsGridProps = {
  stats: DashboardStats | null;
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

export function StatsGrid({ stats, activeFilter = "all" }: StatsGridProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Link href="/dashboard" className="block transition-opacity hover:opacity-80">
        <StatCard
          title="Total Active"
          value={stats.totalActive}
          icon={Package}
          variant="default"
          className={activeFilter === "all" ? "ring-2 ring-primary-bright-blue" : ""}
        />
      </Link>
      <Link href="/dashboard?filter=overdue" className="block transition-opacity hover:opacity-80">
        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          variant="danger"
          className={activeFilter === "overdue" ? "ring-2 ring-danger-red" : ""}
        />
      </Link>
      <StatCard
        title="Waiting Quote"
        value={stats.waitingQuote}
        icon={Clock}
        variant="warning"
      />
      <StatCard
        title="Value in Work"
        value={formatCurrency(stats.valueInWork)}
        icon={DollarSign}
        variant="success"
      />
    </div>
  );
}
