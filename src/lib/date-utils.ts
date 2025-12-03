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

/**
 * Calculate days since a date (for time-aware summaries)
 * Returns positive number for past dates, null if date is invalid
 */
export function daysSince(dateString: string | null | undefined): number | null {
  const date = parseDate(dateString);
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - date.getTime();
  return Math.floor(diffMs / 86400000);
}

/**
 * Calculate days until a date (for ETA checks)
 * Returns positive for future dates, negative for past dates, null if invalid
 */
export function daysUntil(dateString: string | null | undefined): number | null {
  const date = parseDate(dateString);
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffMs = date.getTime() - today.getTime();
  return Math.floor(diffMs / 86400000);
}

/**
 * Format date as human-readable relative or absolute
 * Examples: "today", "yesterday", "tomorrow", "15 Jan", "Dec 3, 2025"
 */
export function formatRelativeDate(dateString: string | null | undefined): string {
  const date = parseDate(dateString);
  if (!date) return "unknown date";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return "today";
  if (diffDays === -1) return "yesterday";
  if (diffDays === 1) return "tomorrow";

  // Format as "15 Jan" for dates within current year
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === today.getFullYear()
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}
