/**
 * ERP to MySQL Field Mapping
 *
 * Functions to convert ERP.aero API responses to the local MySQL schema format.
 * Handles status normalization and field extraction from nested structures.
 */

import type {
  ERPExternalDetailsResponse,
  ERPStatus
} from "@/lib/types/erp";

// ============================================
// Status Mapping
// ============================================

/**
 * Map ERP status strings to local status values.
 * ERP uses various status names that need to be normalized
 * to match our application's status enum.
 */
export function mapERPStatus(erpStatus: ERPStatus): string {
  const status = erpStatus.status.toUpperCase().trim();

  // Map common ERP statuses to local equivalents
  if (status.includes("DELIVERED") || status.includes("RECEIVED")) {
    return "RECEIVED";
  }
  if (status.includes("SHIPPED") || status.includes("TRANSIT")) {
    return "SHIPPED";
  }
  if (status.includes("APPROVED")) {
    return "APPROVED";
  }
  if (status.includes("PACKED")) {
    return "SHIPPED";
  }
  if (status.includes("CANCEL")) {
    return "CANCELLED";
  }
  if (status.includes("SCRAP")) {
    return "SCRAP";
  }
  if (status.includes("COMPLETED") || status.includes("DONE")) {
    return "COMPLETED";
  }
  if (status.includes("PROGRESS") || status.includes("WORKING")) {
    return "IN PROGRESS";
  }
  if (status.includes("QUOTED") || status.includes("QUOTE")) {
    return "QUOTED";
  }
  if (status.includes("HOLD")) {
    return "ON HOLD";
  }
  if (status.includes("BER") || status.includes("BEYOND")) {
    return "BER";
  }

  // Default fallback
  return "WAITING QUOTE";
}

// ============================================
// ERP Sync Status Values
// ============================================

export type ERPSyncStatus = "LOCAL_ONLY" | "SYNCED" | "SYNC_FAILED" | "PENDING_SYNC";

// ============================================
// Date Calculation Helpers
// ============================================

/**
 * Parse lead time strings like "2 WEEKS", "30 DAYS", "1 MONTH"
 * and calculate the actual estimated delivery date.
 */
function calculateEstimatedDate(
  createdDateStr: string | undefined | null,
  leadTimeStr: string | undefined | null
): string | null {
  if (!createdDateStr || !leadTimeStr) return null;

  const created = new Date(createdDateStr);
  if (isNaN(created.getTime())) return null;

  const cleanLead = leadTimeStr.toUpperCase().trim();
  let daysToAdd = 0;

  if (cleanLead.includes("WEEK")) {
    const num = parseInt(cleanLead.replace(/\D/g, "")) || 0;
    daysToAdd = num * 7;
  } else if (cleanLead.includes("DAY")) {
    const num = parseInt(cleanLead.replace(/\D/g, "")) || 0;
    daysToAdd = num;
  } else if (cleanLead.includes("MONTH")) {
    const num = parseInt(cleanLead.replace(/\D/g, "")) || 0;
    daysToAdd = num * 30;
  } else {
    // Unknown format
    return null;
  }

  if (daysToAdd === 0) return null;

  created.setDate(created.getDate() + daysToAdd);
  return created.toISOString().split("T")[0]; // Return YYYY-MM-DD
}

// ============================================
// Details Mapping
// ============================================

/**
 * Map ERP repair order details to local MySQL schema fields.
 *
 * @param data - The details response from ERP API
 * @returns Object with fields matching the active table schema
 */
export function mapERPDetailsToLocal(data: ERPExternalDetailsResponse) {
  const { body, partsList } = data;
  const mainPart = partsList[0];

  // Extract date from ISO timestamp (e.g., "2023-11-17T18:40:48.000Z" -> "2023-11-17")
  const modifiedDate = body.modified_time?.split("T")[0] || null;

  // Calculate the real delivery date from lead time
  const calculatedDelivery = calculateEstimatedDate(
    body.created_time,
    mainPart?.leadtime
  );

  // Build notes from condition if present
  // Note: Old system RO references (e.g., "RO G 38569") may be in the comment field,
  // which is mapped to partDescription. We'll extract them from both notes and partDescription
  // when filtering Excel ROs in the dashboard.
  const noteParts: string[] = [];
  if (mainPart?.condition) {
    noteParts.push(`Condition: ${mainPart.condition}`);
  }
  const notes = noteParts.length > 0 ? noteParts.join(" | ") : null;

  return {
    // Vendor info -> shopName
    shopName: body.vendor?.vendorname || "Unknown Vendor",

    // First part info
    part: mainPart?.product?.name || "Unknown Part",
    serial: mainPart?.tags?.sn || mainPart?.json_data?.pn_sn || null,
    partDescription: mainPart?.comment || null,
    notes,

    // Costs (use unit_price from first part)
    estimatedCost: mainPart?.unit_price ? Number(mainPart.unit_price) : null,

    // Status
    curentStatus: mapERPStatus(body.status),
    curentStatusDate: modifiedDate,

    // Terms & Shipping
    terms: body.term_sale || null,
    trackingNumberPickingUp: body.ship_via || null,

    // Dates - use calculated date if available, fallback to raw lead time string
    lastDateUpdated: modifiedDate,
    estimatedDeliveryDate: calculatedDelivery || mainPart?.leadtime || null,

    // ERP sync metadata
    erpPoId: String(body.po_id),
    erpLastSyncAt: new Date().toISOString(),
    erpSyncStatus: "SYNCED" as ERPSyncStatus,
  };
}

/**
 * Extract basic list info from ERP list item.
 * Used for display without fetching full details.
 */
export function mapERPListItemToSummary(item: {
  body: {
    po_id: number;
    po_no: string;
    status: ERPStatus;
    modified_time: string;
    created_time?: string;
  };
}) {
  return {
    poId: item.body.po_id,
    poNo: item.body.po_no,
    status: mapERPStatus(item.body.status),
    rawStatus: item.body.status.status,
    modifiedTime: item.body.modified_time,
    createdTime: item.body.created_time || null,
  };
}
