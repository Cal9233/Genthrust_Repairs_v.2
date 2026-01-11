import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getDashboardStats,
  type RepairOrderFilter,
  type SheetFilter,
} from "@/app/actions/dashboard";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { ERPSyncButton } from "@/components/dashboard/ERPSyncButton";

// Valid sheet filter values
const VALID_SHEETS: SheetFilter[] = ["active", "net", "paid", "returns"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sheet?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  const { user } = session;

  // Parse filter and sheet from searchParams
  const params = await searchParams;
  const filter: RepairOrderFilter =
    params.filter === "overdue" ? "overdue" : "all";
  const sheet: SheetFilter = VALID_SHEETS.includes(params.sheet as SheetFilter)
    ? (params.sheet as SheetFilter)
    : "active";

  // Fetch dashboard stats on the server
  const statsResult = await getDashboardStats();
  const stats = statsResult.success ? statsResult.data : null;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Welcome back, <span className="font-medium text-foreground">{user.name ?? user.email}</span>
          </p>
        </div>
        <div className="flex-shrink-0">
          <ERPSyncButton />
        </div>
      </div>

      {/* KPI Stats Grid */}
      <StatsGrid stats={stats} activeFilter={filter} />

      {/* Auto-import + Repair Orders Table (coordinated via SyncContext) */}
      <DashboardContent userId={user.id} filter={filter} sheet={sheet} />
    </div>
  );
}
