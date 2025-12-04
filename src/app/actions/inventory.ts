"use server";

import { db } from "@/lib/db";
import { inventoryindex } from "@/lib/schema";
import { like, or, lt, desc, sql, and, isNotNull } from "drizzle-orm";

// Result type per CLAUDE.md
type Result<T> = { success: true; data: T } | { success: false; error: string };

// Inventory item type inferred from schema
export type InventoryItem = typeof inventoryindex.$inferSelect;

// Dashboard types
export type LowStockItem = {
  indexId: number;
  partNumber: string | null;
  description: string | null;
  qty: number | null;
  location: string | null;
};

export type RecentlyUpdatedItem = {
  indexId: number;
  partNumber: string | null;
  description: string | null;
  lastSeen: string | null;
  condition: string | null;
};

export type InventoryStats = {
  totalItems: number;
  totalQuantity: number;
  conditionBreakdown: Record<string, number>;
};

// Condition filter type
export type ConditionFilter = "all" | "new" | "overhauled" | "as-removed" | "serviceable";

/**
 * Get items with qty < 5 for Low Stock Alerts
 */
export async function getLowStockItems(): Promise<Result<LowStockItem[]>> {
  try {
    const results = await db
      .select({
        indexId: inventoryindex.indexId,
        partNumber: inventoryindex.partNumber,
        description: inventoryindex.description,
        qty: inventoryindex.qty,
        location: inventoryindex.location,
      })
      .from(inventoryindex)
      .where(
        and(
          lt(inventoryindex.qty, 5),
          isNotNull(inventoryindex.qty)
        )
      )
      .orderBy(inventoryindex.qty)
      .limit(10);

    return { success: true, data: results };
  } catch (error) {
    console.error("getLowStockItems error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch low stock items",
    };
  }
}

/**
 * Get last 5 items by lastSeen timestamp for "Recently Updated" card
 */
export async function getRecentlyUpdated(): Promise<Result<RecentlyUpdatedItem[]>> {
  try {
    const results = await db
      .select({
        indexId: inventoryindex.indexId,
        partNumber: inventoryindex.partNumber,
        description: inventoryindex.description,
        lastSeen: inventoryindex.lastSeen,
        condition: inventoryindex.condition,
      })
      .from(inventoryindex)
      .where(isNotNull(inventoryindex.lastSeen))
      .orderBy(desc(inventoryindex.lastSeen))
      .limit(5);

    return { success: true, data: results };
  } catch (error) {
    console.error("getRecentlyUpdated error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch recently updated items",
    };
  }
}

/**
 * Get aggregate inventory statistics
 */
export async function getInventoryStats(): Promise<Result<InventoryStats>> {
  try {
    // Get total counts
    const countResult = await db
      .select({
        totalItems: sql<number>`COUNT(*)`,
        totalQuantity: sql<number>`COALESCE(SUM(${inventoryindex.qty}), 0)`,
      })
      .from(inventoryindex);

    // Get condition breakdown
    const conditionResult = await db
      .select({
        condition: inventoryindex.condition,
        count: sql<number>`COUNT(*)`,
      })
      .from(inventoryindex)
      .where(isNotNull(inventoryindex.condition))
      .groupBy(inventoryindex.condition);

    const conditionBreakdown: Record<string, number> = {};
    for (const row of conditionResult) {
      if (row.condition) {
        conditionBreakdown[row.condition] = Number(row.count);
      }
    }

    const stats = {
      totalItems: Number(countResult[0]?.totalItems ?? 0),
      totalQuantity: Number(countResult[0]?.totalQuantity ?? 0),
      conditionBreakdown,
    };

    console.log("[getInventoryStats]", JSON.stringify(stats));

    return { success: true, data: stats };
  } catch (error) {
    console.error("getInventoryStats error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch inventory stats",
    };
  }
}

/**
 * Build condition filter SQL based on filter type
 */
function buildConditionFilter(condition: ConditionFilter) {
  switch (condition) {
    case "new":
      return or(
        like(inventoryindex.condition, "%NE%"),
        like(inventoryindex.condition, "%NEW%")
      );
    case "overhauled":
      return or(
        like(inventoryindex.condition, "%OH%"),
        like(inventoryindex.condition, "%OVERHAUL%")
      );
    case "as-removed":
      return or(
        like(inventoryindex.condition, "%AR%"),
        like(inventoryindex.condition, "%AS REMOVED%"),
        like(inventoryindex.condition, "%AS-REMOVED%")
      );
    case "serviceable":
      return or(
        like(inventoryindex.condition, "%SV%"),
        like(inventoryindex.condition, "%SERVICEABLE%")
      );
    case "all":
    default:
      return undefined;
  }
}

/**
 * Search inventory with optional condition filter
 */
export async function searchInventory(
  query: string,
  condition: ConditionFilter = "all"
): Promise<Result<InventoryItem[]>> {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    const searchPattern = `%${query.trim()}%`;
    const conditionFilter = buildConditionFilter(condition);

    // Build where clause
    const searchCondition = or(
      like(inventoryindex.partNumber, searchPattern),
      like(inventoryindex.description, searchPattern)
    );

    const whereClause = conditionFilter
      ? and(searchCondition, conditionFilter)
      : searchCondition;

    const results = await db
      .select()
      .from(inventoryindex)
      .where(whereClause)
      .limit(50);

    return { success: true, data: results };
  } catch (error) {
    console.error("searchInventory error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to search inventory",
    };
  }
}
