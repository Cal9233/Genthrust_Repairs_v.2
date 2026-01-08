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
 * Type for a database insert row (without auto-generated fields)
 */
export type DbInsertRow = Omit<Active, "id" | "createdAt">;

/**
 * Parse a currency string to a number
 * Handles formats like "$1,500", "1500", "1,500.50"
 */
function parseCurrency(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$,]/g, "").trim();
    if (cleaned === "") return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Parse a value to a string or null
 */
function parseString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * Clean and normalize a status string
 * - Removes trailing symbols (>, <, -, =, *, etc.)
 * - Trims whitespace
 * - Normalizes capitalization (e.g., "APPROVED >>>>" → "Approved")
 */
function cleanStatus(value: unknown): string | null {
  const str = parseString(value);
  if (str === null) return null;

  // Remove common trailing/leading symbols and normalize
  let cleaned = str
    .replace(/[><=\-*#@!~^&|]+$/g, "") // Remove trailing symbols
    .replace(/^[><=\-*#@!~^&|]+/g, "") // Remove leading symbols
    .trim();

  if (cleaned === "") return null;

  // Normalize capitalization: "APPROVED" → "Approved", "in progress" → "In Progress"
  cleaned = cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return cleaned;
}

/**
 * Parse a value to a number (for RO field)
 */
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.trim());
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Parse a date value to a normalized string format
 * Handles both:
 * - ISO format: "2025-12-03T05:00:00.000Z"
 * - US format: "mm/dd/yy" or "m/d/yy" (e.g., "12/03/25", "1/5/25")
 * - US format with 4-digit year: "mm/dd/yyyy"
 *
 * Returns date as ISO string (YYYY-MM-DD) or null if invalid
 */
function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  // Handle Excel serial date numbers
  if (typeof value === "number") {
    // Excel serial date: days since 1900-01-01 (with Excel's leap year bug)
    // Excel incorrectly treats 1900 as a leap year, so we adjust
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  // Try ISO format first (2025-12-03T05:00:00.000Z or 2025-12-03)
  if (trimmed.includes("-") && !trimmed.includes("/")) {
    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString().split("T")[0];
    }
  }

  // Try US format (mm/dd/yy or mm/dd/yyyy)
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    const day = parseInt(usMatch[2], 10);
    let year = parseInt(usMatch[3], 10);

    // Convert 2-digit year to 4-digit
    if (year < 100) {
      // Assume 00-49 = 2000-2049, 50-99 = 1950-1999
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    // Validate month and day ranges
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      // Verify the date is valid (handles invalid dates like 2/30)
      if (date.getMonth() === month - 1 && date.getDate() === day) {
        return date.toISOString().split("T")[0];
      }
    }
  }

  // Return original string if we can't parse it (for display purposes)
  return trimmed;
}

/**
 * Convert an Excel row array to a database insert row
 *
 * @param values - Array of values from Excel (columns A-U)
 * @returns Database-ready object (without id and createdAt)
 * @returns null if the row is invalid (missing RO number)
 */
export function excelRowToDbRow(
  values: (string | number | boolean | null | undefined)[]
): DbInsertRow | null {
  // Column indices (0-based)
  const RO_INDEX = 0;          // A - ro (double)
  const EST_COST_INDEX = 8;    // I - estimatedCost (double)
  const FINAL_COST_INDEX = 9;  // J - finalCost (double)

  // Parse RO number - required field
  const ro = parseNumber(values[RO_INDEX]);
  if (ro === null) {
    return null; // Skip rows without RO number
  }

  // Build the database row object
  const dbRow: DbInsertRow = {
    ro,
    dateMade: parseDate(values[1]),
    shopName: parseString(values[2]),
    part: parseString(values[3]),
    serial: parseString(values[4]),
    partDescription: parseString(values[5]),
    reqWork: parseString(values[6]),
    dateDroppedOff: parseDate(values[7]),
    estimatedCost: parseCurrency(values[EST_COST_INDEX]),
    finalCost: parseCurrency(values[FINAL_COST_INDEX]),
    terms: parseString(values[10]),
    shopRef: parseString(values[11]),
    estimatedDeliveryDate: parseDate(values[12]),
    curentStatus: cleanStatus(values[13]),
    curentStatusDate: parseDate(values[14]),
    genthrustStatus: cleanStatus(values[15]),
    shopStatus: cleanStatus(values[16]),
    trackingNumberPickingUp: parseString(values[17]),
    notes: parseString(values[18]),
    lastDateUpdated: parseDate(values[19]),
    nextDateToUpdate: parseDate(values[20]),
  };

  return dbRow;
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
