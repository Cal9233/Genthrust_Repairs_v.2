import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getDashboardStats,
  type RepairOrderFilter,
} from "@/app/actions/dashboard";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { RepairOrderTable } from "@/components/dashboard/RepairOrderTable";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  const { user } = session;

  // Parse filter from searchParams
  const params = await searchParams;
  const filter: RepairOrderFilter =
    params.filter === "overdue" ? "overdue" : "all";

  // Fetch dashboard stats on the server
  const statsResult = await getDashboardStats();
  const stats = statsResult.success ? statsResult.data : null;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.name ?? user.email}
        </p>
      </div>

      {/* KPI Stats Grid */}
      <StatsGrid stats={stats} activeFilter={filter} />

      {/* Repair Orders Table */}
      <RepairOrderTable filter={filter} />
    </div>
  );
}
