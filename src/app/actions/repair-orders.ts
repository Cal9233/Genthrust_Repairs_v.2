"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  active,
  roStatusHistory,
  roActivityLog,
  roRelationsTable,
  users,
  type RoStatusHistory,
  type RoActivityLog,
  type RoRelation,
} from "@/lib/schema";
import { eq, or, desc, and, sql, max } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk/v3";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Default source sheet name (from env or fallback)
const DEFAULT_SOURCE_SHEET = process.env.EXCEL_WORKSHEET_NAME ?? "Active";

// Type for repair order updates
export type RepairOrderUpdateFields = Partial<
  Omit<typeof active.$inferInsert, "id" | "createdAt">
>;

// Related RO with relation info
export interface RelatedRO {
  relationId: number;
  ro: number | null;
  shopName: string | null;
  part: string | null;
  relationType: string;
}

// Status history entry with user info
export interface StatusHistoryEntry {
  id: number;
  repairOrderId: number;
  status: string;
  previousStatus: string | null;
  changedBy: string | null;
  changedAt: Date;
  notes: string | null;
  changedByName?: string | null;
}

// Activity log entry with user info
export interface ActivityLogEntry {
  id: number;
  repairOrderId: number;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  userId: string | null;
  createdAt: Date;
  userName?: string | null;
}

/**
 * Create a new repair order
 *
 * Generates the next RO number, inserts into MySQL, and triggers Excel sync.
 * Follows Write-Behind pattern: MySQL -> Trigger.dev -> Excel
 */
export async function createRepairOrder(data: {
  shopName: string;
  part: string;
  serial?: string;
  partDescription?: string;
  reqWork?: string;
  estimatedCost?: number;
}): Promise<Result<{ id: number; ro: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate required fields
    if (!data.shopName || !data.part) {
      return { success: false, error: "Shop name and part number are required" };
    }

    // Generate next RO number (max + 1)
    const [maxRO] = await db
      .select({ maxRo: max(active.ro) })
      .from(active);

    const nextRO = Math.floor((maxRO?.maxRo ?? 0) + 1);

    // Prepare the insert data
    const today = new Date().toISOString().split("T")[0];
    const insertData = {
      ro: nextRO,
      dateMade: today,
      shopName: data.shopName,
      part: data.part,
      serial: data.serial ?? null,
      partDescription: data.partDescription ?? null,
      reqWork: data.reqWork ?? null,
      estimatedCost: data.estimatedCost ?? null,
      curentStatus: "WAITING QUOTE",
      curentStatusDate: today,
      lastDateUpdated: today,
      nextDateToUpdate: today, // Will be updated by lifecycle flow
    };

    // Insert into MySQL
    const [result] = await db.insert(active).values(insertData).$returningId() as [{ id: number }];

    // Log activity
    await db.insert(roActivityLog).values({
      repairOrderId: result.id,
      action: "CREATE",
      newValue: `Created RO #${nextRO}`,
      userId: session.user.id,
    });

    // Trigger Excel sync
    try {
      await tasks.trigger("sync-repair-orders", {
        userId: session.user.id,
        repairOrderIds: [result.id],
      });
    } catch {
      // Excel sync failure shouldn't fail the create
      console.error("Failed to trigger Excel sync for new RO");
    }

    revalidatePath("/dashboard");

    return { success: true, data: { id: result.id, ro: nextRO } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create repair order",
    };
  }
}

/**
 * Updates a repair order's status in MySQL and optionally triggers
 * the ro-lifecycle-flow task for specific statuses.
 *
 * If destinationSheet is provided, also triggers the move-ro-sheet task
 * to move the RO from Active sheet to the destination sheet (NET, Paid, Returns).
 *
 * Per CLAUDE.md Write-Behind Pattern:
 * UI -> Server Action -> MySQL Write -> Push Job to Trigger.dev
 */
