import { task, metadata, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "../lib/db";
import { active, net, paid, returns, notificationQueue } from "../lib/schema";
import { eq, notInArray, isNull, inArray, and, isNotNull } from "drizzle-orm";
import {
  getGraphClient,
  createExcelSession,
  closeExcelSession,
} from "../lib/graph";
import {
  excelRowToDbRowForTable,
  type SheetTableName,
  type AnyDbInsertRow
} from "../lib/graph/excel-mapping";
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

// Sheet names that map to their respective tables
const TARGET_SHEETS: SheetTableName[] = ["Active", "Net", "Paid", "Returns"];

// Map sheet names to their database tables
const SHEET_TO_TABLE = {
  Active: active,
  Net: net,
  Paid: paid,
  Returns: returns,
} as const;

/**
 * import-from-excel Task
 *
 * Reads data from ALL Excel sheets (Active, Net, Paid, Returns) and imports
 * into their RESPECTIVE MySQL tables.
 *
 * Flow: Excel Sheet → Corresponding MySQL Table
 * - Active sheet → active table
 * - Net sheet → net table
 * - Paid sheet → paid table
 * - Returns sheet → returns table
 *
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

    logger.info("Starting Multi-Sheet Excel import to separate tables...", {
      userId,
      sheets: TARGET_SHEETS
    });

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

    // Group rows by sheet for table-specific processing
    const rowsBySheet: Record<SheetTableName, { rowNumber: number; data: AnyDbInsertRow }[]> = {
      Active: [],
      Net: [],
      Paid: [],
      Returns: [],
    };

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

      // Create Excel session
      const session = await createExcelSession(client, WORKBOOK_ID);
      sessionId = session.id;
      logger.info("Excel session created", { sessionId });

      await metadata.set("progress", 10);

      // ==========================================
      // PHASE 2: Read Excel (Loop through Sheets) (10-30%)
      // ==========================================
      await metadata.set("status", "reading");
      logger.info("Phase 2: Reading all rows from all Excel sheets");

      for (const sheetName of TARGET_SHEETS) {
        logger.info(`Reading sheet: ${sheetName}`);

        try {
          const excelRows = await readAllRows(
            client,
            WORKBOOK_ID,
            sheetName,
            sessionId
          );

          logger.info(`Read ${excelRows.length} rows from ${sheetName}`);

          for (const row of excelRows) {
            // Use table-specific conversion to handle schema differences
            const dbRow = excelRowToDbRowForTable(row.values, sheetName);
            if (dbRow === null) {
              skippedCount++;
              logger.debug("Skipped row (no RO)", { sheetName, rowNumber: row.rowNumber });
            } else {
              rowsBySheet[sheetName].push({
                rowNumber: row.rowNumber,
                data: dbRow,
              });
            }
          }
        } catch (e) {
          logger.warn(`Failed to read sheet ${sheetName}`, { error: e instanceof Error ? e.message : e });
          errors.push(`Failed to read sheet ${sheetName}`);
        }
      }

      const totalRows = Object.values(rowsBySheet).reduce((sum, rows) => sum + rows.length, 0);
      logger.info("Read all Excel rows", {
        totalRows,
        skipped: skippedCount,
        bySheet: {
          Active: rowsBySheet.Active.length,
          Net: rowsBySheet.Net.length,
          Paid: rowsBySheet.Paid.length,
          Returns: rowsBySheet.Returns.length,
        }
      });

      await metadata.set("totalItems", totalRows);
      await metadata.set("progress", 30);

      if (totalRows === 0) {
        logger.warn("No data rows found in any sheets");
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return {
          totalRows: 0,
          insertedCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          skippedCount,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        };
      }

      // ==========================================
      // PHASE 3 & 4: Process Each Table Separately (30-90%)
      // ==========================================
      await metadata.set("status", "importing");
      logger.info("Phase 3 & 4: Processing each table separately");

      let processedItems = 0;

      for (const sheetName of TARGET_SHEETS) {
        const rows = rowsBySheet[sheetName];
        const table = SHEET_TO_TABLE[sheetName];

        if (rows.length === 0) {
          logger.info(`No rows for ${sheetName} table, skipping`);
          continue;
        }

        logger.info(`Processing ${rows.length} rows for ${sheetName} table`);

        // Build RO lookup for THIS specific table
        const existingROs = await db
          .select({ id: table.id, ro: table.ro })
          .from(table);

        const roToIdMap = new Map<number, number>();
        for (const row of existingROs) {
          if (row.ro !== null) {
            roToIdMap.set(row.ro, row.id);
          }
        }

        logger.info(`Built RO lookup for ${sheetName}`, { existingCount: roToIdMap.size });

        // Collect RO numbers for this sheet (for orphan deletion)
        const sheetRONumbers = new Set<number>();

        // Upsert rows to THIS table
        for (const { rowNumber, data } of rows) {
          if (data.ro !== null) {
            sheetRONumbers.add(data.ro);
          }

          try {
            const existingId = data.ro !== null ? roToIdMap.get(data.ro) : null;

            if (existingId !== null && existingId !== undefined) {
              // UPDATE existing row (Excel wins)
              await db
                .update(table)
                .set(data as Record<string, unknown>)
                .where(eq(table.id, existingId));
              updatedCount++;
            } else {
              // INSERT new row
              await db.insert(table).values(data as Record<string, unknown>);
              insertedCount++;
            }
          } catch (error) {
            const errorMsg = `[${sheetName}] Row ${rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(errorMsg);
            logger.error("Failed to upsert row", { sheetName, rowNumber, error });
          }

          processedItems++;
          // Update progress every 20 rows
          if (processedItems % 20 === 0) {
            const progress = Math.round(30 + (processedItems / totalRows) * 55);
            await metadata.set("progress", Math.min(progress, 85));
            await metadata.set("processedItems", processedItems);
          }
        }

        // Delete orphaned rows from THIS table only
        if (sheetRONumbers.size > 0) {
          // Filter out NULL RO values and use NOT IN for non-NULL values
          // This prevents SQL errors with NULL comparisons in NOT IN clauses
          const roArray = Array.from(sheetRONumbers);
          const orphanedRows = await db
            .select({ id: table.id, ro: table.ro })
            .from(table)
            .where(
              and(
                isNotNull(table.ro),
                notInArray(table.ro, roArray)
              )
            );

          if (orphanedRows.length > 0) {
            logger.info(`Found ${orphanedRows.length} orphaned rows in ${sheetName} table`, {
              roNumbers: orphanedRows.map((r) => r.ro),
            });

            for (const row of orphanedRows) {
              await db.delete(table).where(eq(table.id, row.id));
              deletedCount++;
            }

            logger.info(`Deleted orphaned rows from ${sheetName}`, { count: orphanedRows.length });
          } else {
            logger.info(`No orphaned rows in ${sheetName} table`);
          }
        }
      }

      await metadata.set("progress", 90);

      // ==========================================
      // PHASE 4.5: Clean Orphaned Notification Queue
      // ==========================================
      await metadata.set("status", "cleaning");
      logger.info("Phase 4.5: Cleaning orphaned notification queue entries");

      // Notifications only reference the active table
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
        bySheet: {
          Active: rowsBySheet.Active.length,
          Net: rowsBySheet.Net.length,
          Paid: rowsBySheet.Paid.length,
          Returns: rowsBySheet.Returns.length,
        }
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
