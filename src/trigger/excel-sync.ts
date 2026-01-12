import { task, metadata, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "../lib/db";
import { active } from "../lib/schema";
import { inArray, and, notInArray } from "drizzle-orm";
import {
  getGraphClient,
  createExcelSession,
  closeExcelSession,
  chunkArray,
} from "../lib/graph";
import { dbRowToExcelRow } from "../lib/graph/excel-mapping";
import { findRowsByRO, getNextAvailableRow } from "../lib/graph/excel-search";
import {
  executeBatch,
  buildBatchUpdateRequests,
  analyzeBatchResponse,
  hasRateLimitError,
} from "../lib/graph/batch";
import { UserNotConnectedError } from "../lib/types/graph";

/**
 * Payload schema for sync-repair-orders task
 */
export const syncRepairOrdersPayloadSchema = z.object({
  userId: z.string(),
  repairOrderIds: z.array(z.number()),
});

export type SyncRepairOrdersPayload = z.infer<
  typeof syncRepairOrdersPayloadSchema
>;

/**
 * Output schema for sync-repair-orders task
 */
export const syncRepairOrdersOutputSchema = z.object({
  syncedCount: z.number(),
  failedCount: z.number(),
  rowsUpdated: z.number(),
  rowsAdded: z.number(),
  errors: z.array(z.string()).optional(),
});

export type SyncRepairOrdersOutput = z.infer<
  typeof syncRepairOrdersOutputSchema
>;

// Environment configuration
const WORKBOOK_ID = process.env.EXCEL_WORKBOOK_ID;
const WORKSHEET_NAME = process.env.EXCEL_WORKSHEET_NAME ?? "Active";

/**
 * sync-repair-orders Task
 *
 * Per CLAUDE.md Section 3C: Runs in a Trigger.dev container with 2GB RAM
 * to handle large Excel files in memory. No timeouts.
 *
 * Flow: UI -> Server Action -> MySQL Write -> This Task -> Excel via Graph API
 *
 * This implements the "Write-Behind" pattern where MySQL is the source of truth
 * and Excel is a downstream replica.
 */
export const syncRepairOrders = task({
  id: "sync-repair-orders",
  // 2GB RAM for large Excel file handling per CLAUDE.md
  machine: {
    preset: "small-1x",
  },
  // Retry configuration - let 429 errors bubble up for automatic retry
  retry: {
    maxAttempts: 3,
  },
  run: async (
    payload: SyncRepairOrdersPayload
  ): Promise<SyncRepairOrdersOutput> => {
    const { userId, repairOrderIds } = payload;
    const totalItems = repairOrderIds.length;

    logger.info("Starting Excel sync...", { userId, totalItems });

    // Initialize progress tracking
    await metadata.set("progress", 0);
    await metadata.set("status", "starting");
    await metadata.set("totalItems", totalItems);
    await metadata.set("processedItems", 0);

    // Validate configuration
    if (!WORKBOOK_ID) {
      throw new Error("EXCEL_WORKBOOK_ID environment variable is not set");
    }

    let sessionId: string | null = null;
    let rowsUpdated = 0;
    let rowsAdded = 0;
    const errors: string[] = [];

    try {
      // ==========================================
      // PHASE 1: Initialize (10%)
      // ==========================================
      await metadata.set("status", "initializing");
      logger.info("Phase 1: Authenticating and creating Excel session");

      // Get Graph client for the user
      let client;
      try {
        client = await getGraphClient(userId);
      } catch (error) {
        if (error instanceof UserNotConnectedError) {
          logger.error("User not connected to Microsoft", { userId });
          return {
            syncedCount: 0,
            failedCount: totalItems,
            rowsUpdated: 0,
            rowsAdded: 0,
            errors: [error.message],
          };
        }
        throw error;
      }

      // Create Excel session with persistChanges: true
      const session = await createExcelSession(client, WORKBOOK_ID);
      sessionId = session.id;
      logger.info("Excel session created", { sessionId });

      await metadata.set("progress", 10);

      // ==========================================
      // PHASE 2: Fetch Data (15%)
      // ==========================================
      await metadata.set("status", "fetching");
      logger.info("Phase 2: Fetching repair order data from database");

      // Statuses that belong to OTHER sheets (not Active)
      // These are managed by move-ro-sheet task, not this sync task
      const ARCHIVED_STATUSES = [
        "COMPLETE",
        "NET",
        "PAID",
        "RETURNS",
        "BER",
        "RAI",
        "CANCELLED",
      ];

      // Fetch repair orders from MySQL
      // SAFETY: Exclude archived statuses to prevent "zombie rows"
      // (rows that get re-created on Active sheet after being moved)
      const repairOrders = await db
        .select()
        .from(active)
        .where(
          and(
            inArray(active.id, repairOrderIds),
            notInArray(active.curentStatus, [...ARCHIVED_STATUSES])
          )
        );

      if (repairOrders.length === 0) {
        logger.warn("No repair orders found for given IDs", { repairOrderIds });
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return {
          syncedCount: 0,
          failedCount: 0,
          rowsUpdated: 0,
          rowsAdded: 0,
        };
      }

      // Get RO numbers for row lookup
      const roNumbers = repairOrders
        .filter((ro) => ro.ro !== null)
        .map((ro) => ro.ro as number);

      // Find existing rows by RO number
      const existingRows = await findRowsByRO(
        client,
        WORKBOOK_ID,
        WORKSHEET_NAME,
        sessionId,
        roNumbers
      );
      logger.info("Found existing rows", { count: existingRows.size });

      // Get next available row for new entries
      let nextRow = await getNextAvailableRow(
        client,
        WORKBOOK_ID,
        WORKSHEET_NAME,
        sessionId
      );

      await metadata.set("progress", 15);

      // ==========================================
      // PHASE 3: Process Batches (15-90%)
      // ==========================================
      await metadata.set("status", "processing");
      logger.info("Phase 3: Processing repair orders in batches");

      // Chunk repair orders into groups of 20 (Graph API batch limit)
      const chunks = chunkArray(repairOrders, 20);
      const totalChunks = chunks.length;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        // Build batch updates
        const updates: Array<{
          rowNumber: number;
          values: (string | number | null)[];
        }> = [];

        for (const order of chunk) {
          const values = dbRowToExcelRow(order);

          // Check if row exists (by RO number)
          if (order.ro !== null && existingRows.has(order.ro)) {
            // Update existing row
            const rowNumber = existingRows.get(order.ro)!;
            updates.push({ rowNumber, values });
            rowsUpdated++;
          } else {
            // Add new row
            updates.push({ rowNumber: nextRow, values });
            nextRow++;
            rowsAdded++;
          }
        }

        // Build and execute batch request
        const requests = buildBatchUpdateRequests(
          WORKBOOK_ID,
          WORKSHEET_NAME,
          updates
        );

        const response = await executeBatch(client, requests, sessionId);
        const analysis = analyzeBatchResponse(response);

        // Handle rate limit by throwing to trigger retry
        if (hasRateLimitError(response)) {
          logger.warn("Rate limited by Graph API, triggering retry");
          throw new Error("Rate limited by Microsoft Graph API");
        }

        // Log any errors
        if (analysis.errors.length > 0) {
          errors.push(...analysis.errors);
          logger.error("Batch errors", { errors: analysis.errors });
        }

        // Update progress
        const processedItems = (chunkIndex + 1) * 20;
        const progress = Math.round(15 + ((chunkIndex + 1) / totalChunks) * 75);
        await metadata.set("progress", Math.min(progress, 90));
        await metadata.set("processedItems", Math.min(processedItems, totalItems));

        logger.debug("Processed batch", {
          chunkIndex: chunkIndex + 1,
          totalChunks,
          progress,
        });
      }

      // ==========================================
      // PHASE 4: Cleanup (95-100%)
      // ==========================================
      await metadata.set("status", "finishing");
      await metadata.set("progress", 95);
      logger.info("Phase 4: Closing Excel session");

      // Close session to save changes
      await closeExcelSession(client, WORKBOOK_ID, sessionId);
      sessionId = null; // Mark as closed

      await metadata.set("status", "completed");
      await metadata.set("progress", 100);

      const syncedCount = rowsUpdated + rowsAdded;
      logger.info("Sync completed", {
        syncedCount,
        rowsUpdated,
        rowsAdded,
        failedCount: errors.length,
      });

      return {
        syncedCount,
        failedCount: errors.length,
        rowsUpdated,
        rowsAdded,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      // Attempt to close session on error
      if (sessionId) {
        try {
          const client = await getGraphClient(userId);
          await closeExcelSession(client, WORKBOOK_ID!, sessionId);
          logger.info("Session closed after error");
        } catch (closeError) {
          logger.error("Failed to close session after error", { closeError });
        }
      }

      // Re-throw for Trigger.dev retry (handles 429 and transient errors)
      throw error;
    }
  },
});