export async function updateRepairOrderStatus(
  repairOrderId: number,
  newStatus: string,
  destinationSheet?: string
): Promise<Result<{ runId?: string; moveRunId?: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Fetch current status for comparison
    const [currentRO] = await db
      .select({ curentStatus: active.curentStatus })
      .from(active)
      .where(eq(active.id, repairOrderId))
      .limit(1);

    if (!currentRO) {
      return { success: false, error: "Repair order not found" };
    }

    const oldStatus = currentRO.curentStatus ?? "";

    // Skip if status hasn't changed (optimization to avoid unnecessary syncs)
    if (newStatus === oldStatus) {
      return { success: true, data: {} };
    }

    // Update status in MySQL
    await db
      .update(active)
      .set({
        curentStatus: newStatus,
        curentStatusDate: new Date().toISOString().split("T")[0],
        lastDateUpdated: new Date().toISOString().split("T")[0],
      })
      .where(eq(active.id, repairOrderId));

    // Sync to Excel (Write-Behind pattern per CLAUDE.md)
    try {
      await tasks.trigger("sync-repair-orders", {
        userId: session.user.id,
        repairOrderIds: [repairOrderId],
      });
    } catch {
      // Excel sync failure shouldn't fail the status update
      console.error("Failed to trigger Excel sync for status update");
    }

    // Revalidate dashboard to refresh table data
    revalidatePath("/dashboard");

    // Statuses that trigger the follow-up flow
    const TRACKED_STATUSES = [
      "WAITING QUOTE",
      "APPROVED",
      "IN WORK",
      "IN PROGRESS",
      "SHIPPED",
      "IN TRANSIT",
    ];

    // Trigger ro-lifecycle-flow for tracked statuses
    // This starts the durable wait + email drafting flow
    let runId: string | undefined;
    let moveRunId: string | undefined;
    const normalizedNew = newStatus.toUpperCase().trim();
    const normalizedOld = oldStatus.toUpperCase().trim();

    if (TRACKED_STATUSES.includes(normalizedNew) && normalizedNew !== normalizedOld) {
      const handle = await tasks.trigger("handle-ro-status-change", {
        repairOrderId,
        newStatus: normalizedNew,
        oldStatus: normalizedOld,
        userId: session.user.id,
      });
      runId = handle.id;
    }

    // If destinationSheet is provided, trigger the move-ro-sheet task
    // This moves the RO from Active sheet to NET/Paid/Returns
    if (destinationSheet) {
      const moveHandle = await tasks.trigger("move-ro-sheet", {
        userId: session.user.id,
        roId: repairOrderId,
        fromSheet: DEFAULT_SOURCE_SHEET,
        toSheet: destinationSheet,
      });
      moveRunId = moveHandle.id;
    }

    return { success: true, data: { runId, moveRunId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}

/**
 * Update a repair order with any fields
 * Records activity log for each changed field
 * Follows Write-Behind pattern: MySQL -> Trigger.dev -> Excel
 */
export async function updateRepairOrder(
  repairOrderId: number,
  fields: RepairOrderUpdateFields
): Promise<Result<{ runId?: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Fetch current RO for comparison
    const [currentRO] = await db
      .select()
      .from(active)
      .where(eq(active.id, repairOrderId))
      .limit(1);

    if (!currentRO) {
      return { success: false, error: "Repair order not found" };
    }

    // Track which fields changed for activity log
    const changedFields: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    for (const [key, newValue] of Object.entries(fields)) {
      const oldValue = currentRO[key as keyof typeof currentRO];
      if (String(oldValue ?? "") !== String(newValue ?? "")) {
        changedFields.push({
          field: key,
          oldValue: oldValue != null ? String(oldValue) : null,
          newValue: newValue != null ? String(newValue) : null,
        });
      }
    }

    // Update the repair order
    await db
      .update(active)
      .set({
        ...fields,
        lastDateUpdated: new Date().toISOString().split("T")[0],
      })
      .where(eq(active.id, repairOrderId));

    // Log each field change
    if (changedFields.length > 0) {
      await db.insert(roActivityLog).values(
        changedFields.map((change) => ({
          repairOrderId,
          action: "UPDATE",
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          userId: session.user.id,
        }))
      );
    }

    // If status changed, also record to status history
    if (fields.curentStatus && fields.curentStatus !== currentRO.curentStatus) {
      await db.insert(roStatusHistory).values({
        repairOrderId,
        status: fields.curentStatus,
        previousStatus: currentRO.curentStatus,
        changedBy: session.user.id,
      });
    }

    // Trigger Excel sync via Trigger.dev
    let runId: string | undefined;
    try {
      const handle = await tasks.trigger("sync-repair-orders", {
        batchId: `single-${repairOrderId}-${Date.now()}`,
        repairOrderIds: [repairOrderId],
      });
      runId = handle.id;
    } catch {
      // Excel sync failure shouldn't fail the update
      console.error("Failed to trigger Excel sync");
    }

    revalidatePath("/dashboard");

    return { success: true, data: { runId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update repair order",
    };
  }
}

/**
 * Get status history for a repair order
 */
export async function getROStatusHistory(
  repairOrderId: number
): Promise<Result<StatusHistoryEntry[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const history = await db
      .select({
        id: roStatusHistory.id,
        repairOrderId: roStatusHistory.repairOrderId,
        status: roStatusHistory.status,
        previousStatus: roStatusHistory.previousStatus,
        changedBy: roStatusHistory.changedBy,
        changedAt: roStatusHistory.changedAt,
        notes: roStatusHistory.notes,
        changedByName: users.name,
      })
      .from(roStatusHistory)
      .leftJoin(users, eq(roStatusHistory.changedBy, users.id))
      .where(eq(roStatusHistory.repairOrderId, repairOrderId))
      .orderBy(desc(roStatusHistory.changedAt));

    return { success: true, data: history };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch status history",
    };
  }
}

