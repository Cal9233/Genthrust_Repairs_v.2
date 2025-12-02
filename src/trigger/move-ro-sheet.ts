import { task, metadata, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "../lib/db";
import { active } from "../lib/schema";
import { eq } from "drizzle-orm";
import {
  getGraphClient,
  createExcelSession,
  closeExcelSession,
} from "../lib/graph";
import { dbRowToExcelRow } from "../lib/graph/excel-mapping";
import { findRowsByRO, getNextAvailableRow } from "../lib/graph/excel-search";
import {
  executeBatch,
  buildUpdateRowRequest,
  buildDeleteRowRequest,
  analyzeBatchResponse,
  hasRateLimitError,
} from "../lib/graph/batch";
import { UserNotConnectedError } from "../lib/types/graph";

/**
 * Payload schema for move-ro-sheet task
 */
export const moveRoSheetPayloadSchema = z.object({
  userId: z.string(),
  roId: z.number(),
  fromSheet: z.string(),
  toSheet: z.string(),
});

export type MoveRoSheetPayload = z.infer<typeof moveRoSheetPayloadSchema>;

/**
 * Output schema for move-ro-sheet task
 */
export const moveRoSheetOutputSchema = z.object({
  success: z.boolean(),
  roNumber: z.number().nullable(),
  fromSheet: z.string(),
  toSheet: z.string(),
  fromRow: z.number().nullable(),
  toRow: z.number().nullable(),
  error: z.string().optional(),
});

export type MoveRoSheetOutput = z.infer<typeof moveRoSheetOutputSchema>;

// Environment configuration - lazy loaded
const getWorkbookId = () => process.env.EXCEL_WORKBOOK_ID;

/**
 * move-ro-sheet Task
 *
 * Moves a repair order from one Excel sheet to another (e.g., Active -> NET).
 *
 * Safety: Uses a 3-step process:
 *   Step A: Find row in source sheet
 *   Step B: Add row to destination sheet
 *   Step C: Delete row from source sheet (ONLY if Step B succeeds)
 *
 * This ensures we never lose data - if the add fails, the delete is skipped.
 */
export const moveRoSheet = task({
  id: "move-ro-sheet",
  machine: {
    preset: "small-1x",
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: MoveRoSheetPayload): Promise<MoveRoSheetOutput> => {
    const { userId, roId, fromSheet, toSheet } = payload;

    logger.info("Starting RO sheet move...", { roId, fromSheet, toSheet });

    // Initialize progress tracking
    await metadata.set("progress", 0);
    await metadata.set("status", "starting");
    await metadata.set("fromSheet", fromSheet);
    await metadata.set("toSheet", toSheet);

    const WORKBOOK_ID = getWorkbookId();
    if (!WORKBOOK_ID) {
      throw new Error("EXCEL_WORKBOOK_ID environment variable is not set");
    }

    let sessionId: string | null = null;

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
            success: false,
            roNumber: null,
            fromSheet,
            toSheet,
            fromRow: null,
            toRow: null,
            error: error.message,
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
      // PHASE 2: Fetch RO from Database (20%)
      // ==========================================
      await metadata.set("status", "fetching");
      logger.info("Phase 2: Fetching repair order from database");

      const [repairOrder] = await db
        .select()
        .from(active)
        .where(eq(active.id, roId))
        .limit(1);

      if (!repairOrder) {
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return {
          success: false,
          roNumber: null,
          fromSheet,
          toSheet,
          fromRow: null,
          toRow: null,
          error: `Repair order with ID ${roId} not found`,
        };
      }

      const roNumber = repairOrder.ro;
      await metadata.set("roNumber", roNumber);
      await metadata.set("progress", 20);

      // ==========================================
      // STEP A: Find Row in Source Sheet (40%)
      // ==========================================
      await metadata.set("status", "finding_source_row");
      logger.info("Step A: Finding row in source sheet", { fromSheet, roNumber });

      let fromRowNumber: number | null = null;

      if (roNumber !== null) {
        const existingRows = await findRowsByRO(
          client,
          WORKBOOK_ID,
          fromSheet,
          sessionId,
          [roNumber]
        );
        fromRowNumber = existingRows.get(roNumber) ?? null;
      }

      if (fromRowNumber === null) {
        logger.warn("RO not found in source sheet", { fromSheet, roNumber });
        // Continue anyway - we'll still add to destination
      }

      logger.info("Source row found", { fromSheet, fromRowNumber });
      await metadata.set("fromRow", fromRowNumber);
      await metadata.set("progress", 40);

      // ==========================================
      // STEP B: Add Row to Destination Sheet (70%)
      // ==========================================
      await metadata.set("status", "adding_to_destination");
      logger.info("Step B: Adding row to destination sheet", { toSheet });

      // Get next available row in destination sheet
      const toRowNumber = await getNextAvailableRow(
        client,
        WORKBOOK_ID,
        toSheet,
        sessionId
      );

      // Convert DB row to Excel format
      const values = dbRowToExcelRow(repairOrder);

      // Build and execute the add request
      const addRequest = buildUpdateRowRequest(
        "add-row",
        WORKBOOK_ID,
        toSheet,
        toRowNumber,
        values
      );

      const addResponse = await executeBatch(client, [addRequest], sessionId);
      const addAnalysis = analyzeBatchResponse(addResponse);

      // Handle rate limit
      if (hasRateLimitError(addResponse)) {
        logger.warn("Rate limited by Graph API, triggering retry");
        throw new Error("Rate limited by Microsoft Graph API");
      }

      // Check if add succeeded
      if (addAnalysis.failed > 0) {
        const errorMsg = `Failed to add row to ${toSheet}: ${addAnalysis.errors.join(", ")}`;
        logger.error(errorMsg);
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return {
          success: false,
          roNumber,
          fromSheet,
          toSheet,
          fromRow: fromRowNumber,
          toRow: null,
          error: errorMsg,
        };
      }

      logger.info("Successfully added row to destination", { toSheet, toRowNumber });
      await metadata.set("toRow", toRowNumber);
      await metadata.set("progress", 70);

      // ==========================================
      // STEP C: Delete Row from Source Sheet (90%)
      // Only execute if Step B succeeded AND we found a source row
      // ==========================================
      if (fromRowNumber !== null) {
        await metadata.set("status", "deleting_from_source");
        logger.info("Step C: Deleting row from source sheet", { fromSheet, fromRowNumber });

        const deleteRequest = buildDeleteRowRequest(
          "delete-row",
          WORKBOOK_ID,
          fromSheet,
          fromRowNumber
        );

        const deleteResponse = await executeBatch(client, [deleteRequest], sessionId);
        const deleteAnalysis = analyzeBatchResponse(deleteResponse);

        // Handle rate limit
        if (hasRateLimitError(deleteResponse)) {
          logger.warn("Rate limited during delete, triggering retry");
          throw new Error("Rate limited by Microsoft Graph API");
        }

        // Log delete errors but don't fail the whole operation
        // The row was already added to destination, so partial success is acceptable
        if (deleteAnalysis.failed > 0) {
          logger.error("Failed to delete source row (data already copied)", {
            errors: deleteAnalysis.errors,
          });
        } else {
          logger.info("Successfully deleted row from source", { fromSheet, fromRowNumber });
        }
      } else {
        logger.info("Skipping delete - no source row found");
      }

      await metadata.set("progress", 90);

      // ==========================================
      // PHASE 4: Cleanup (100%)
      // ==========================================
      await metadata.set("status", "finishing");
      logger.info("Closing Excel session");

      await closeExcelSession(client, WORKBOOK_ID, sessionId);
      sessionId = null;

      await metadata.set("status", "completed");
      await metadata.set("progress", 100);

      logger.info("Move completed successfully", {
        roNumber,
        fromSheet,
        toSheet,
        fromRow: fromRowNumber,
        toRow: toRowNumber,
      });

      return {
        success: true,
        roNumber,
        fromSheet,
        toSheet,
        fromRow: fromRowNumber,
        toRow: toRowNumber,
      };
    } catch (error) {
      // Attempt to close session on error
      if (sessionId) {
        try {
          const client = await getGraphClient(userId);
          await closeExcelSession(client, getWorkbookId()!, sessionId);
          logger.info("Session closed after error");
        } catch (closeError) {
          logger.error("Failed to close session after error", { closeError });
        }
      }

      // Re-throw for Trigger.dev retry
      throw error;
    }
  },
});
