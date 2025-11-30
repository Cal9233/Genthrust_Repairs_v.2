import type { RepairOrderExcelRow } from "../types/graph";
import type { active } from "../schema";

// Infer the row type from the active table
type Active = typeof active.$inferSelect;

/**
 * Excel column mapping for the active table (repair orders)
 *
 * Maps to columns A-U in the Excel worksheet, mirroring the active table structure.
 */
export const EXCEL_COLUMNS = [
  "ro",
  "dateMade",
  "shopName",
  "part",
  "serial",
  "partDescription",
  "reqWork",
  "dateDroppedOff",
  "estimatedCost",
  "finalCost",
  "terms",
  "shopRef",
  "estimatedDeliveryDate",
  "curentStatus",
  "curentStatusDate",
  "genthrustStatus",
  "shopStatus",
  "trackingNumberPickingUp",
  "notes",
  "lastDateUpdated",
  "nextDateToUpdate",
] as const;

export type ExcelColumnKey = (typeof EXCEL_COLUMNS)[number];

/**
 * Convert a database row to an Excel row array
 */
export function dbRowToExcelRow(
  row: Active
): (string | number | null)[] {
  return EXCEL_COLUMNS.map((col) => {
    const value = row[col as keyof Active];
    // Convert undefined to null for Excel compatibility
    return value === undefined ? null : (value as string | number | null);
  });
}

/**
 * Convert a RepairOrderExcelRow to an Excel row array
 */
export function excelRowToArray(
  row: RepairOrderExcelRow
): (string | number | null)[] {
  return EXCEL_COLUMNS.map((col) => row[col] ?? null);
}

/**
 * Get the Excel column letter for a given index (0-based)
 * Supports multi-letter columns (A, B, ..., Z, AA, AB, ...)
 */
export function getColumnLetter(index: number): string {
  let letter = "";
  let idx = index;
  while (idx >= 0) {
    letter = String.fromCharCode((idx % 26) + 65) + letter;
    idx = Math.floor(idx / 26) - 1;
  }
  return letter;
}

/**
 * Get the Excel range address for a single row
 * @param worksheetName - Name of the worksheet
 * @param rowNumber - 1-based row number
 * @returns Range address like "Active!A5:U5"
 */
export function getRowRangeAddress(
  worksheetName: string,
  rowNumber: number
): string {
  const lastCol = getColumnLetter(EXCEL_COLUMNS.length - 1); // "U"
  return `${worksheetName}!A${rowNumber}:${lastCol}${rowNumber}`;
}

/**
 * Get the Excel range address for multiple rows
 * @param worksheetName - Name of the worksheet
 * @param startRow - 1-based start row number
 * @param endRow - 1-based end row number
 * @returns Range address like "Active!A5:U10"
 */
export function getRowsRangeAddress(
  worksheetName: string,
  startRow: number,
  endRow: number
): string {
  const lastCol = getColumnLetter(EXCEL_COLUMNS.length - 1);
  return `${worksheetName}!A${startRow}:${lastCol}${endRow}`;
}

/**
 * Get the column header row values
 */
export function getColumnHeaders(): string[] {
  // Convert camelCase to SCREAMING_SNAKE_CASE for Excel headers
  return EXCEL_COLUMNS.map((col) =>
    col.replace(/([A-Z])/g, "_$1").toUpperCase()
  );
}