/**
 * Get activity log for a repair order
 */
export async function getROActivityLog(
  repairOrderId: number
): Promise<Result<ActivityLogEntry[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const activities = await db
      .select({
        id: roActivityLog.id,
        repairOrderId: roActivityLog.repairOrderId,
        action: roActivityLog.action,
        field: roActivityLog.field,
        oldValue: roActivityLog.oldValue,
        newValue: roActivityLog.newValue,
        userId: roActivityLog.userId,
        createdAt: roActivityLog.createdAt,
        userName: users.name,
      })
      .from(roActivityLog)
      .leftJoin(users, eq(roActivityLog.userId, users.id))
      .where(eq(roActivityLog.repairOrderId, repairOrderId))
      .orderBy(desc(roActivityLog.createdAt));

    return { success: true, data: activities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch activity log",
    };
  }
}

/**
 * Log an activity for a repair order (helper for other actions)
 */
export async function logROActivity(
  repairOrderId: number,
  action: string,
  field?: string,
  oldValue?: string,
  newValue?: string
): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await db.insert(roActivityLog).values({
      repairOrderId,
      action,
      field: field ?? null,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      userId: session.user.id,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to log activity",
    };
  }
}

/**
 * Append a note to a repair order
 * Handles the JSON HISTORY format used in the notes column
 */
export async function appendRONote(
  repairOrderId: number,
  note: string
): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Fetch current notes
    const [currentRO] = await db
      .select({ notes: active.notes })
      .from(active)
      .where(eq(active.id, repairOrderId))
      .limit(1);

    if (!currentRO) {
      return { success: false, error: "Repair order not found" };
    }

    const currentNotes = currentRO.notes ?? "";
    const timestamp = new Date().toISOString();
    const userName = session.user.name ?? session.user.email ?? "Unknown";

    // Format: [TIMESTAMP] USER: Note text
    const newNoteEntry = `[${timestamp}] ${userName}: ${note}`;

    // Append to existing notes (simple format for now)
    // If the notes column has the HISTORY format, we append after it
    let updatedNotes: string;
    if (currentNotes.includes("HISTORY:") || currentNotes.includes("|NOTES:")) {
      // Existing HISTORY format - append to NOTES section
      if (currentNotes.includes("|NOTES:")) {
        updatedNotes = currentNotes + "\n" + newNoteEntry;
      } else {
        updatedNotes = currentNotes + "|NOTES:" + newNoteEntry;
      }
    } else if (currentNotes.trim()) {
      // Plain text notes - just append
      updatedNotes = currentNotes + "\n" + newNoteEntry;
    } else {
      // Empty notes
      updatedNotes = newNoteEntry;
    }

    // Update notes
    await db
      .update(active)
      .set({ notes: updatedNotes })
      .where(eq(active.id, repairOrderId));

    // Log activity
    await db.insert(roActivityLog).values({
      repairOrderId,
      action: "NOTE_ADDED",
      field: "notes",
      oldValue: currentNotes || null,
      newValue: note,
      userId: session.user.id,
    });

    revalidatePath("/dashboard");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to append note",
    };
  }
}

/**
 * Get related ROs for a repair order
 * Fetches both directions (where this RO is source or target)
 */
