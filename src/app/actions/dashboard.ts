"use server";

import { db } from "@/lib/db";
import { active, net, paid, returns } from "@/lib/schema";
import { like, or, sql, count, desc, notInArray, and, eq, gte, lte } from "drizzle-orm";
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
  inWork: number;
  shipped: number;
  net30: number;
  approved: number;
};

// Paginated response type
export type PaginatedRepairOrders = {
  data: RepairOrder[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
};

const ITEMS_PER_PAGE = 20;

// Statuses that belong to other sheets (not Active dashboard)
// These are filtered out from the main Active view
const ARCHIVED_STATUSES = [
  "COMPLETE",
  "NET",
  "PAID",
  "RETURNS",
  "BER",
  "RAI",
  "CANCELLED",
];

// Filter type for repair orders
export type RepairOrderFilter = "all" | "overdue";

// Sheet filter type for multi-table querying
export type SheetFilter = "active" | "net" | "paid" | "returns";

// Dashboard filters for advanced filtering
export interface DashboardFilters {
  status?: string;      // e.g., "APPROVED", "IN WORK", "WAITING QUOTE"
  shop?: string;        // Shop name (exact match)
  dateFrom?: string;    // ISO date string for date range start
  dateTo?: string;      // ISO date string for date range end
}

// Table lookup map for dynamic querying
const SHEET_TABLES = {
  active,
  net,
  paid,
  returns,
} as const;

// Normalized repair order type - handles schema differences between tables
// (active.finalCost is double, paid/returns.finalCost is varchar, etc.)
export type NormalizedRepairOrder = {
  id: number;
  ro: number | null;
  dateMade: string | null;
  shopName: string | null;
  part: string | null;
  serial: string | null;
  partDescription: string | null;
  reqWork: string | null;
  dateDroppedOff: string | null;
  estimatedCost: number | null;
  finalCost: string | null; // Normalized to string for display consistency
  terms: string | null;
  shopRef: string | null;
  estimatedDeliveryDate: string | null;
  curentStatus: string | null;
  curentStatusDate: string | null;
  genthrustStatus: string | null;
  shopStatus: string | null;
  trackingNumberPickingUp: string | null;
  notes: string | null;
  lastDateUpdated: string | null;
  nextDateToUpdate: string | null;
  createdAt: string | null;
};

// Paginated response type for normalized repair orders
export type PaginatedNormalizedRepairOrders = {
  data: NormalizedRepairOrder[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
};

/**
 * Normalize a repair order record to handle type differences between tables
 * - finalCost: double (active/net) or varchar (paid/returns) → string
 * - dateMade: varchar (active/returns) or datetime (net/paid) → string
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
 * Get dashboard statistics from the active table
 */
export async function getDashboardStats(): Promise<Result<DashboardStats>> {
  try {
    // Get active records (exclude archived statuses) for client-side calculations
    // (needed for date parsing which can't be done in SQL with string dates)
    const allRecords = await db
      .select()
      .from(active)
      .where(notInArray(active.curentStatus, ARCHIVED_STATUSES));

    // Count NET 30 items (COMPLETE status with Net Terms)
    const net30Result = await db
      .select({ count: count() })
      .from(active)
      .where(
        and(
          eq(active.curentStatus, "COMPLETE"),
          like(active.terms, "%Net%")
        )
      );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdue = 0;
    let waitingQuote = 0;
    let valueInWork = 0;
    let inWork = 0;
    let shipped = 0;
    let net30 = net30Result[0]?.count ?? 0; // Count of COMPLETE ROs with Net Terms
    let approved = 0;

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

      // Count waiting quote (includes PENDING)
      const status = record.curentStatus?.toUpperCase()?.trim() || "";
      if (status === "WAITING QUOTE" || status === "WAITING FOR QUOTE" || status === "AWAITING QUOTE" || status === "PENDING") {
        waitingQuote++;
      }

      // Count in work
      if (status === "IN WORK" || status === "IN PROGRESS" || status === "WORKING") {
        inWork++;
      }

      // Count shipped (actual DB values: CURRENTLY BEING SHIPPED, SHIPPING)
      if (status === "SHIPPED" || status === "IN TRANSIT" || status === "CURRENTLY BEING SHIPPED" || status === "SHIPPING") {
        shipped++;
      }

      // Count approved (handles "APPROVED >>>>" variant)
      if (status.startsWith("APPROVED")) {
        approved++;
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
      `[getDashboardStats] Total: ${allRecords.length}, Overdue: ${overdue}, WaitingQuote: ${waitingQuote}, Approved: ${approved}, Shipped: ${shipped}, ValueInWork: $${valueInWork}`
    );

    return {
      success: true,
      data: {
        totalActive: allRecords.length,
        overdue,
        waitingQuote,
        valueInWork,
        inWork,
        shipped,
        net30,
        approved,
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
      // Base condition: exclude archived statuses
      const baseCondition = notInArray(active.curentStatus, ARCHIVED_STATUSES);
      const whereCondition = searchCondition
        ? and(baseCondition, searchCondition)
        : baseCondition;

      const allResults = await db
        .select()
        .from(active)
        .where(whereCondition)
        .orderBy(desc(active.id));

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
    // Always exclude archived statuses from Active view
    const baseCondition = notInArray(active.curentStatus, ARCHIVED_STATUSES);
    const whereCondition = searchCondition
      ? and(baseCondition, searchCondition)
      : baseCondition;

    const dataQuery = db.select().from(active).where(whereCondition);
    const countQuery = db.select({ count: count() }).from(active).where(whereCondition);

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

/**
 * Get paginated repair orders from a specific sheet (table) with optional search and filter.
 *
 * This function queries different database tables based on the sheet parameter:
 * - "active": The active table (excludes ARCHIVED_STATUSES)
 * - "net": The net table (all records - awaiting NET30 payment)
 * - "paid": The paid table (all records - completed and paid)
 * - "returns": The returns table (all records - RAI, BER, CANCELLED, SCRAP)
 *
 * Results are normalized to handle schema differences between tables.
 */
export async function getRepairOrdersBySheet(
  sheet: SheetFilter,
  query: string = "",
  page: number = 1,
  filter: RepairOrderFilter = "all",
  filters?: DashboardFilters
): Promise<Result<PaginatedNormalizedRepairOrders>> {
  try {
    const table = SHEET_TABLES[sheet];
    const offset = (page - 1) * ITEMS_PER_PAGE;
    const searchPattern = query.trim() ? `%${query.trim()}%` : null;

    // Build conditions array for AND logic
    const conditions: ReturnType<typeof eq>[] = [];

    // Search condition - works for all tables since they share column names
    if (searchPattern) {
      const searchCondition = or(
        like(sql`CAST(${table.ro} AS CHAR)`, searchPattern),
        like(table.shopName, searchPattern),
        like(table.part, searchPattern),
        like(table.serial, searchPattern),
        like(table.partDescription, searchPattern)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    // For active sheet, exclude archived statuses
    if (sheet === "active") {
      conditions.push(notInArray(table.curentStatus, ARCHIVED_STATUSES));
    }

    // Apply status filter (supports startsWith for "APPROVED" variants)
    if (filters?.status) {
      const statusUpper = filters.status.toUpperCase();
      // Use LIKE with % for prefix matching (handles "APPROVED >>>>" etc.)
      conditions.push(like(sql`UPPER(${table.curentStatus})`, `${statusUpper}%`));
    }

    // Apply shop filter (exact match, case-insensitive)
    if (filters?.shop) {
      conditions.push(eq(sql`LOWER(${table.shopName})`, filters.shop.toLowerCase()));
    }

    // Apply date range filters on estimatedDeliveryDate
    // Note: estimatedDeliveryDate is stored as VARCHAR, so we use string comparison
    if (filters?.dateFrom) {
      conditions.push(gte(table.estimatedDeliveryDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(table.estimatedDeliveryDate, filters.dateTo));
    }

    // Combine all conditions with AND
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Handle overdue filter (requires in-memory filtering due to string date format)
    if (filter === "overdue") {
      const allResults = await db
        .select()
        .from(table)
        .where(whereCondition)
        .orderBy(desc(table.id));

      // Filter for overdue in memory using date parsing
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
          data: paginatedResults.map((r) => normalizeRepairOrder(r as Record<string, unknown>)),
          totalCount,
          totalPages,
          currentPage: page,
        },
      };
    }

    // Standard "all" filter - use SQL pagination for efficiency
    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(table)
        .where(whereCondition)
        .orderBy(desc(table.id))
        .limit(ITEMS_PER_PAGE)
        .offset(offset),
      db.select({ count: count() }).from(table).where(whereCondition),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    return {
      success: true,
      data: {
        data: results.map((r) => normalizeRepairOrder(r as Record<string, unknown>)),
        totalCount,
        totalPages,
        currentPage: page,
      },
    };
  } catch (error) {
    console.error(`getRepairOrdersBySheet(${sheet}) error:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Failed to fetch repair orders from ${sheet} sheet`,
    };
  }
}

/**
 * Get unique shop names from the active table for filter dropdown
 */
export async function getUniqueShops(): Promise<Result<string[]>> {
  try {
    const results = await db
      .selectDistinct({ shopName: active.shopName })
      .from(active)
      .where(sql`${active.shopName} IS NOT NULL AND ${active.shopName} != ''`)
      .orderBy(active.shopName);

    const shops = results
      .map((r) => r.shopName)
      .filter((name): name is string => name !== null);

    return {
      success: true,
      data: shops,
    };
  } catch (error) {
    console.error("getUniqueShops error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch shop names",
    };
  }
}

/**
 * Get unique status values from the active table for filter dropdown
 */
export async function getUniqueStatuses(): Promise<Result<string[]>> {
  try {
    const results = await db
      .selectDistinct({ status: active.curentStatus })
      .from(active)
      .where(
        and(
          sql`${active.curentStatus} IS NOT NULL AND ${active.curentStatus} != ''`,
          notInArray(active.curentStatus, ARCHIVED_STATUSES)
        )
      )
      .orderBy(active.curentStatus);

    const statuses = results
      .map((r) => r.status)
      .filter((status): status is string => status !== null);

    return {
      success: true,
      data: statuses,
    };
  } catch (error) {
    console.error("getUniqueStatuses error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch status values",
    };
  }
}
