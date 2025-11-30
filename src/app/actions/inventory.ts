"use server";

import { db } from "@/lib/db";
import { inventoryindex } from "@/lib/schema";
import { like, or } from "drizzle-orm";

// Result type per CLAUDE.md
type Result<T> = { success: true; data: T } | { success: false; error: string };

// Inventory item type inferred from schema
type InventoryItem = typeof inventoryindex.$inferSelect;

export async function searchInventory(
  query: string
): Promise<Result<InventoryItem[]>> {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    const searchPattern = `%${query.trim()}%`;

    const results = await db
      .select()
      .from(inventoryindex)
      .where(
        or(
          like(inventoryindex.partNumber, searchPattern),
          like(inventoryindex.description, searchPattern)
        )
      )
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