export async function getRelatedROs(
  repairOrderId: number
): Promise<Result<RelatedRO[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get relations where this RO is the source
    const sourceRelations = await db
      .select()
      .from(roRelationsTable)
      .where(eq(roRelationsTable.sourceRoId, repairOrderId));

    // Get relations where this RO is the target
    const targetRelations = await db
      .select()
      .from(roRelationsTable)
      .where(eq(roRelationsTable.targetRoId, repairOrderId));

    // Collect all related RO IDs
    const relatedIds = new Set<number>();
    for (const rel of sourceRelations) {
      relatedIds.add(rel.targetRoId);
    }
    for (const rel of targetRelations) {
      relatedIds.add(rel.sourceRoId);
    }

    if (relatedIds.size === 0) {
      return { success: true, data: [] };
    }

    // Fetch the related ROs
    const relatedROsData = await db
      .select()
      .from(active)
      .where(sql`${active.id} IN (${[...relatedIds].join(",")})`);

    // Build the result
    const result: RelatedRO[] = [];

    for (const rel of sourceRelations) {
      const ro = relatedROsData.find((r) => r.id === rel.targetRoId);
      if (ro) {
        result.push({
          relationId: rel.id,
          ro: ro.ro,
          shopName: ro.shopName,
          part: ro.part,
          relationType: rel.relationType,
        });
      }
    }

    for (const rel of targetRelations) {
      const ro = relatedROsData.find((r) => r.id === rel.sourceRoId);
      if (ro) {
        result.push({
          relationId: rel.id,
          ro: ro.ro,
          shopName: ro.shopName,
          part: ro.part,
          relationType: rel.relationType,
        });
      }
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch related ROs",
    };
  }
}

/**
 * Link two ROs together
 */
export async function linkROs(
  sourceRoId: number,
  targetRoId: number,
  relationType: string
): Promise<Result<{ id: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if relation already exists
    const [existing] = await db
      .select()
      .from(roRelationsTable)
      .where(
        or(
          and(
            eq(roRelationsTable.sourceRoId, sourceRoId),
            eq(roRelationsTable.targetRoId, targetRoId)
          ),
          and(
            eq(roRelationsTable.sourceRoId, targetRoId),
            eq(roRelationsTable.targetRoId, sourceRoId)
          )
        )
      )
      .limit(1);

    if (existing) {
      return { success: false, error: "Relation already exists" };
    }

    // Create the relation
    const [newRelation] = await db
      .insert(roRelationsTable)
      .values({
        sourceRoId,
        targetRoId,
        relationType,
        createdBy: session.user.id,
      })
      .$returningId();

    // Log activity on both ROs
    await db.insert(roActivityLog).values([
      {
        repairOrderId: sourceRoId,
        action: "RELATION_ADDED",
        newValue: `Linked to RO ${targetRoId} (${relationType})`,
        userId: session.user.id,
      },
      {
        repairOrderId: targetRoId,
        action: "RELATION_ADDED",
        newValue: `Linked from RO ${sourceRoId} (${relationType})`,
        userId: session.user.id,
      },
    ]);

    return { success: true, data: { id: newRelation.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to link ROs",
    };
  }
}

/**
 * Unlink two ROs
 */
export async function unlinkROs(relationId: number): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get the relation first to log activity
    const [relation] = await db
      .select()
      .from(roRelationsTable)
      .where(eq(roRelationsTable.id, relationId))
      .limit(1);

    if (!relation) {
      return { success: false, error: "Relation not found" };
    }

    // Delete the relation
    await db
      .delete(roRelationsTable)
      .where(eq(roRelationsTable.id, relationId));

    // Log activity on both ROs
    await db.insert(roActivityLog).values([
      {
        repairOrderId: relation.sourceRoId,
        action: "RELATION_REMOVED",
        oldValue: `Unlinked from RO ${relation.targetRoId}`,
        userId: session.user.id,
      },
      {
        repairOrderId: relation.targetRoId,
        action: "RELATION_REMOVED",
        oldValue: `Unlinked from RO ${relation.sourceRoId}`,
        userId: session.user.id,
      },
    ]);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unlink ROs",
    };
  }
}

/**
 * Search ROs for linking (helper for the UI)
 */
export async function searchROsForLinking(
  query: string,
  excludeId: number
): Promise<Result<typeof active.$inferSelect[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    const results = await db
      .select()
      .from(active)
      .where(
        and(
          sql`${active.id} != ${excludeId}`,
          or(
            sql`CAST(${active.ro} AS CHAR) LIKE ${`%${query}%`}`,
            sql`${active.shopName} LIKE ${`%${query}%`}`,
            sql`${active.part} LIKE ${`%${query}%`}`
          )
        )
      )
      .limit(10);

    return { success: true, data: results };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search ROs",
    };
  }
}
