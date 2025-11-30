"use server";

import { db } from "@/lib/db";
import { active } from "@/lib/schema";
import { like, or, sql, count, desc } from "drizzle-orm";
import { parseDate, isOverdue } from "@/lib/date-utils";

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

// Filter type for repair orders
export type RepairOrderFilter = "all" | "overdue";

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

    let unparseableCount = 0;
    const unparseableSamples: string[] = [];

    for (const record of allRecords) {
      // Count overdue (nextDateToUpdate < today)
      const nextUpdateDate = parseDate(record.nextDateToUpdate);

      // Track unparseable dates for debugging
      if (record.nextDateToUpdate && !nextUpdateDate) {
        unparseableCount++;
        if (unparseableSamples.length < 3) {
          unparseableSamples.push(`"${record.nextDateToUpdate}"`);
        }
      }

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

    // Log summary for debugging
    if (unparseableCount > 0) {
      console.log(
        `[getDashboardStats] Warning: ${unparseableCount} unparseable dates. Samples: ${unparseableSamples.join(", ")}`
      );
    }
    console.log(
      `[getDashboardStats] Total: ${allRecords.length}, Overdue: ${overdue}, WaitingQuote: ${waitingQuote}, ValueInWork: $${valueInWork}`
    );

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
 * Get paginated repair orders with optional search and filter
 */
export async function getRepairOrders(
  query: string = "",
  page: number = 1,
  filter: RepairOrderFilter = "all"
): Promise<Result<PaginatedRepairOrders>> {
  try {
    const offset = (page - 1) * ITEMS_PER_PAGE;
    const searchPattern = query.trim() ? `%${query.trim()}%` : null;

    // Build the search condition
    const searchCondition = searchPattern
      ? or(
          like(sql`CAST(${active.ro} AS CHAR)`, searchPattern),
          like(active.shopName, searchPattern),
          like(active.part, searchPattern),
          like(active.serial, searchPattern),
          like(active.partDescription, searchPattern)
        )
      : undefined;

    // If filtering for overdue, we need to fetch all and filter in memory
    // (date parsing can't be done in SQL with string dates)
    if (filter === "overdue") {
      let dataQuery = db.select().from(active);
      if (searchCondition) {
        dataQuery = dataQuery.where(searchCondition) as typeof dataQuery;
      }

      const allResults = await dataQuery.orderBy(desc(active.id));

      // Filter for overdue in memory
      const overdueResults = allResults.filter((r) =>
        isOverdue(r.nextDateToUpdate)
      );

      // Apply pagination to filtered results
      const paginatedResults = overdueResults.slice(
        offset,
        offset + ITEMS_PER_PAGE
      );
      const totalCount = overdueResults.length;
      const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

      return {
        success: true,
        data: {
          data: paginatedResults,
          totalCount,
          totalPages,
          currentPage: page,
        },
      };
    }

    // Standard "all" filter - use SQL pagination
    let dataQuery = db.select().from(active);
    let countQuery = db.select({ count: count() }).from(active);

    if (searchCondition) {
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
