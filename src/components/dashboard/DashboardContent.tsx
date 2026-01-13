"use client";

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
 * 
 * Note: Sync state is now managed via Zustand (useSyncStore),
 * so no provider wrapper is needed.
 */
export function DashboardContent({
  userId,
  filter,
  sheet,
}: DashboardContentProps) {
  return (
    <>
      {/* Auto-import from Excel on first session load */}
      <AutoImportTrigger userId={userId} />

      {/* Repair Orders Table */}
      <RepairOrderTable filter={filter} sheet={sheet} />
    </>
  );
}
