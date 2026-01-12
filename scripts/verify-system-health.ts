/**
 * System Health Check Script
 * 
 * Simulates a full user journey to verify the GenThrust RO Tracker system:
 * 1. Creates a test Repair Order (direct DB operation to simulate createRepairOrder)
 * 2. Verifies dashboard stats reflect the creation
 * 3. Updates the RO status (direct DB operation to simulate updateRepairOrderStatus)
 * 4. Verifies stats reflect the update
 * 5. Deletes the test RO
 * 6. Verifies cleanup
 * 
 * NOTE: This script uses direct database operations to simulate server actions
 * because server actions require Next.js request context with authentication cookies.
 * The script validates the same data logic that server actions execute.
 * 
 * Run with: npx tsx scripts/verify-system-health.ts
 */

// Load environment variables FIRST (before any imports that read env vars)
import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic import AFTER dotenv runs (to ensure env vars are loaded)
async function main() {
  const { db, pool } = await import("../src/lib/db");
  const { active } = await import("../src/lib/schema");
  const { eq, max, notInArray } = await import("drizzle-orm");
  const { getDashboardStats } = await import("../src/app/actions/dashboard");
  const { ARCHIVED_STATUSES } = await import("../src/lib/constants/statuses");
  const { isWaitingQuote } = await import("../src/lib/constants/statuses");

  // Test RO number - use a high number unlikely to conflict
  const TEST_RO_NUMBER = 99999;
  const TEST_SHOP_NAME = "TEST HEALTH CHECK SHOP";
  const TEST_PART = "TEST-PART-HEALTH-CHECK";

  interface TestResult {
    step: string;
    success: boolean;
    error?: string;
    details?: string;
  }

  const results: TestResult[] = [];
  let testROId: number | null = null;
  let initialStats: { totalActive: number; waitingQuote: number } | null = null;

  console.log("=".repeat(60));
  console.log("GenThrust RO Tracker - System Health Check");
  console.log("=".repeat(60));
  console.log();

  try {
    // Step 0: Get initial dashboard stats
    console.log("Step 0: Getting initial dashboard stats...");
    const initialStatsResult = await getDashboardStats();
    if (!initialStatsResult.success) {
      throw new Error(`Failed to get initial stats: ${initialStatsResult.error}`);
    }
    initialStats = {
      totalActive: initialStatsResult.data.totalActive,
      waitingQuote: initialStatsResult.data.waitingQuote,
    };
    console.log(`✓ Initial stats - Total Active: ${initialStats.totalActive}, Waiting Quote: ${initialStats.waitingQuote}`);
    results.push({ step: "Get initial stats", success: true, details: `Total Active: ${initialStats.totalActive}` });
    console.log();

    // Step 1: Check if test RO already exists and clean it up
    console.log("Step 1: Checking for existing test RO...");
    const existingRO = await db
      .select()
      .from(active)
      .where(eq(active.ro, TEST_RO_NUMBER))
      .limit(1);

    if (existingRO.length > 0) {
      console.log(`⚠ Found existing test RO #${TEST_RO_NUMBER}, deleting it first...`);
      await db.delete(active).where(eq(active.id, existingRO[0].id));
      console.log("✓ Cleaned up existing test RO");
    } else {
      console.log("✓ No existing test RO found");
    }
    results.push({ step: "Cleanup existing test RO", success: true });
    console.log();

    // Step 2: Create test Repair Order (simulating createRepairOrder server action)
    console.log("Step 2: Creating test Repair Order...");
    const today = new Date().toISOString().split("T")[0];
    
    // Insert test RO directly (simulating createRepairOrder logic)
    await db.insert(active).values({
      ro: TEST_RO_NUMBER,
      dateMade: today,
      shopName: TEST_SHOP_NAME,
      part: TEST_PART,
      curentStatus: "WAITING QUOTE",
      curentStatusDate: today,
      lastDateUpdated: today,
      nextDateToUpdate: today,
    });

    // Fetch the created RO to get its ID
    const [createdRO] = await db
      .select()
      .from(active)
      .where(eq(active.ro, TEST_RO_NUMBER))
      .limit(1);

    if (!createdRO) {
      throw new Error("Failed to create test RO - could not retrieve created record");
    }

    testROId = createdRO.id;
    console.log(`✓ Created test RO #${TEST_RO_NUMBER} (ID: ${testROId})`);
    results.push({
      step: "Create test RO",
      success: true,
      details: `RO #${TEST_RO_NUMBER}, ID: ${testROId}`,
    });
    console.log();

    // Step 3: Verify dashboard stats increased
    console.log("Step 3: Verifying dashboard stats after creation...");
    // Wait a brief moment for any async operations
    await new Promise((resolve) => setTimeout(resolve, 500));

    const statsAfterCreateResult = await getDashboardStats();
    if (!statsAfterCreateResult.success) {
      throw new Error(`Failed to get stats after create: ${statsAfterCreateResult.error}`);
    }

    const expectedTotalActive = initialStats!.totalActive + 1;
    const actualTotalActive = statsAfterCreateResult.data.totalActive;

    if (actualTotalActive !== expectedTotalActive) {
      throw new Error(
        `Stats mismatch: Expected Total Active to be ${expectedTotalActive}, got ${actualTotalActive}`
      );
    }

    const expectedWaitingQuote = initialStats!.waitingQuote + 1;
    const actualWaitingQuote = statsAfterCreateResult.data.waitingQuote;

    if (actualWaitingQuote !== expectedWaitingQuote) {
      throw new Error(
        `Stats mismatch: Expected Waiting Quote to be ${expectedWaitingQuote}, got ${actualWaitingQuote}`
      );
    }

    console.log(`✓ Dashboard stats verified - Total Active: ${actualTotalActive} (expected ${expectedTotalActive})`);
    console.log(`✓ Waiting Quote count: ${actualWaitingQuote} (expected ${expectedWaitingQuote})`);
    results.push({
      step: "Verify stats after create",
      success: true,
      details: `Total Active: ${actualTotalActive}, Waiting Quote: ${actualWaitingQuote}`,
    });
    console.log();

    // Step 4: Update status (simulating updateRepairOrderStatus server action)
    console.log("Step 4: Updating RO status to 'APPROVED'...");
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    // Update status directly (simulating updateRepairOrderStatus logic)
    await db
      .update(active)
      .set({
        curentStatus: "APPROVED",
        curentStatusDate: today,
        lastDateUpdated: today,
        nextDateToUpdate: nextWeek,
      })
      .where(eq(active.id, testROId));

    console.log("✓ Status updated to APPROVED");
    results.push({ step: "Update RO status", success: true, details: "Changed to APPROVED" });
    console.log();

    // Step 5: Verify stats reflect status change
    console.log("Step 5: Verifying dashboard stats after status update...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const statsAfterUpdateResult = await getDashboardStats();
    if (!statsAfterUpdateResult.success) {
      throw new Error(`Failed to get stats after update: ${statsAfterUpdateResult.error}`);
    }

    // Waiting Quote should decrease by 1 (we changed from WAITING QUOTE to APPROVED)
    const expectedWaitingQuoteAfterUpdate = initialStats!.waitingQuote;
    const actualWaitingQuoteAfterUpdate = statsAfterUpdateResult.data.waitingQuote;

    if (actualWaitingQuoteAfterUpdate !== expectedWaitingQuoteAfterUpdate) {
      throw new Error(
        `Stats mismatch: Expected Waiting Quote to return to ${expectedWaitingQuoteAfterUpdate}, got ${actualWaitingQuoteAfterUpdate}`
      );
    }

    // Total Active should remain the same
    const actualTotalActiveAfterUpdate = statsAfterUpdateResult.data.totalActive;
    if (actualTotalActiveAfterUpdate !== expectedTotalActive) {
      throw new Error(
        `Stats mismatch: Expected Total Active to remain ${expectedTotalActive}, got ${actualTotalActiveAfterUpdate}`
      );
    }

    console.log(`✓ Dashboard stats verified - Total Active: ${actualTotalActiveAfterUpdate}`);
    console.log(`✓ Waiting Quote count: ${actualWaitingQuoteAfterUpdate} (returned to initial)`);
    results.push({
      step: "Verify stats after update",
      success: true,
      details: `Total Active: ${actualTotalActiveAfterUpdate}, Waiting Quote: ${actualWaitingQuoteAfterUpdate}`,
    });
    console.log();

    // Step 6: Delete test RO
    console.log("Step 6: Deleting test Repair Order...");
    await db.delete(active).where(eq(active.id, testROId));
    console.log(`✓ Deleted test RO (ID: ${testROId})`);
    results.push({ step: "Delete test RO", success: true });
    console.log();

    // Step 7: Verify cleanup - stats should return to initial values
    console.log("Step 7: Verifying cleanup - stats should return to initial values...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const statsAfterDeleteResult = await getDashboardStats();
    if (!statsAfterDeleteResult.success) {
      throw new Error(`Failed to get stats after delete: ${statsAfterDeleteResult.error}`);
    }

    const finalTotalActive = statsAfterDeleteResult.data.totalActive;
    if (finalTotalActive !== initialStats!.totalActive) {
      throw new Error(
        `Cleanup verification failed: Expected Total Active to return to ${initialStats!.totalActive}, got ${finalTotalActive}`
      );
    }

    const finalWaitingQuote = statsAfterDeleteResult.data.waitingQuote;
    // Note: We changed status from WAITING QUOTE to APPROVED, so waitingQuote should be back to initial
    if (finalWaitingQuote !== initialStats!.waitingQuote) {
      throw new Error(
        `Cleanup verification failed: Expected Waiting Quote to return to ${initialStats!.waitingQuote}, got ${finalWaitingQuote}`
      );
    }

    console.log(`✓ Cleanup verified - Total Active: ${finalTotalActive} (returned to initial ${initialStats!.totalActive})`);
    console.log(`✓ Waiting Quote: ${finalWaitingQuote} (returned to initial ${initialStats!.waitingQuote})`);
    results.push({
      step: "Verify cleanup",
      success: true,
      details: `Total Active: ${finalTotalActive}, Waiting Quote: ${finalWaitingQuote}`,
    });
    console.log();

    // Summary
    console.log("=".repeat(60));
    console.log("System Health Check Results");
    console.log("=".repeat(60));
    const allPassed = results.every((r) => r.success);
    results.forEach((result) => {
      const icon = result.success ? "✓" : "✗";
      console.log(`${icon} ${result.step}${result.details ? ` - ${result.details}` : ""}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
    console.log("=".repeat(60));

    if (allPassed) {
      console.log("✅ ALL CHECKS PASSED - System is healthy!");
      await pool.end();
      process.exit(0);
    } else {
      console.log("❌ SOME CHECKS FAILED - Review errors above");
      await pool.end();
      process.exit(1);
    }
  } catch (error) {
    console.error();
    console.error("=".repeat(60));
    console.error("SYSTEM HEALTH CHECK FAILED");
    console.error("=".repeat(60));
    console.error("Error:", error instanceof Error ? error.message : String(error));
    console.error();

    // Attempt cleanup if test RO was created
    if (testROId) {
      try {
        console.log("Attempting to clean up test RO...");
        await db.delete(active).where(eq(active.id, testROId));
        console.log("✓ Cleanup successful");
      } catch (cleanupError) {
        console.error("✗ Cleanup failed:", cleanupError);
        console.error(`  Manual cleanup required: DELETE FROM active WHERE id = ${testROId}`);
      }
    }

    await pool.end();
    process.exit(1);
  }
}

// Run the health check
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
