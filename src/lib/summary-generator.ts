/**
 * Summary Generator - Template-based RO summary with priority scoring
 * Generates time-aware summaries for the Priority Feed
 */

import { NormalizedRepairOrder } from "@/app/actions/dashboard";
import { isOverdue, daysSince, daysUntil, formatRelativeDate } from "./date-utils";

// Priority levels for sorting
export type Priority = 1 | 2 | 3 | 4;

// Summary output structure
export type ROSummary = {
  oneLiner: string;
  snapshot: string[];
  nextStep: string;
  priority: Priority;
  priorityLabel: "OVERDUE" | "ACTION REQUIRED" | "ARRIVING SOON" | "";
  daysOverdue?: number;
};

/**
 * Calculate priority level for an RO
 * P1: Overdue (past ETA or past next update date)
 * P2: Action Required (stalled states > threshold days)
 * P3: Arriving Soon (ETA within 3 days)
 * P4: Everything else
 */
export function calculatePriority(ro: NormalizedRepairOrder): Priority {
  // P1: Overdue - past ETA or past next update date
  if (isOverdue(ro.nextDateToUpdate) || isOverdue(ro.estimatedDeliveryDate)) {
    return 1;
  }

  // P2: Action Required - stalled states
  const daysInStatus = daysSince(ro.curentStatusDate);
  const status = (ro.curentStatus || "").toUpperCase();

  if (status.includes("WAITING") && status.includes("QUOTE") && daysInStatus !== null && daysInStatus > 3) {
    return 2;
  }
  if (status.includes("APPROVED") && daysInStatus !== null && daysInStatus > 3) {
    return 2;
  }
  if ((status.includes("SHIPPED") || status.includes("TRANSIT")) && daysInStatus !== null && daysInStatus > 5) {
    return 2;
  }

  // P3: Arriving Soon - ETA within 3 days
  const daysToEta = daysUntil(ro.estimatedDeliveryDate);
  if (daysToEta !== null && daysToEta >= 0 && daysToEta <= 3) {
    return 3;
  }

  // P4: Everything else
  return 4;
}

/**
 * Get priority label for display
 */
function getPriorityLabel(priority: Priority): ROSummary["priorityLabel"] {
  switch (priority) {
    case 1: return "OVERDUE";
    case 2: return "ACTION REQUIRED";
    case 3: return "ARRIVING SOON";
    default: return "";
  }
}

/**
 * Calculate days overdue for display
 */
function calculateDaysOverdue(ro: NormalizedRepairOrder): number | undefined {
  const nextUpdateDays = daysSince(ro.nextDateToUpdate);
  const etaDays = daysSince(ro.estimatedDeliveryDate);

  // Return the larger overdue value
  const overdueDays: number[] = [];
  if (nextUpdateDays !== null && nextUpdateDays > 0) overdueDays.push(nextUpdateDays);
  if (etaDays !== null && etaDays > 0) overdueDays.push(etaDays);

  return overdueDays.length > 0 ? Math.max(...overdueDays) : undefined;
}

/**
 * Generate time-aware one-liner based on status and days in status
 */
