import { Client } from "@microsoft/microsoft-graph-client";
import type { ExcelRange } from "../types/graph";
import { getWorksheetPath } from "../graph";

/**
 * Find multiple rows by RO numbers (batch lookup)
 *
 * Reads the entire RO column and returns a map of RO number to row number.
 * This enables "search by RO number" to find existing rows for updates.
 *
 * @param client - Graph client
 * @param workbookId - Workbook item ID
 * @param worksheetName - Worksheet name
 * @param sessionId - Workbook session ID
 * @param roNumbers - Array of RO numbers to find
 * @returns Map of RO number to Excel row number (1-based)
 */
export async function findRowsByRO(
  client: Client,
  workbookId: string,
  worksheetName: string,
  sessionId: string,
  roNumbers: number[]
): Promise<Map<number, number>> {
  const roSet = new Set(roNumbers);
  const result = new Map<number, number>();

  // Read the entire RO column (A2:A10000, skipping header row)
  // Adjust range as needed for your data size
  const worksheetPath = getWorksheetPath(workbookId, worksheetName);
  const range = (await client
    .api(`${worksheetPath}/range(address='A2:A10000')`)
    .header("workbook-session-id", sessionId)
    .get()) as ExcelRange;

  const values = range.values;

  for (let i = 0; i < values.length; i++) {
    const ro = values[i][0];
    if (ro !== null && ro !== "" && roSet.has(Number(ro))) {
      // +2 for: 1-based indexing + header row offset
      result.set(Number(ro), i + 2);
    }
  }

  return result;
}

/**
 * Get the next available row number for new entries
 *
 * Uses the usedRange endpoint to find the last row with data.
 *
 * @param client - Graph client
 * @param workbookId - Workbook item ID
 * @param worksheetName - Worksheet name
 * @param sessionId - Workbook session ID
 * @returns Next available row number (1-based)
 */
export async function getNextAvailableRow(
  client: Client,
  workbookId: string,
  worksheetName: string,
  sessionId: string
): Promise<number> {
  const worksheetPath = getWorksheetPath(workbookId, worksheetName);
  const usedRange = (await client
    .api(`${worksheetPath}/usedRange`)
    .header("workbook-session-id", sessionId)
    .select("rowCount")
    .get()) as { rowCount?: number };

  // rowCount includes header, so next row is rowCount + 1
  // If no data, rowCount might be 0 or 1 (just header)
  return (usedRange.rowCount ?? 1) + 1;
}

/**
 * Check if a worksheet exists
 *
 * @param client - Graph client
 * @param workbookId - Workbook item ID
 * @param worksheetName - Worksheet name
 * @param sessionId - Workbook session ID
 * @returns True if worksheet exists
 */
export async function worksheetExists(
  client: Client,
  workbookId: string,
  worksheetName: string,
  sessionId: string
): Promise<boolean> {
  try {
    const worksheetPath = getWorksheetPath(workbookId, worksheetName);
    await client
      .api(worksheetPath)
      .header("workbook-session-id", sessionId)
      .get();
    return true;
  } catch {
    return false;
  }
}
