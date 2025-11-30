import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "../lib/db";
import { active, inventoryindex } from "../lib/schema";
import { eq, like, or } from "drizzle-orm";

// Type exports for tool outputs
export type InventoryItem = typeof inventoryindex.$inferSelect;
export type RepairOrder = typeof active.$inferSelect;

// Sub-task: Search Inventory
// Isolated, durable task that can retry independently
export const searchInventoryTool = task({
  id: "ai-tool-search-inventory",
  machine: { preset: "micro" },
  retry: { maxAttempts: 3 },
  run: async (payload: { query: string; limit?: number }) => {
    const { query, limit = 20 } = payload;

    logger.info("Searching inventory", { query, limit });

    const pattern = `%${query}%`;

    const results = await db
      .select()
      .from(inventoryindex)
      .where(
        or(
          like(inventoryindex.partNumber, pattern),
          like(inventoryindex.description, pattern)
        )
      )
      .limit(limit);

    logger.info("Inventory search complete", { count: results.length });

    return {
      items: results,
      count: results.length,
    };
  },
});

// Sub-task: Get Repair Order
// Isolated, durable task that can retry independently
export const getRepairOrderTool = task({
  id: "ai-tool-get-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 3 },
  run: async (payload: { roNumber?: number; roId?: number }) => {
    const { roNumber, roId } = payload;

    logger.info("Fetching repair order", { roNumber, roId });

    let results: RepairOrder[];

    if (roId) {
      results = await db
        .select()
        .from(active)
        .where(eq(active.id, roId));
    } else if (roNumber) {
      results = await db
        .select()
        .from(active)
        .where(eq(active.ro, roNumber));
    } else {
      logger.warn("No roNumber or roId provided");
      return { repairOrder: null, error: "Must provide roNumber or roId" };
    }

    const repairOrder = results[0] ?? null;

    logger.info("Repair order lookup complete", {
      found: repairOrder !== null,
      roNumber: repairOrder?.ro,
    });

    return { repairOrder };
  },
});