function generateOneLiner(ro: NormalizedRepairOrder, priority: Priority): string {
  const shop = ro.shopName || "Unknown Shop";
  const roNum = ro.ro ? `RO-${ro.ro}` : "RO";
  const status = (ro.curentStatus || "").toUpperCase();
  const daysInStatus = daysSince(ro.curentStatusDate);

  // P1: Overdue scenarios
  if (priority === 1) {
    const daysOver = calculateDaysOverdue(ro);
    if (daysOver && daysOver > 0) {
      return `${roNum} is ${daysOver} day${daysOver > 1 ? "s" : ""} OVERDUE at ${shop}.`;
    }
    return `${roNum} is overdue for follow-up at ${shop}.`;
  }

  // WAITING QUOTE
  if (status.includes("WAITING") && status.includes("QUOTE")) {
    if (daysInStatus !== null && daysInStatus > 3) {
      return `${roNum} quote request is STALLED at ${shop} (${daysInStatus} days).`;
    }
    if (daysInStatus !== null && daysInStatus >= 2) {
      return `${roNum} awaiting quote response from ${shop}.`;
    }
    return `${roNum} quote requested recently from ${shop}.`;
  }

  // APPROVED
  if (status.includes("APPROVED")) {
    if (daysInStatus !== null && daysInStatus > 3) {
      return `${roNum} approved but work hasn't started at ${shop} (${daysInStatus} days).`;
    }
    return `${roNum} recently approved for work at ${shop}.`;
  }

  // IN WORK / IN PROGRESS
  if (status.includes("IN WORK") || status.includes("IN PROGRESS") || status.includes("WORKING")) {
    if (daysInStatus !== null && daysInStatus > 7) {
      return `${roNum} repair is taking longer than expected at ${shop} (${daysInStatus} days).`;
    }
    const eta = ro.estimatedDeliveryDate ? ` - ETA ${formatRelativeDate(ro.estimatedDeliveryDate)}` : "";
    return `${roNum} being repaired at ${shop}${eta}.`;
  }

  // SHIPPED / IN TRANSIT
  if (status.includes("SHIPPED") || status.includes("TRANSIT")) {
    if (daysInStatus !== null && daysInStatus > 3) {
      return `${roNum} shipment may be delayed (${daysInStatus} days in transit).`;
    }
    return `${roNum} in transit to GenThrust.`;
  }

  // COMPLETE
  if (status.includes("COMPLETE")) {
    return `${roNum} repair complete at ${shop} - ready for payment processing.`;
  }

  // BER / RAI
  if (status.includes("BER") || status.includes("RAI") || status.includes("BEYOND")) {
    return `${roNum} beyond economical repair at ${shop}.`;
  }

  // P3: Arriving soon
  if (priority === 3) {
    const daysTo = daysUntil(ro.estimatedDeliveryDate);
    if (daysTo === 0) return `${roNum} arriving TODAY from ${shop}.`;
    if (daysTo === 1) return `${roNum} arriving TOMORROW from ${shop}.`;
    return `${roNum} arriving in ${daysTo} days from ${shop}.`;
  }

  // Default
  return `${roNum} - ${status || "status unknown"} at ${shop}.`;
}

/**
 * Generate RO snapshot bullets
 */
function generateSnapshot(ro: NormalizedRepairOrder): string[] {
  const bullets: string[] = [];

  // Bullet 1: RO | PN | Description
  const roNum = ro.ro || "N/A";
  const pn = ro.part || "N/A";
  const desc = ro.partDescription || "No description";
  bullets.push(`RO: ${roNum} | PN ${pn} | ${desc}`);

  // Bullet 2: Status since date
  const status = ro.curentStatus || "Unknown";
  const statusDate = ro.curentStatusDate ? formatRelativeDate(ro.curentStatusDate) : "unknown";
  const daysInStatus = daysSince(ro.curentStatusDate);
  const daysText = daysInStatus !== null ? ` (${daysInStatus}d)` : "";
  bullets.push(`Status: ${status} since ${statusDate}${daysText}`);

  // Bullet 3: Timeline or tracking
  if (ro.estimatedDeliveryDate) {
    const eta = formatRelativeDate(ro.estimatedDeliveryDate);
    const daysTo = daysUntil(ro.estimatedDeliveryDate);
    if (daysTo !== null && daysTo < 0) {
      bullets.push(`ETA: ${eta} (${Math.abs(daysTo)}d overdue)`);
    } else {
      bullets.push(`ETA: ${eta}`);
    }
  } else if (ro.nextDateToUpdate) {
    bullets.push(`Next follow-up: ${formatRelativeDate(ro.nextDateToUpdate)}`);
  }

  // Add tracking if available and status is shipping-related
  const status_upper = (ro.curentStatus || "").toUpperCase();
  if (ro.trackingNumberPickingUp && (status_upper.includes("SHIPPED") || status_upper.includes("TRANSIT"))) {
    bullets.push(`Tracking: ${ro.trackingNumberPickingUp}`);
  }

  return bullets;
}

