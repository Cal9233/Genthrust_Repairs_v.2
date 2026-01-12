import { Client } from "@microsoft/microsoft-graph-client";
import { getGraphClient, createExcelSession, closeExcelSession, getWorksheetPath } from "../graph";
import { getNextAvailableRow } from "./excel-search";
import { dbRowToExcelRow, getColumnLetter, EXCEL_COLUMNS } from "./excel-mapping";
import type { active } from "../schema";

/**
 * Add a single repair order to the Excel file immediately after creation
 * 
 * This provides instant write-back to SharePoint for newly created ROs.
 * Uses the Write-Behind pattern: MySQL Write → Immediate Excel Sync
 * 
 * @param userId - User ID for Graph API authentication
 * @param roData - The repair order data from MySQL (active table row)
 * @returns Promise<void> - Throws on failure
 */
export async function addSingleRoToExcel(
  userId: string,
  roData: typeof active.$inferSelect
): Promise<void> {
  // Get workbook/worksheet from environment
  const workbookId = process.env.EXCEL_WORKBOOK_ID;
  const worksheetName = process.env.EXCEL_WORKSHEET_NAME ?? "Active";

  if (!workbookId) {
    throw new Error("EXCEL_WORKBOOK_ID not configured");
  }

  let client: Client | null = null;
  let sessionId: string | null = null;

  try {
    // Step 1: Get authenticated Graph client
    client = await getGraphClient(userId);

    // Step 2: Create Excel session for the operation
    const session = await createExcelSession(client, workbookId);
    sessionId = session.id;

    // Step 3: Get the next available row number
    const nextRow = await getNextAvailableRow(
      client,
      workbookId,
      worksheetName,
      sessionId
    );

    // Step 4: Convert database row to Excel array format
    const excelRowData = dbRowToExcelRow(roData);

    // Step 5: Write the row to Excel using PATCH
    const worksheetPath = getWorksheetPath(workbookId, worksheetName);
    const lastCol = getColumnLetter(EXCEL_COLUMNS.length - 1); // "U"
    const rangeAddress = `A${nextRow}:${lastCol}${nextRow}`;

    await client
      .api(`${worksheetPath}/range(address='${rangeAddress}')`)
      .header("workbook-session-id", sessionId)
      .patch({
        values: [excelRowData], // Must be 2D array
      });

    // Step 6: Close session to persist changes
    await closeExcelSession(client, workbookId, sessionId);
  } catch (error) {
    // Attempt to close session on error
    if (client && sessionId && workbookId) {
      try {
        await closeExcelSession(client, workbookId, sessionId);
      } catch (closeError) {
        console.error("Failed to close Excel session after error:", closeError);
      }
    }

    // Re-throw the error for caller to handle
    throw error;
  }
}
