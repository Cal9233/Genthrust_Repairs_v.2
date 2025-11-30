import { task, metadata, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

/**
 * Payload schema for sync-repair-orders task
 */
export const syncRepairOrdersPayloadSchema = z.object({
  batchId: z.string(),
  repairOrderIds: z.array(z.string()),
});

export type SyncRepairOrdersPayload = z.infer<typeof syncRepairOrdersPayloadSchema>;

/**
 * Output schema for sync-repair-orders task
 */
export const syncRepairOrdersOutputSchema = z.object({
  batchId: z.string(),
  syncedCount: z.number(),
  failedCount: z.number(),
  errors: z.array(z.string()).optional(),
});

export type SyncRepairOrdersOutput = z.infer<typeof syncRepairOrdersOutputSchema>;

/**
 * sync-repair-orders Task
 *
 * Per CLAUDE.md Section 3C: Runs in a Trigger.dev container with 2GB RAM
 * to handle large Excel files in memory. No timeouts.
 *
 * Flow: UI -> Server Action -> MySQL Write -> This Task -> Excel via Graph API
 *
 * NOTE: This is an orchestration skeleton. Actual Microsoft Graph API
 * logic will be implemented in Phase 4.
 */
export const syncRepairOrders = task({
  id: "sync-repair-orders",
  // 2GB RAM for large Excel file handling per CLAUDE.md
  machine: {
    preset: "small-1x",
  },
  // Retry configuration for resilience
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: SyncRepairOrdersPayload): Promise<SyncRepairOrdersOutput> => {
    const { batchId, repairOrderIds } = payload;
    const totalItems = repairOrderIds.length;

    logger.info("Starting sync...", { batchId, totalItems });

    // Initialize progress tracking
    await metadata.set("progress", 0);
    await metadata.set("status", "starting");
    await metadata.set("totalItems", totalItems);
    await metadata.set("processedItems", 0);

    // ==========================================
    // PHASE 1: Start
    // ==========================================
    await metadata.set("status", "initializing");
    logger.info("Phase 1: Initializing Excel sync", { batchId });

    // Simulate initialization (will be replaced with Graph API session creation)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await metadata.set("progress", 10);

    // ==========================================
    // PHASE 2: Processing
    // ==========================================
    await metadata.set("status", "processing");
    logger.info("Phase 2: Processing repair orders", {
      batchId,
      count: totalItems,
    });

    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Simulate processing each repair order
    // NOTE: In Phase 4, this will batch writes to Graph API (groups of 20)
    for (const orderId of repairOrderIds) {
      try {
        // Simulate work (will be replaced with actual Graph API call)
        await new Promise((resolve) => setTimeout(resolve, 500));

        processedCount++;
        const progress = Math.round(10 + (processedCount / totalItems) * 80);

        await metadata.set("progress", progress);
        await metadata.set("processedItems", processedCount);

        logger.debug("Processed repair order", { orderId, progress });
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed to sync ${orderId}: ${errorMessage}`);
        logger.error("Failed to process repair order", { orderId, error: errorMessage });
      }
    }

    // ==========================================
    // PHASE 3: Finish
    // ==========================================
    await metadata.set("status", "finishing");
    await metadata.set("progress", 95);
    logger.info("Phase 3: Finalizing sync", { batchId, processedCount, failedCount });

    // Simulate cleanup (will be replaced with Graph API session close)
    await new Promise((resolve) => setTimeout(resolve, 500));

    await metadata.set("status", "completed");
    await metadata.set("progress", 100);

    logger.info("Sync completed", {
      batchId,
      syncedCount: processedCount,
      failedCount,
    });

    return {
      batchId,
      syncedCount: processedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});