/**
 * Generate next step recommendation based on status and timing
 */
function generateNextStep(ro: NormalizedRepairOrder, priority: Priority): string {
  const shop = ro.shopName || "the shop";
  const status = (ro.curentStatus || "").toUpperCase();
  const daysInStatus = daysSince(ro.curentStatusDate);

  // P1: Overdue - urgent action
  if (priority === 1) {
    if (status.includes("WAITING") && status.includes("QUOTE")) {
      return `Call ${shop} immediately - quote is overdue.`;
    }
    if (status.includes("IN WORK") || status.includes("IN PROGRESS")) {
      return `Contact ${shop} urgently - past estimated delivery.`;
    }
    return `Follow up with ${shop} immediately - action is overdue.`;
  }

  // WAITING QUOTE
  if (status.includes("WAITING") && status.includes("QUOTE")) {
    if (daysInStatus !== null && daysInStatus > 3) {
      return `Call ${shop} immediately - quote request is stalled.`;
    }
    if (daysInStatus !== null && daysInStatus >= 2) {
      return `Consider follow-up call to ${shop}.`;
    }
    return `Monitor - too early to follow up.`;
  }

  // APPROVED
  if (status.includes("APPROVED")) {
    if (daysInStatus !== null && daysInStatus > 3) {
      return `Push ${shop} to begin repair work.`;
    }
    return `Confirm work start date with ${shop}.`;
  }

  // IN WORK
  if (status.includes("IN WORK") || status.includes("IN PROGRESS") || status.includes("WORKING")) {
    if (daysInStatus !== null && daysInStatus > 7) {
      return `Request updated ETA from ${shop}.`;
    }
    return `Check progress mid-week.`;
  }

  // SHIPPED / IN TRANSIT
  if (status.includes("SHIPPED") || status.includes("TRANSIT")) {
    if (ro.trackingNumberPickingUp) {
      if (daysInStatus !== null && daysInStatus > 3) {
        return `Check tracking status urgently - may be delayed.`;
      }
      return `Track shipment: ${ro.trackingNumberPickingUp}`;
    }
    return `Request tracking number from ${shop}.`;
  }

  // COMPLETE
  if (status.includes("COMPLETE")) {
    const terms = ro.terms || "";
    if (terms.toLowerCase().includes("net")) {
      return `Process payment per ${terms} terms.`;
    }
    return `Verify receipt and process payment.`;
  }

  // BER / RAI
  if (status.includes("BER") || status.includes("RAI") || status.includes("BEYOND")) {
    return `Arrange return pickup and evaluate replacement options.`;
  }

  // P3: Arriving soon
  if (priority === 3) {
    return `Prepare for incoming delivery.`;
  }

  // Default
  const nextUpdate = ro.nextDateToUpdate ? formatRelativeDate(ro.nextDateToUpdate) : null;
  if (nextUpdate) {
    return `Next scheduled update: ${nextUpdate}.`;
  }
  return `No immediate action required.`;
}

/**
 * Generate complete summary for an RO
 */
export function generateSummary(ro: NormalizedRepairOrder): ROSummary {
  const priority = calculatePriority(ro);

  return {
    oneLiner: generateOneLiner(ro, priority),
    snapshot: generateSnapshot(ro),
    nextStep: generateNextStep(ro, priority),
    priority,
    priorityLabel: getPriorityLabel(priority),
    daysOverdue: calculateDaysOverdue(ro),
  };
}

/**
 * Sort ROs by priority, then by days overdue (desc)
 */
export function sortByPriority(
  summaries: Array<{ ro: NormalizedRepairOrder; summary: ROSummary }>
): Array<{ ro: NormalizedRepairOrder; summary: ROSummary }> {
  return [...summaries].sort((a, b) => {
    // Sort by priority first (1 = highest)
    if (a.summary.priority !== b.summary.priority) {
      return a.summary.priority - b.summary.priority;
    }
    // Then by days overdue (more overdue = higher in list)
    const aDays = a.summary.daysOverdue || 0;
    const bDays = b.summary.daysOverdue || 0;
    return bDays - aDays;
  });
}
