"use server";

import { db } from "@/lib/db";
import { active } from "@/lib/schema";
import { like, or, sql, count, sum, desc } from "drizzle-orm";

// Result type per CLAUDE.md
type Result<T> = { success: true; data: T } | { success: false; error: string };

// Repair order type inferred from schema
export type RepairOrder = typeof active.$inferSelect;

// Dashboard stats type
export type DashboardStats = {
  totalActive: number;
  overdue: number;
  waitingQuote: number;
  valueInWork: number;
};

// Paginated response type
export type PaginatedRepairOrders = {
  data: RepairOrder[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
};

const ITEMS_PER_PAGE = 20;

/**
 * Parse a date string in various formats
 * Handles: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD, and Excel serial numbers
 */
function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString || typeof dateString !== "string") return null;

  const trimmed = dateString.trim();
  if (!trimmed) return null;

  // Try MM/DD/YYYY or M/D/YYYY format
  const usDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDateMatch) {
    const [, month, day, year] = usDateMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD format
  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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
 * Get dashboard statistics from the active table
 */
export async function getDashboardStats(): Promise<Result<DashboardStats>> {
  try {
    // Get all active records for client-side calculations
    // (needed for date parsing which can't be done in SQL with string dates)
    const allRecords = await db.select().from(active);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdue = 0;
    let waitingQuote = 0;
    let valueInWork = 0;

    const excludedStatuses = ["PAID", "BER", "RAI", "RETURNED"];

    for (const record of allRecords) {
      // Count overdue (nextDateToUpdate < today)
      const nextUpdateDate = parseDate(record.nextDateToUpdate);
      if (nextUpdateDate && nextUpdateDate < today) {
        overdue++;
      }

      // Count waiting quote
      const status = record.curentStatus?.toUpperCase()?.trim() || "";
      if (status === "WAITING QUOTE" || status === "WAITING FOR QUOTE") {
        waitingQuote++;
      }

      // Sum value in work (excluding completed/closed statuses)
      if (!excludedStatuses.includes(status) && record.estimatedCost) {
        valueInWork += record.estimatedCost;
      }
    }

    return {
      success: true,
      data: {
        totalActive: allRecords.length,
        overdue,
        waitingQuote,
        valueInWork,
      },
    };
  } catch (error) {
    console.error("getDashboardStats error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch dashboard stats",
    };
  }
}

/**
 * Get paginated repair orders with optional search
 */
export async function getRepairOrders(
  query: string = "",
  page: number = 1
): Promise<Result<PaginatedRepairOrders>> {
  try {
    const offset = (page - 1) * ITEMS_PER_PAGE;
    const searchPattern = query.trim() ? `%${query.trim()}%` : null;

    // Build the base query
    let dataQuery = db.select().from(active);
    let countQuery = db.select({ count: count() }).from(active);

    // Apply search filter if provided
    if (searchPattern) {
      const searchCondition = or(
        like(sql`CAST(${active.ro} AS CHAR)`, searchPattern),
        like(active.shopName, searchPattern),
        like(active.part, searchPattern),
        like(active.serial, searchPattern),
        like(active.partDescription, searchPattern)
      );

      dataQuery = dataQuery.where(searchCondition) as typeof dataQuery;
      countQuery = countQuery.where(searchCondition) as typeof countQuery;
    }

    // Execute queries in parallel
    const [results, countResult] = await Promise.all([
      dataQuery.orderBy(desc(active.id)).limit(ITEMS_PER_PAGE).offset(offset),
      countQuery,
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    return {
      success: true,
      data: {
        data: results,
        totalCount,
        totalPages,
        currentPage: page,
      },
    };
  } catch (error) {
    console.error("getRepairOrders error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch repair orders",
    };
  }
}

/**
 * Get a single repair order by ID
 */
export async function getRepairOrderById(
  id: number
): Promise<Result<RepairOrder | null>> {
  try {
    const results = await db
      .select()
      .from(active)
      .where(sql`${active.id} = ${id}`)
      .limit(1);

    return {
      success: true,
      data: results[0] ?? null,
    };
  } catch (error) {
    console.error("getRepairOrderById error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch repair order",
    };
  }
}
