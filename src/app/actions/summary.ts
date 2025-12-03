"use server";

import { db } from "@/lib/db";
import { active } from "@/lib/schema";
import { notInArray } from "drizzle-orm";
import { NormalizedRepairOrder } from "./dashboard";

// Result type per CLAUDE.md
type Result<T> = { success: true; data: T } | { success: false; error: string };

// Statuses that belong to other sheets (not Active dashboard)
const ARCHIVED_STATUSES = [
  "COMPLETE",
  "NET",
  "PAID",
  "RETURNS",
  "BER",
  "RAI",
  "CANCELLED",
];

/**
 * Normalize a repair order record to handle type differences
 */
function normalizeRepairOrder(record: Record<string, unknown>): NormalizedRepairOrder {
  return {
    id: typeof record.id === "number" ? record.id : Number(record.id),
    ro: record.ro != null ? Number(record.ro) : null,
    dateMade: record.dateMade instanceof Date
      ? record.dateMade.toISOString()
      : (record.dateMade as string | null),
    shopName: record.shopName as string | null,
    part: record.part as string | null,
    serial: record.serial as string | null,
    partDescription: record.partDescription as string | null,
    reqWork: record.reqWork as string | null,
    dateDroppedOff: record.dateDroppedOff as string | null,
    estimatedCost: record.estimatedCost != null ? Number(record.estimatedCost) : null,
    finalCost: record.finalCost != null ? String(record.finalCost) : null,
    terms: record.terms as string | null,
    shopRef: record.shopRef as string | null,
    estimatedDeliveryDate: record.estimatedDeliveryDate as string | null,
    curentStatus: record.curentStatus as string | null,
    curentStatusDate: record.curentStatusDate as string | null,
    genthrustStatus: record.genthrustStatus as string | null,
    shopStatus: record.shopStatus as string | null,
    trackingNumberPickingUp: record.trackingNumberPickingUp as string | null,
    notes: record.notes as string | null,
    lastDateUpdated: record.lastDateUpdated as string | null,
    nextDateToUpdate: record.nextDateToUpdate as string | null,
    createdAt: record.createdAt instanceof Date
      ? record.createdAt.toISOString()
      : (record.createdAt as string | null),
  };
}

/**
 * Get all active repair orders for the Priority Feed summary view
 * No pagination, no search - returns all active ROs for client-side processing
 */
export async function getRepairOrdersForSummary(): Promise<Result<NormalizedRepairOrder[]>> {
  try {
    const records = await db
      .select()
      .from(active)
      .where(notInArray(active.curentStatus, ARCHIVED_STATUSES));

    const normalized = records.map((record) =>
      normalizeRepairOrder(record as unknown as Record<string, unknown>)
    );

    return { success: true, data: normalized };
  } catch (error) {
    console.error("Error fetching repair orders for summary:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch repair orders",
    };
  }
}
