"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { active } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk/v3";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Default source sheet name (from env or fallback)
const DEFAULT_SOURCE_SHEET = process.env.EXCEL_WORKSHEET_NAME ?? "Active";

/**
 * Updates a repair order's status in MySQL and optionally triggers
 * the ro-lifecycle-flow task for specific statuses.
 *
 * If destinationSheet is provided, also triggers the move-ro-sheet task
 * to move the RO from Active sheet to the destination sheet (NET, Paid, Returns).
 *
 * Per CLAUDE.md Write-Behind Pattern:
 * UI -> Server Action -> MySQL Write -> Push Job to Trigger.dev
 */
export async function updateRepairOrderStatus(
  repairOrderId: number,
  newStatus: string,
  destinationSheet?: string
): Promise<Result<{ runId?: string; moveRunId?: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Fetch current status for comparison
    const [currentRO] = await db
      .select({ curentStatus: active.curentStatus })
      .from(active)
      .where(eq(active.id, repairOrderId))
      .limit(1);

    if (!currentRO) {
      return { success: false, error: "Repair order not found" };
    }

    const oldStatus = currentRO.curentStatus ?? "";

    // Update status in MySQL
    await db
      .update(active)
      .set({
        curentStatus: newStatus,
        curentStatusDate: new Date().toISOString().split("T")[0],
      })
      .where(eq(active.id, repairOrderId));

    // Revalidate dashboard to refresh table data
    revalidatePath("/dashboard");

    // Statuses that trigger the follow-up flow
    const TRACKED_STATUSES = [
      "WAITING QUOTE",
      "APPROVED",
      "IN WORK",
      "IN PROGRESS",
      "SHIPPED",
      "IN TRANSIT",
    ];

    // Trigger ro-lifecycle-flow for tracked statuses
    // This starts the durable wait + email drafting flow
    let runId: string | undefined;
    let moveRunId: string | undefined;
    const normalizedNew = newStatus.toUpperCase().trim();
    const normalizedOld = oldStatus.toUpperCase().trim();

    if (TRACKED_STATUSES.includes(normalizedNew) && normalizedNew !== normalizedOld) {
      const handle = await tasks.trigger("handle-ro-status-change", {
        repairOrderId,
        newStatus: normalizedNew,
        oldStatus: normalizedOld,
        userId: session.user.id,
      });
      runId = handle.id;
    }

    // If destinationSheet is provided, trigger the move-ro-sheet task
    // This moves the RO from Active sheet to NET/Paid/Returns
    if (destinationSheet) {
      const moveHandle = await tasks.trigger("move-ro-sheet", {
        userId: session.user.id,
        roId: repairOrderId,
        fromSheet: DEFAULT_SOURCE_SHEET,
        toSheet: destinationSheet,
      });
      moveRunId = moveHandle.id;
    }

    return { success: true, data: { runId, moveRunId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}
