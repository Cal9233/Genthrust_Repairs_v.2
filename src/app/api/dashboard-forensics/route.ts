/**
 * Dashboard Forensics Endpoint
 *
 * Diagnostic endpoint to verify dashboard stats against actual database data.
 * This helps identify discrepancies between displayed stats and real data.
 */

import { db } from "@/lib/db";
import { active } from "@/lib/schema";
import { sql, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { parseDate } from "@/lib/date-utils";
import { ARCHIVED_STATUSES, isWaitingQuote, isInWork, isShipped, isApproved } from "@/lib/constants/statuses";

export async function GET() {
  try {
    // 1. Get all records - for total count
    const totalRecords = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(active);

    // 2. Get active records (same as dashboard)
    const activeRecords = await db
      .select()
      .from(active)
      .where(notInArray(active.curentStatus, [...ARCHIVED_STATUSES]));

    // 3. Status distribution - get all unique statuses and their counts
    const statusDistribution = await db
      .select({
        status: sql<string>`UPPER(TRIM(${active.curentStatus}))`,
        count: sql<number>`COUNT(*)`,
        totalEstimatedCost: sql<string>`CAST(SUM(COALESCE(${active.estimatedCost}, 0)) AS CHAR)`,
      })
      .from(active)
      .groupBy(sql`UPPER(TRIM(${active.curentStatus}))`)
      .orderBy(sql`COUNT(*) DESC`);

    // 4. Count stats from active records (same logic as dashboard)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdue = 0;
    let waitingQuote = 0;
    let valueInWork = 0;
    let inWork = 0;
    let shipped = 0;
    let approved = 0;

    const excludedFromValue = ["PAID", "BER", "RAI", "RETURNED"];

    const dateParseErrors: string[] = [];

    for (const record of activeRecords) {
      const nextUpdateDate = parseDate(record.nextDateToUpdate);

      if (record.nextDateToUpdate && !nextUpdateDate) {
        if (dateParseErrors.length < 5) {
          dateParseErrors.push(record.nextDateToUpdate);
        }
      }

      if (nextUpdateDate && nextUpdateDate < today) {
        overdue++;
      }

      const status = record.curentStatus || "";

      if (isWaitingQuote(status)) {
        waitingQuote++;
      }

      if (isInWork(status)) {
        inWork++;
      }

      if (isShipped(status)) {
        shipped++;
      }

      if (isApproved(status)) {
        approved++;
      }

      if (!excludedFromValue.includes(status) && record.estimatedCost) {
        valueInWork += record.estimatedCost;
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      comparison: {
        header: "Dashboard Stats vs Forensics",
        note: "These should match the dashboard stats exactly",
      },
      forensicsStats: {
        totalInDatabase: Number(totalRecords[0]?.count) || 0,
        totalActive: activeRecords.length,
        overdue,
        waitingQuote,
        valueInWork,
        inWork,
        shipped,
        approved,
        dateParseErrorSamples: dateParseErrors,
      },
      statusDistribution: statusDistribution.map((s) => ({
        status: s.status || "(empty)",
        count: Number(s.count),
        totalEstimatedCost: parseFloat(s.totalEstimatedCost) || 0,
      })),
    });
  } catch (error) {
    console.error("[dashboard-forensics] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
