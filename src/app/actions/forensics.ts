"use server";

import { db } from "@/lib/db";
import { inventoryindex, binsInventoryActual } from "@/lib/schema";
import { sql, isNotNull } from "drizzle-orm";

type ForensicsResult = {
  inventoryindex: {
    total: number;
    withCondition: number;
    withoutCondition: number;
    conditionBreakdown: Array<{ condition: string | null; count: number }>;
  };
  binsInventoryActual: {
    total: number;
    withCondition: number;
    conditionBreakdown: Array<{ condition: string | null; count: number }>;
  };
  tableSummary: {
    tableName: string;
    count: number;
  }[];
  recommendation: string;
};

/**
 * Run forensics queries to analyze condition data
 */
export async function runConditionForensics(): Promise<ForensicsResult> {
  // ==========================================
  // PART 1: inventoryindex Analysis
  // ==========================================
  const totalInventory = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(inventoryindex);

  const withCondition = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(inventoryindex)
    .where(isNotNull(inventoryindex.condition));

  const conditionBreakdown = await db
    .select({
      condition: inventoryindex.condition,
      count: sql<number>`COUNT(*)`,
    })
    .from(inventoryindex)
    .where(isNotNull(inventoryindex.condition))
    .groupBy(inventoryindex.condition)
    .orderBy(sql`COUNT(*) DESC`);

  // ==========================================
  // PART 2: binsInventoryActual Analysis
  // ==========================================
  const totalBins = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(binsInventoryActual);

  const binsWithCondition = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(binsInventoryActual)
    .where(isNotNull(binsInventoryActual.condition));

  const binsConditionBreakdown = await db
    .select({
      condition: binsInventoryActual.condition,
      count: sql<number>`COUNT(*)`,
    })
    .from(binsInventoryActual)
    .where(isNotNull(binsInventoryActual.condition))
    .groupBy(binsInventoryActual.condition)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(30);

  // ==========================================
  // PART 3: Check TableName distribution in inventoryindex
  // ==========================================
  const tableNameDistribution = await db
    .select({
      tableName: inventoryindex.tableName,
      count: sql<number>`COUNT(*)`,
    })
    .from(inventoryindex)
    .groupBy(inventoryindex.tableName)
    .orderBy(sql`COUNT(*) DESC`);

  // ==========================================
  // Build result
  // ==========================================
  const totalItems = Number(totalInventory[0].count);
  const itemsWithCondition = Number(withCondition[0].count);
  const missingPercentage = ((1 - itemsWithCondition / totalItems) * 100).toFixed(1);

  // Determine recommendation
  let recommendation = "";
  if (itemsWithCondition < totalItems * 0.1) {
    recommendation = `CRITICAL: Only ${itemsWithCondition} of ${totalItems} items (${(100 - parseFloat(missingPercentage)).toFixed(1)}%) have condition data. ` +
      "The source tables don't have proper aviation condition codes (AR, NE, OH, SV, RP). " +
      "Options: 1) Leave as-is and show '?' for unknown conditions, 2) Import condition data from external source (Excel), " +
      "3) Use reqWork field from repair orders to infer initial condition.";
  } else {
    recommendation = "Condition data is available. Run migration to normalize codes.";
  }

  const result: ForensicsResult = {
    inventoryindex: {
      total: totalItems,
      withCondition: itemsWithCondition,
      withoutCondition: totalItems - itemsWithCondition,
      conditionBreakdown: conditionBreakdown.map((r) => ({
        condition: r.condition,
        count: Number(r.count),
      })),
    },
    binsInventoryActual: {
      total: Number(totalBins[0].count),
      withCondition: Number(binsWithCondition[0].count),
      conditionBreakdown: binsConditionBreakdown.map((r) => ({
        condition: r.condition,
        count: Number(r.count),
      })),
    },
    tableSummary: tableNameDistribution.map((r) => ({
      tableName: r.tableName || "NULL",
      count: Number(r.count),
    })),
    recommendation,
  };

  return result;
}
