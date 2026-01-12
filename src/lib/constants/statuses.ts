/**
 * Centralized status constants and matching logic
 * 
 * This file consolidates status arrays and matching logic that was previously
 * duplicated across dashboard.ts and ro-lifecycle-flow.ts
 */

/**
 * Statuses that belong to other sheets (not Active dashboard)
 * These are filtered out from the main Active view
 */
export const ARCHIVED_STATUSES = [
  "COMPLETE",
  "NET",
  "PAID",
  "RETURNS",
  "BER",
  "RAI",
  "CANCELLED",
] as const;

/**
 * Status groups for dashboard statistics
 * Each group contains all variations of a status that should be counted together
 */
export const STATUS_GROUPS = {
  WAITING_QUOTE: ["WAITING QUOTE", "WAITING FOR QUOTE", "AWAITING QUOTE", "PENDING"],
  IN_WORK: ["IN WORK", "IN PROGRESS", "WORKING"],
  SHIPPED: ["SHIPPED", "IN TRANSIT", "CURRENTLY BEING SHIPPED", "SHIPPING"],
  APPROVED: ["APPROVED"], // Uses startsWith matching
} as const;

/**
 * Statuses that trigger the follow-up flow in ro-lifecycle-flow.ts
 * These statuses have automation configured (wait periods, email templates, etc.)
 */
export const TRACKED_STATUSES = [
  "WAITING QUOTE",
  "APPROVED",
  "IN WORK",
  "IN PROGRESS",
  "SHIPPED",
  "IN TRANSIT",
  "RECEIVED", // Special case for NET payment reminders
] as const;

/**
 * Check if a status matches a status group
 * Uses case-insensitive prefix matching (handles "APPROVED >>>>" variants)
 * 
 * @param status - The status string to check
 * @param group - The status group key to match against
 * @returns true if the status matches any variant in the group
 */
export function matchesStatusGroup(
  status: string | null | undefined,
  group: keyof typeof STATUS_GROUPS
): boolean {
  if (!status) return false;
  
  const normalizedStatus = status.toUpperCase().trim();
  const groupStatuses = STATUS_GROUPS[group];
  
  // Special handling for APPROVED - uses startsWith to handle "APPROVED >>>>" variants
  if (group === "APPROVED") {
    return groupStatuses.some((s) => normalizedStatus.startsWith(s));
  }
  
  // For other groups, check if normalized status matches any variant
  return groupStatuses.some((s) => normalizedStatus === s);
}

/**
 * Check if a status is in the WAITING_QUOTE group
 */
export function isWaitingQuote(status: string | null | undefined): boolean {
  return matchesStatusGroup(status, "WAITING_QUOTE");
}

/**
 * Check if a status is in the IN_WORK group
 */
export function isInWork(status: string | null | undefined): boolean {
  return matchesStatusGroup(status, "IN_WORK");
}

/**
 * Check if a status is in the SHIPPED group
 */
export function isShipped(status: string | null | undefined): boolean {
  return matchesStatusGroup(status, "SHIPPED");
}

/**
 * Check if a status is APPROVED (handles "APPROVED >>>>" variant)
 */
export function isApproved(status: string | null | undefined): boolean {
  return matchesStatusGroup(status, "APPROVED");
}

/**
 * Check if a status is tracked (has automation configured)
 */
export function isTrackedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalizedStatus = status.toUpperCase().trim();
  return TRACKED_STATUSES.some((s) => normalizedStatus === s);
}
