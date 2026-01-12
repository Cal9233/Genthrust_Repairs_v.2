/**
 * Script to add ERP columns to the active table
 * Run with: npx tsx scripts/add-erp-columns.ts
 */

import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding ERP columns to active table...\n");

  try {
    // Check existing columns
    const result = await db.execute(sql`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'active'
      AND COLUMN_NAME IN ('erp_po_id', 'erp_last_sync_at', 'erp_sync_status')
    `);

    const rows = (result as unknown as Array<{COLUMN_NAME: string}>);
    const columnNames = rows.map(r => r.COLUMN_NAME);
    console.log("Existing ERP columns:", columnNames.length ? columnNames : "none");

    // Add missing columns
    if (!columnNames.includes("erp_po_id")) {
      await db.execute(sql`ALTER TABLE active ADD COLUMN erp_po_id varchar(50)`);
      console.log("✓ Added erp_po_id column");
    } else {
      console.log("- erp_po_id already exists");
    }

    if (!columnNames.includes("erp_last_sync_at")) {
      await db.execute(sql`ALTER TABLE active ADD COLUMN erp_last_sync_at varchar(50)`);
      console.log("✓ Added erp_last_sync_at column");
    } else {
      console.log("- erp_last_sync_at already exists");
    }

    if (!columnNames.includes("erp_sync_status")) {
      await db.execute(sql`ALTER TABLE active ADD COLUMN erp_sync_status varchar(20) DEFAULT 'LOCAL_ONLY'`);
      console.log("✓ Added erp_sync_status column");
    } else {
      console.log("- erp_sync_status already exists");
    }

    console.log("\n✅ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
