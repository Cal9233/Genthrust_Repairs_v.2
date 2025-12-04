/**
 * Forensics Script: Investigate Condition Data
 *
 * This script analyzes the condition data across tables to understand:
 * 1. What condition values exist in binsInventoryActual
 * 2. How many inventoryindex rows could be updated from source tables
 * 3. What normalization is needed for condition codes
 *
 * Run with: npx tsx scripts/investigate-conditions.ts
 */

import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { db } from "../src/lib/db";
import { inventoryindex, binsInventoryActual } from "../src/lib/schema";
import { sql, isNotNull, count, eq } from "drizzle-orm";

async function main() {
  console.log("=".repeat(60));
  console.log("CONDITION DATA FORENSICS REPORT");
  console.log("=".repeat(60));
  console.log();

  // ==========================================
  // PART 1: inventoryindex Analysis
  // ==========================================
  console.log("📊 PART 1: inventoryindex Current State");
  console.log("-".repeat(40));

  // Total items in inventoryindex
  const totalInventory = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(inventoryindex);
  console.log(`Total items in inventoryindex: ${totalInventory[0].count}`);

  // Items with condition data
  const withCondition = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(inventoryindex)
    .where(isNotNull(inventoryindex.condition));
  console.log(`Items WITH condition data: ${withCondition[0].count}`);

  // Items without condition data
  const withoutCondition = Number(totalInventory[0].count) - Number(withCondition[0].count);
  console.log(`Items WITHOUT condition data: ${withoutCondition}`);

  // Condition value breakdown in inventoryindex
  console.log("\nCondition values in inventoryindex:");
  const conditionBreakdown = await db
    .select({
      condition: inventoryindex.condition,
      count: sql<number>`COUNT(*)`,
    })
    .from(inventoryindex)
    .where(isNotNull(inventoryindex.condition))
    .groupBy(inventoryindex.condition)
    .orderBy(sql`COUNT(*) DESC`);

  for (const row of conditionBreakdown) {
    console.log(`  "${row.condition}": ${row.count}`);
  }

  // ==========================================
  // PART 2: binsInventoryActual Analysis
  // ==========================================
  console.log("\n" + "=".repeat(60));
  console.log("📦 PART 2: binsInventoryActual Source Table");
  console.log("-".repeat(40));

  // Total items in binsInventoryActual
  const totalBins = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(binsInventoryActual);
  console.log(`Total items in binsInventoryActual: ${totalBins[0].count}`);

  // Items with condition data
  const binsWithCondition = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(binsInventoryActual)
    .where(isNotNull(binsInventoryActual.condition));
  console.log(`Items WITH condition data: ${binsWithCondition[0].count}`);

  // Condition value breakdown in binsInventoryActual
  console.log("\nCondition values in binsInventoryActual (top 30):");
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

  for (const row of binsConditionBreakdown) {
    console.log(`  "${row.condition}": ${row.count}`);
  }

  // ==========================================
  // PART 3: Match Rate Analysis
  // ==========================================
  console.log("\n" + "=".repeat(60));
  console.log("🔗 PART 3: Match Rate Analysis");
  console.log("-".repeat(40));

  // How many inventoryindex items have matching part numbers in binsInventoryActual?
  const matchQuery = await db.execute(sql`
    SELECT COUNT(DISTINCT i.IndexId) as match_count
    FROM inventoryindex i
    INNER JOIN bins_inventory_actual b
      ON TRIM(UPPER(i.PartNumber)) = TRIM(UPPER(b.PART_NUMBER))
    WHERE b.CONDITION IS NOT NULL AND b.CONDITION != ''
  `);

  const matchCount = (matchQuery as any)[0]?.match_count || 0;
  console.log(`inventoryindex items matchable to binsInventoryActual with condition: ${matchCount}`);
  console.log(`Match rate: ${((matchCount / Number(totalInventory[0].count)) * 100).toFixed(1)}%`);

  // ==========================================
  // PART 4: Sample Matches
  // ==========================================
  console.log("\n" + "=".repeat(60));
  console.log("🔍 PART 4: Sample Matches (first 10)");
  console.log("-".repeat(40));

  const sampleMatches = await db.execute(sql`
    SELECT
      i.IndexId,
      i.PartNumber as inv_pn,
      i.Condition as inv_condition,
      b.PART_NUMBER as bins_pn,
      b.CONDITION as bins_condition
    FROM inventoryindex i
    INNER JOIN bins_inventory_actual b
      ON TRIM(UPPER(i.PartNumber)) = TRIM(UPPER(b.PART_NUMBER))
    WHERE b.CONDITION IS NOT NULL AND b.CONDITION != ''
    LIMIT 10
  `);

  for (const row of sampleMatches as any[]) {
    console.log(`  ID ${row.IndexId}: "${row.inv_pn}"`);
    console.log(`    Current condition: "${row.inv_condition || 'NULL'}"`);
    console.log(`    Source condition:  "${row.bins_condition}"`);
    console.log();
  }

  // ==========================================
  // PART 5: Normalization Analysis
  // ==========================================
  console.log("=".repeat(60));
  console.log("🏷️ PART 5: Condition Code Normalization");
  console.log("-".repeat(40));

  // Count by normalized codes
  const normalizationSample = await db.execute(sql`
    SELECT
      b.CONDITION as raw_condition,
      COUNT(*) as count,
      CASE
        WHEN UPPER(b.CONDITION) LIKE '%NE%' OR UPPER(b.CONDITION) LIKE '%NEW%' THEN 'NE'
        WHEN UPPER(b.CONDITION) LIKE '%OH%' OR UPPER(b.CONDITION) LIKE '%OVERHAUL%' THEN 'OH'
        WHEN UPPER(b.CONDITION) LIKE '%SV%' OR UPPER(b.CONDITION) LIKE '%SERVICEABLE%' THEN 'SV'
        WHEN UPPER(b.CONDITION) LIKE '%AR%' OR UPPER(b.CONDITION) LIKE '%AS REMOVED%' OR UPPER(b.CONDITION) LIKE '%AS-REMOVED%' THEN 'AR'
        WHEN UPPER(b.CONDITION) LIKE '%RP%' OR UPPER(b.CONDITION) LIKE '%REPAIR%' THEN 'RP'
        ELSE 'OTHER'
      END as normalized
    FROM bins_inventory_actual b
    WHERE b.CONDITION IS NOT NULL AND b.CONDITION != ''
    GROUP BY b.CONDITION
    ORDER BY count DESC
    LIMIT 50
  `);

  console.log("Raw condition → Normalized code (top 50):");
  for (const row of normalizationSample as any[]) {
    console.log(`  "${row.raw_condition}" (${row.count}) → ${row.normalized}`);
  }

  // Summary by normalized code
  console.log("\nSummary by normalized code:");
  const normalizedSummary = await db.execute(sql`
    SELECT
      CASE
        WHEN UPPER(b.CONDITION) LIKE '%NE%' OR UPPER(b.CONDITION) LIKE '%NEW%' THEN 'NE'
        WHEN UPPER(b.CONDITION) LIKE '%OH%' OR UPPER(b.CONDITION) LIKE '%OVERHAUL%' THEN 'OH'
        WHEN UPPER(b.CONDITION) LIKE '%SV%' OR UPPER(b.CONDITION) LIKE '%SERVICEABLE%' THEN 'SV'
        WHEN UPPER(b.CONDITION) LIKE '%AR%' OR UPPER(b.CONDITION) LIKE '%AS REMOVED%' OR UPPER(b.CONDITION) LIKE '%AS-REMOVED%' THEN 'AR'
        WHEN UPPER(b.CONDITION) LIKE '%RP%' OR UPPER(b.CONDITION) LIKE '%REPAIR%' THEN 'RP'
        ELSE 'OTHER'
      END as normalized,
      COUNT(*) as count
    FROM bins_inventory_actual b
    WHERE b.CONDITION IS NOT NULL AND b.CONDITION != ''
    GROUP BY normalized
    ORDER BY count DESC
  `);

  for (const row of normalizedSummary as any[]) {
    console.log(`  ${row.normalized}: ${row.count}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ FORENSICS COMPLETE");
  console.log("=".repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
