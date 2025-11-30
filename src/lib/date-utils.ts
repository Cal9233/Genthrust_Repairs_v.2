/**
 * Shared date utilities for parsing and comparing dates
 */

/**
 * Parse a date string in various formats
 * Handles: MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY, YYYY-MM-DD, ISO 8601, and Excel serial numbers
 */
export function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString || typeof dateString !== "string") return null;

  const trimmed = dateString.trim();
  if (!trimmed) return null;

  // Try MM/DD/YYYY or M/D/YYYY format (slashes)
  const usDateSlashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDateSlashMatch) {
    const [, month, day, year] = usDateSlashMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try MM-DD-YYYY or M-D-YYYY format (dashes, US order)
  const usDateDashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (usDateDashMatch) {
    const [, month, day, year] = usDateDashMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD format (ISO) or full ISO 8601 with time (2025-11-15T05:00:00.000Z)
  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }

  // Try Excel serial number (days since 1899-12-30)
  const serialNumber = Number(trimmed);
  if (!isNaN(serialNumber) && serialNumber > 0 && serialNumber < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serialNumber * 86400000);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Check if a date is overdue (before today)
 */
export function isOverdue(dateString: string | null | undefined): boolean {
  const date = parseDate(dateString);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today;
}
