import { task, metadata, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "../lib/db";
import { active, notificationQueue } from "../lib/schema";
import { eq, notInArray, isNull, inArray } from "drizzle-orm";
import {
  getGraphClient,
  createExcelSession,
  closeExcelSession,
} from "../lib/graph";
import { excelRowToDbRow, type DbInsertRow } from "../lib/graph/excel-mapping";
import { readAllRows } from "../lib/graph/excel-search";
import { UserNotConnectedError } from "../lib/types/graph";

/**
 * Payload schema for import-from-excel task
 */
export const importFromExcelPayloadSchema = z.object({
  userId: z.string(),
});

export type ImportFromExcelPayload = z.infer<typeof importFromExcelPayloadSchema>;

/**
 * Output schema for import-from-excel task
 */
export const importFromExcelOutputSchema = z.object({
  totalRows: z.number(),
  insertedCount: z.number(),
  updatedCount: z.number(),
  deletedCount: z.number(),
  skippedCount: z.number(),
  errorCount: z.number(),
  errors: z.array(z.string()).optional(),
});

export type ImportFromExcelOutput = z.infer<typeof importFromExcelOutputSchema>;

// Environment configuration
const WORKBOOK_ID = process.env.EXCEL_WORKBOOK_ID;
const WORKSHEET_NAME = process.env.EXCEL_WORKSHEET_NAME ?? "Active";

/**
 * import-from-excel Task
 *
 * Reads data from the Excel Active sheet and imports/updates MySQL database.
 * This is the inverse of sync-repair-orders task.
 *
 * Flow: Excel → This Task → MySQL
 * Conflict Resolution: Excel WINS (overwrites MySQL data)
 */
export const importFromExcel = task({
  id: "import-from-excel",
  machine: {
    preset: "small-1x",
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: ImportFromExcelPayload): Promise<ImportFromExcelOutput> => {
    const { userId } = payload;

    logger.info("Starting Excel import...", { userId });

    // Initialize progress tracking
    await metadata.set("progress", 0);
    await metadata.set("status", "starting");

    // Validate configuration
    if (!WORKBOOK_ID) {
      throw new Error("EXCEL_WORKBOOK_ID environment variable is not set");
    }

    let sessionId: string | null = null;
    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;
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
            totalRows: 0,
            insertedCount: 0,
            updatedCount: 0,
            deletedCount: 0,
            skippedCount: 0,
            errorCount: 1,
            errors: [error.message],
          };
        }
        throw error;
      }

      // Create Excel session (read-only is sufficient for import)
      const session = await createExcelSession(client, WORKBOOK_ID);
      sessionId = session.id;
      logger.info("Excel session created", { sessionId });

      await metadata.set("progress", 10);

      // ==========================================
      // PHASE 2: Read Excel (30%)
      // ==========================================
      await metadata.set("status", "reading");
      logger.info("Phase 2: Reading all rows from Excel");

      const excelRows = await readAllRows(
        client,
        WORKBOOK_ID,
        WORKSHEET_NAME,
        sessionId
      );

      const totalRows = excelRows.length;
      logger.info("Read Excel rows", { totalRows });

      await metadata.set("totalItems", totalRows);
      await metadata.set("progress", 30);

      if (totalRows === 0) {
        logger.warn("No data rows found in Excel");
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return {
          totalRows: 0,
          insertedCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          skippedCount: 0,
          errorCount: 0,
        };
      }

      // ==========================================
      // PHASE 3: Parse and Build Lookup (40%)
      // ==========================================
      await metadata.set("status", "parsing");
      logger.info("Phase 3: Parsing Excel data and building lookup");

      // Parse Excel rows to DB format
      const parsedRows: { rowNumber: number; data: DbInsertRow }[] = [];
      for (const row of excelRows) {
        const dbRow = excelRowToDbRow(row.values);
        if (dbRow === null) {
          skippedCount++;
          logger.debug("Skipped row (no RO)", { rowNumber: row.rowNumber });
        } else {
          parsedRows.push({ rowNumber: row.rowNumber, data: dbRow });
        }
      }

      logger.info("Parsed rows", {
        parsed: parsedRows.length,
        skipped: skippedCount,
      });

      // Collect all RO numbers from Excel for full sync deletion
      const excelRONumbers = new Set<number>();
      for (const { data } of parsedRows) {
        if (data.ro !== null) {
          excelRONumbers.add(data.ro);
        }
      }
      logger.info("Excel RO numbers collected", { count: excelRONumbers.size });

      // Build lookup map: RO number → MySQL id
      const existingROs = await db
        .select({ id: active.id, ro: active.ro })
        .from(active);

      const roToIdMap = new Map<number, number>();
      for (const row of existingROs) {
        if (row.ro !== null) {
          roToIdMap.set(row.ro, row.id);
        }
      }

      logger.info("Built RO lookup", { existingCount: roToIdMap.size });

      await metadata.set("progress", 40);

      // ==========================================
      // PHASE 4: Upsert to MySQL (40-90%)
      // ==========================================
      await metadata.set("status", "importing");
      logger.info("Phase 4: Upserting rows to MySQL");

      for (let i = 0; i < parsedRows.length; i++) {
        const { rowNumber, data } = parsedRows[i];

        try {
          const existingId = data.ro !== null ? roToIdMap.get(data.ro) : null;

          if (existingId !== null && existingId !== undefined) {
            // UPDATE existing row (Excel wins)
            await db
              .update(active)
              .set(data)
              .where(eq(active.id, existingId));
            updatedCount++;
          } else {
            // INSERT new row
            await db.insert(active).values(data);
            insertedCount++;
          }
        } catch (error) {
          const errorMsg = `Row ${rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`;
          errors.push(errorMsg);
          logger.error("Failed to upsert row", { rowNumber, error });
        }

        // Update progress every 10 rows
        if ((i + 1) % 10 === 0 || i === parsedRows.length - 1) {
          const progress = Math.round(40 + ((i + 1) / parsedRows.length) * 50);
          await metadata.set("progress", Math.min(progress, 90));
          await metadata.set("processedItems", i + 1);
        }
      }

      // ==========================================
      // PHASE 4.5: Delete Orphaned MySQL Rows
      // ==========================================
      await metadata.set("status", "cleaning");
      logger.info("Phase 4.5: Deleting MySQL rows not in Excel");

      // Safety guard: Skip deletion if Excel returned no RO numbers
      if (excelRONumbers.size === 0) {
        logger.warn("No RO numbers found in Excel - skipping deletion to prevent data loss");
      } else {
        // Find MySQL rows whose RO is NOT in Excel
        const orphanedRows = await db
          .select({ id: active.id, ro: active.ro })
          .from(active)
          .where(notInArray(active.ro, Array.from(excelRONumbers)));

        if (orphanedRows.length > 0) {
          logger.info("Found orphaned rows to delete", {
            count: orphanedRows.length,
            roNumbers: orphanedRows.map((r) => r.ro),
          });

          // Delete orphaned rows
          for (const row of orphanedRows) {
            await db.delete(active).where(eq(active.id, row.id));
            deletedCount++;
          }

          logger.info("Deleted orphaned rows", { deletedCount });
        } else {
          logger.info("No orphaned rows found - MySQL and Excel are in sync");
        }
      }

      await metadata.set("progress", 92);

      // ==========================================
      // PHASE 4.6: Clean Orphaned Notification Queue
      // ==========================================
      logger.info("Phase 4.6: Cleaning orphaned notification queue entries");

      // Find notifications whose ROs no longer exist in the active table
      const orphanedNotifications = await db
        .select({ id: notificationQueue.id })
        .from(notificationQueue)
        .leftJoin(active, eq(notificationQueue.repairOrderId, active.id))
        .where(isNull(active.id));

      if (orphanedNotifications.length > 0) {
        const orphanedIds = orphanedNotifications.map((n) => n.id);

        await db
          .delete(notificationQueue)
          .where(inArray(notificationQueue.id, orphanedIds));

        logger.info("Cleaned orphaned notifications", {
          count: orphanedNotifications.length,
        });
      } else {
        logger.info("No orphaned notifications found");
      }

      await metadata.set("progress", 94);

      // ==========================================
      // PHASE 5: Cleanup (95-100%)
      // ==========================================
      await metadata.set("status", "finishing");
      await metadata.set("progress", 95);
      logger.info("Phase 5: Closing Excel session");

      await closeExcelSession(client, WORKBOOK_ID, sessionId);
      sessionId = null;

      await metadata.set("status", "completed");
      await metadata.set("progress", 100);

      logger.info("Import completed", {
        totalRows,
        insertedCount,
        updatedCount,
        deletedCount,
        skippedCount,
        errorCount: errors.length,
      });

      return {
        totalRows,
        insertedCount,
        updatedCount,
        deletedCount,
        skippedCount,
        errorCount: errors.length,
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

      // Re-throw for Trigger.dev retry
      throw error;
    }
  },
});
