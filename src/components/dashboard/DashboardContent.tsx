"use client";

import { SyncProvider } from "@/contexts/SyncContext";
import { RepairOrderTable } from "./RepairOrderTable";
import { AutoImportTrigger } from "./AutoImportTrigger";
import type { RepairOrderFilter, SheetFilter } from "@/app/actions/dashboard";

interface DashboardContentProps {
  userId: string;
  filter: RepairOrderFilter;
  sheet: SheetFilter;
}

/**
 * Client component wrapper for dashboard content.
 * Provides SyncContext to coordinate loading state between
 * AutoImportTrigger and RepairOrderTable.
 */
export function DashboardContent({
  userId,
  filter,
  sheet,
}: DashboardContentProps) {
  return (
    <SyncProvider>
      {/* Auto-import from Excel on first session load */}
      <AutoImportTrigger userId={userId} />

      {/* Repair Orders Table */}
      <RepairOrderTable filter={filter} sheet={sheet} />
    </SyncProvider>
  );
}
