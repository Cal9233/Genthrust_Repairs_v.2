import type { RepairOrderExcelRow } from "../types/graph";
import type { active, net, paid, returns } from "../schema";
import { parseDate, formatDateUS, formatDateISO } from "../date-utils";

// Infer the row types from all repair order tables
type Active = typeof active.$inferSelect;
type Net = typeof net.$inferSelect;
type Paid = typeof paid.$inferSelect;
type Returns = typeof returns.$inferSelect;

// Table name type for multi-sheet import
export type SheetTableName = "Active" | "Net" | "Paid" | "Returns";

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
 * Table-specific insert types to handle schema differences:
 * - active: finalCost: double, dateMade: varchar
 * - net: finalCost: double, dateMade: datetime
 * - paid: finalCost: varchar, dateMade: datetime
 * - returns: finalCost: varchar, dateMade: varchar
 */
export type DbInsertRowActive = Omit<Active, "id" | "createdAt">;
export type DbInsertRowNet = Omit<Net, "id" | "createdAt">;
export type DbInsertRowPaid = Omit<Paid, "id" | "createdAt">;
export type DbInsertRowReturns = Omit<Returns, "id" | "createdAt">;

// Union type for any table's insert row
export type AnyDbInsertRow = DbInsertRowActive | DbInsertRowNet | DbInsertRowPaid | DbInsertRowReturns;

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
 * Parse a date value to US format string (mm/dd/yy) for varchar columns
 * Uses centralized date-utils for parsing and formatting
 *
 * @param value - String, number (Excel serial), Date, or null/undefined
 * @returns Date as US format string (mm/dd/yy) or null if invalid
 */
function parseDateToUS(value: unknown): string | null {
  const date = parseDate(value as string | number | Date | null | undefined);
  return formatDateUS(date);
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
    dateMade: parseDateToUS(values[1]),
    shopName: parseString(values[2]),
    part: parseString(values[3]),
    serial: parseString(values[4]),
    partDescription: parseString(values[5]),
    reqWork: parseString(values[6]),
    dateDroppedOff: parseDateToUS(values[7]),
    estimatedCost: parseCurrency(values[EST_COST_INDEX]),
    finalCost: parseCurrency(values[FINAL_COST_INDEX]),
    terms: parseString(values[10]),
    shopRef: parseString(values[11]),
    estimatedDeliveryDate: parseDateToUS(values[12]),
    curentStatus: cleanStatus(values[13]),
    curentStatusDate: parseDateToUS(values[14]),
    genthrustStatus: cleanStatus(values[15]),
    shopStatus: cleanStatus(values[16]),
    trackingNumberPickingUp: parseString(values[17]),
    notes: parseString(values[18]),
    lastDateUpdated: parseDateToUS(values[19]),
    nextDateToUpdate: parseDateToUS(values[20]),
    // ERP fields - null when importing from Excel (not synced from ERP)
    erpPoId: null,
    erpLastSyncAt: null,
    erpSyncStatus: "LOCAL_ONLY",
  };

  return dbRow;
}

/**
 * Convert an Excel row array to a table-specific database insert row
 * Handles schema differences between tables:
 * - active: finalCost: double, dateMade: varchar (mm/dd/yy)
 * - net: finalCost: double, dateMade: datetime (ISO string)
 * - paid: finalCost: varchar, dateMade: datetime (ISO string)
 * - returns: finalCost: varchar, dateMade: varchar (mm/dd/yy)
 *
 * @param values - Array of values from Excel (columns A-U)
 * @param tableName - Target table name ("Active", "Net", "Paid", "Returns")
 * @returns Table-specific database-ready object or null if invalid
 */
export function excelRowToDbRowForTable(
  values: (string | number | boolean | null | undefined)[],
  tableName: SheetTableName
): AnyDbInsertRow | null {
  // Column indices (0-based)
  const RO_INDEX = 0;
  const DATE_MADE_INDEX = 1;
  const FINAL_COST_INDEX = 9;

  // Parse RO number - required field
  const ro = parseNumber(values[RO_INDEX]);
  if (ro === null) {
    return null;
  }

  // Parse finalCost based on table type
  // paid & returns use varchar, active & net use double
  const rawFinalCost = values[FINAL_COST_INDEX];
  let finalCost: number | string | null;
  if (tableName === "Paid" || tableName === "Returns") {
    // Convert to string for varchar columns
    finalCost = rawFinalCost !== null && rawFinalCost !== undefined && rawFinalCost !== ""
      ? String(rawFinalCost)
      : null;
  } else {
    // Parse as number for double columns
    finalCost = parseCurrency(rawFinalCost);
  }

  // Parse dateMade based on table type
  // net & paid use datetime (needs ISO format), active & returns use varchar (mm/dd/yy)
  const rawDateMade = values[DATE_MADE_INDEX];
  let dateMade: string | null;
  if (tableName === "Net" || tableName === "Paid") {
    // For datetime columns, we need ISO format or null
    const date = parseDate(
      typeof rawDateMade === "boolean" ? null : rawDateMade
    );
    dateMade = formatDateISO(date);
  } else {
    // For varchar columns, use mm/dd/yy format
    dateMade = parseDateToUS(rawDateMade);
  }

  // Build the database row object
  const dbRow = {
    ro,
    dateMade,
    shopName: parseString(values[2]),
    part: parseString(values[3]),
    serial: parseString(values[4]),
    partDescription: parseString(values[5]),
    reqWork: parseString(values[6]),
    dateDroppedOff: parseDateToUS(values[7]),
    estimatedCost: parseCurrency(values[8]),
    finalCost,
    terms: parseString(values[10]),
    shopRef: parseString(values[11]),
    estimatedDeliveryDate: parseDateToUS(values[12]),
    curentStatus: cleanStatus(values[13]),
    curentStatusDate: parseDateToUS(values[14]),
    genthrustStatus: cleanStatus(values[15]),
    shopStatus: cleanStatus(values[16]),
    trackingNumberPickingUp: parseString(values[17]),
    notes: parseString(values[18]),
    lastDateUpdated: parseDateToUS(values[19]),
    nextDateToUpdate: parseDateToUS(values[20]),
  };

  return dbRow as AnyDbInsertRow;
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
