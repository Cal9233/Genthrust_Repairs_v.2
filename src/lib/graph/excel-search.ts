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
 * Row data returned from readAllRows
 */
export interface ExcelRowData {
  /** 1-based Excel row number */
  rowNumber: number;
  /** Array of cell values (columns A-U) */
  values: (string | number | boolean | null)[];
}

/**
 * Read all data rows from an Excel worksheet
 *
 * Fetches all rows from A2:U{lastRow}, skipping the header row.
 * Returns only non-empty rows (rows with at least one non-null value).
 *
 * @param client - Graph client
 * @param workbookId - Workbook item ID
 * @param worksheetName - Worksheet name (e.g., "Active")
 * @param sessionId - Workbook session ID
 * @returns Array of row data with row numbers and values
 */
export async function readAllRows(
  client: Client,
  workbookId: string,
  worksheetName: string,
  sessionId: string
): Promise<ExcelRowData[]> {
  const worksheetPath = getWorksheetPath(workbookId, worksheetName);

  // First, get the used range to know how many rows to read
  const usedRange = (await client
    .api(`${worksheetPath}/usedRange`)
    .header("workbook-session-id", sessionId)
    .select("rowCount")
    .get()) as { rowCount?: number };

  const lastRow = usedRange.rowCount ?? 1;

  // If only header row or empty, return empty array
  if (lastRow <= 1) {
    return [];
  }

  // Read all data rows (A2:U{lastRow})
  // Column U is the 21st column (index 20)
  const range = (await client
    .api(`${worksheetPath}/range(address='A2:U${lastRow}')`)
    .header("workbook-session-id", sessionId)
    .get()) as ExcelRange;

  const rows: ExcelRowData[] = [];

  for (let i = 0; i < range.values.length; i++) {
    const values = range.values[i];

    // Check if row has any non-null, non-empty values
    const hasData = values.some(
      (v) => v !== null && v !== undefined && v !== ""
    );

    if (hasData) {
      rows.push({
        rowNumber: i + 2, // +2 for 1-based indexing + header row offset
        values: values as (string | number | boolean | null)[],
      });
    }
  }

  return rows;
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
