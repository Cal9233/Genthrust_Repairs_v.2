"use server";

import { auth } from "@/auth";
import { tasks } from "@trigger.dev/sdk/v3";
import { syncRepairOrders } from "@/trigger/excel-sync";
import type { SyncRepairOrdersPayload } from "@/trigger/excel-sync";

/**
 * Result type per CLAUDE.md Section 4
 * All Server Actions must return this standardized type.
 */
type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Trigger handle returned when starting a sync job
 */
export interface TriggerSyncResult {
  /** The Trigger.dev run ID for tracking */
  runId: string;
  /** Public access token for realtime updates */
  publicAccessToken: string;
}

/**
 * triggerSync Server Action
 *
 * Authenticates the user and dispatches the sync-repair-orders task
 * to Trigger.dev for background processing.
 *
 * Per CLAUDE.md Section 3A (Write-Behind Pattern):
 * Flow: UI -> Server Action -> MySQL Write -> Push Job to Trigger.dev
 *
 * @param payload - The sync payload containing batchId and repairOrderIds
 * @returns Result with runId and publicAccessToken for realtime tracking
 */
export async function triggerSync(
  payload: SyncRepairOrdersPayload
): Promise<Result<TriggerSyncResult>> {
  try {
    // ==========================================
    // AUTHENTICATION CHECK
    // ==========================================
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized: You must be signed in to sync repair orders",
      };
    }

    // Check for token errors (e.g., expired refresh token)
    if (session.error) {
      return {
        success: false,
        error: `Authentication error: ${session.error}. Please sign in again.`,
      };
    }

    // ==========================================
    // VALIDATION
    // ==========================================
    if (!payload.batchId) {
      return {
        success: false,
        error: "Validation error: batchId is required",
      };
    }

    if (!payload.repairOrderIds || payload.repairOrderIds.length === 0) {
      return {
        success: false,
        error: "Validation error: At least one repairOrderId is required",
      };
    }

    // ==========================================
    // TRIGGER THE BACKGROUND TASK
    // ==========================================
    const handle = await tasks.trigger<typeof syncRepairOrders>(
      "sync-repair-orders",
      payload
    );

    // Get the public access token for realtime updates
    const publicAccessToken = await handle.publicAccessToken;

    return {
      success: true,
      data: {
        runId: handle.id,
        publicAccessToken,
      },
    };
  } catch (error) {
    console.error("triggerSync error:", error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Failed to trigger sync job",
    };
  }
}

/**
 * triggerSyncBatch Server Action
 *
 * Convenience function to sync all pending repair orders for a given batch.
 * This would typically fetch repair order IDs from the database first.
 *
 * NOTE: This is a placeholder for Phase 4 when we integrate with the database.
 *
 * @param batchId - The batch ID to sync
 * @returns Result with runId and publicAccessToken for realtime tracking
 */
export async function triggerSyncBatch(
  batchId: string
): Promise<Result<TriggerSyncResult>> {
  try {
    // Authentication check
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized: You must be signed in to sync repair orders",
      };
    }

    // TODO: Phase 4 - Fetch pending repair order IDs from database
    // const pendingOrders = await db
    //   .select({ id: repairOrders.id })
    //   .from(repairOrders)
    //   .where(eq(repairOrders.syncStatus, 'pending'));

    // For now, return an error indicating this needs implementation
    return {
      success: false,
      error: "Not implemented: triggerSyncBatch requires Phase 4 database integration",
    };
  } catch (error) {
    console.error("triggerSyncBatch error:", error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Failed to trigger batch sync",
    };
  }
}
