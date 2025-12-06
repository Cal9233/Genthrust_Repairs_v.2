import { streamText, convertToModelMessages } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { active, inventoryindex } from "@/lib/schema";
import { eq, like, or } from "drizzle-orm";
import { isOverdue, daysSince } from "@/lib/date-utils";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

export const maxDuration = 60; // Allow up to 60s for AI responses

// Tool input schemas
const SearchInventorySchema = z.object({
  query: z.string().describe("Part number or description keyword to search for"),
  limit: z.number().optional().describe("Maximum number of results to return (default 20)"),
});

const GetRepairOrderSchema = z.object({
  roNumber: z.number().optional().describe("Repair order number (e.g., 12345)"),
  roId: z.number().optional().describe("Database ID of the repair order"),
});

const CreateRepairOrderSchema = z.object({
  shopName: z.string().describe("Name of the repair shop"),
  part: z.string().describe("Part number"),
  serial: z.string().optional().describe("Serial number"),
  partDescription: z.string().optional().describe("Description of the part"),
  reqWork: z.string().optional().describe("Requested work/repairs"),
  estimatedCost: z.number().optional().describe("Estimated repair cost in USD"),
});

const UpdateRepairOrderSchema = z.object({
  roNumber: z.number().describe("Repair order number to update"),
  fields: z.object({
    curentStatus: z.string().optional().describe("New status (e.g., 'IN PROCESS', 'COMPLETE', 'WAITING QUOTE')"),
    notes: z.string().optional().describe("Notes to update"),
    estimatedCost: z.number().optional().describe("Updated estimated cost"),
    finalCost: z.number().optional().describe("Final cost"),
    shopRef: z.string().optional().describe("Shop reference number"),
    estimatedDeliveryDate: z.string().optional().describe("Estimated delivery date (YYYY-MM-DD)"),
    terms: z.string().optional().describe("Payment terms (e.g., 'NET 30')"),
  }).describe("Fields to update"),
});

const ArchiveRepairOrderSchema = z.object({
  roNumber: z.number().describe("Repair order number to archive"),
  destination: z.enum(["returns", "paid", "net"]).describe("Destination sheet: 'returns' for returned items, 'paid' for paid items, 'net' for NET 30 terms"),
  reason: z.string().optional().describe("Reason for archiving"),
});

const CreateEmailDraftSchema = z.object({
  roNumber: z.number().describe("Repair order number this email relates to"),
  toAddress: z.string().email().describe("Recipient email address"),
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body content (HTML supported)"),
});

const ListRepairOrdersSchema = z.object({
  status: z.enum(["overdue", "active", "completed", "all"]).optional()
    .describe("Filter by status: 'overdue' (past due), 'active' (in progress), 'completed', or 'all'"),
  shopName: z.string().optional()
    .describe("Filter by shop name (case-insensitive partial match)"),
  limit: z.number().optional()
    .describe("Maximum results to return (default 20)"),
});

export async function POST(req: Request) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  // 2. Parse messages and convert UIMessage[] to ModelMessage[]
  const { messages } = await req.json();
  const modelMessages = convertToModelMessages(messages);

  // 3. Stream with hybrid tools
  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxOutputTokens: 2048,
    system: `You are an AI assistant for GenThrust, an aviation parts and repair tracking company.

Your capabilities:
- Search the inventory database by part number or description
- Look up repair order (RO) details by RO number or database ID
- List and filter repair orders (by status: overdue/active/completed/all, by shop name)
- Create new repair orders
- Update existing repair orders (status, notes, costs, dates, etc.)
- Archive repair orders (move to Returns, Paid, or NET sheets)
- Create email drafts for follow-ups (saved to notification queue for user approval)

Guidelines:
- Be concise and professional
- When presenting inventory results, summarize key details (part number, quantity, location, condition)
- When presenting repair orders, highlight status, shop, part info, and estimated dates
- If no results are found, suggest alternative searches
- Format responses in markdown when helpful for readability
- When creating or modifying records, confirm the action and show key details
- Email drafts are NOT sent automatically - they are saved to the notification queue for user review
- All changes are automatically synced to the Excel workbook
- Write operations (create, update, archive, email) are queued for background processing - confirm they've been queued`,
    messages: modelMessages,
    tools: {
      // ============================================
      // READ TOOLS - Direct DB (fast, inline)
      // ============================================
      search_inventory: {
        description:
          "Search the inventory index by part number or description. Returns matching parts with quantity, location, and condition.",
        inputSchema: SearchInventorySchema,
        execute: async ({ query, limit = 20 }: z.infer<typeof SearchInventorySchema>) => {
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
            .limit(limit ?? 20);

          return {
            items: results,
            count: results.length,
          };
        },
      },

      get_repair_order: {
        description:
          "Look up repair order details by RO number or database ID. Returns full RO information including status, shop, costs, and dates.",
        inputSchema: GetRepairOrderSchema,
        execute: async ({ roNumber, roId }: z.infer<typeof GetRepairOrderSchema>) => {
          let results;

          if (roId) {
            results = await db.select().from(active).where(eq(active.id, roId));
          } else if (roNumber) {
            results = await db.select().from(active).where(eq(active.ro, roNumber));
          } else {
            return { repairOrder: null, error: "Must provide roNumber or roId" };
          }

          return { repairOrder: results[0] ?? null };
        },
      },

      list_repair_orders: {
        description:
          "List repair orders with optional filters. Can filter by status (overdue/active/completed/all) and shop name. Returns RO number, shop, part, status, and days info. Sorted by most overdue first.",
        inputSchema: ListRepairOrdersSchema,
        execute: async ({ status = "all", shopName, limit = 20 }: z.infer<typeof ListRepairOrdersSchema>) => {
          // Define incomplete vs complete statuses
          const INCOMPLETE_STATUSES = [
            "WAITING QUOTE", "APPROVED", "IN WORK", "IN PROGRESS",
            "SHIPPED", "IN TRANSIT", "PENDING"
          ];
          const COMPLETE_STATUSES = ["COMPLETE", "RETURNED", "PAID", "NET"];

          // Fetch ROs with optional shop filter
          const allROs = shopName
            ? await db.select().from(active).where(like(active.shopName, `%${shopName}%`))
            : await db.select().from(active);

          // Filter based on status
          let filteredROs = allROs;

          if (status === "overdue") {
            // Overdue = past estimated delivery AND incomplete
            filteredROs = allROs.filter((ro) => {
              const isIncomplete = INCOMPLETE_STATUSES.some(s =>
                ro.curentStatus?.toUpperCase().includes(s)
              );
              return isIncomplete && isOverdue(ro.estimatedDeliveryDate);
            });
          } else if (status === "active") {
            // Active = any incomplete status
            filteredROs = allROs.filter((ro) =>
              INCOMPLETE_STATUSES.some(s => ro.curentStatus?.toUpperCase().includes(s))
            );
          } else if (status === "completed") {
            // Completed = any complete status
            filteredROs = allROs.filter((ro) =>
              COMPLETE_STATUSES.some(s => ro.curentStatus?.toUpperCase().includes(s))
            );
          }
          // "all" returns everything

          // Map to response format
          const results = filteredROs
            .map((ro) => ({
              id: ro.id,
              roNumber: ro.ro,
              shopName: ro.shopName,
              part: ro.part,
              serial: ro.serial,
              status: ro.curentStatus,
              estimatedDeliveryDate: ro.estimatedDeliveryDate,
              daysOverdue: isOverdue(ro.estimatedDeliveryDate)
                ? daysSince(ro.estimatedDeliveryDate) || 0
                : 0,
              nextFollowUp: ro.nextDateToUpdate,
            }))
            .sort((a, b) => {
              // Sort by days overdue (most overdue first)
              if (a.daysOverdue !== b.daysOverdue) {
                return b.daysOverdue - a.daysOverdue;
              }
              return 0;
            })
            .slice(0, limit);

          // Format as markdown for display in chat
          if (results.length === 0) {
            return `No repair orders found matching filter: ${status}${shopName ? `, shop: "${shopName}"` : ""}`;
          }

          const header = `**Found ${filteredROs.length} repair orders** (showing ${results.length}):\n\n`;
          const list = results
            .map((ro, i) =>
              `${i + 1}. **RO #${ro.roNumber}** - ${ro.shopName}\n` +
              `   Part: ${ro.part}${ro.serial ? ` (S/N: ${ro.serial})` : ""} | Status: ${ro.status}\n` +
              `   ${ro.daysOverdue > 0 ? `⚠️ ${ro.daysOverdue} days overdue` : "✓ On track"}`
            )
            .join("\n\n");

          return header + list;
        },
      },

      // ============================================
      // WRITE TOOLS - Fire-and-forget to Trigger.dev
      // ============================================
      create_repair_order: {
        description:
          "Create a new repair order. Requires shop name and part number. Automatically syncs to Excel. Returns immediately with confirmation.",
        inputSchema: CreateRepairOrderSchema,
        execute: async (params: z.infer<typeof CreateRepairOrderSchema>) => {
          await tasks.trigger("ai-tool-create-repair-order", { userId, ...params });
          return `✓ Queued: Creating RO for ${params.part} at ${params.shopName}. It will appear in the dashboard shortly.`;
        },
      },

      update_repair_order: {
        description:
          "Update fields on an existing repair order. Can update status, notes, costs, dates, and more. Changes sync to Excel automatically.",
        inputSchema: UpdateRepairOrderSchema,
        execute: async ({ roNumber, fields }: z.infer<typeof UpdateRepairOrderSchema>) => {
          await tasks.trigger("ai-tool-update-repair-order", { userId, roNumber, fields });
          const changedFields = Object.keys(fields).join(", ");
          return `✓ Queued: Updating RO #${roNumber} (${changedFields}). Changes will sync to Excel shortly.`;
        },
      },

      archive_repair_order: {
        description:
          "Archive a repair order by moving it to Returns, Paid, or NET sheet. Use 'returns' for items being returned, 'paid' for paid orders, 'net' for NET 30 terms.",
        inputSchema: ArchiveRepairOrderSchema,
        execute: async ({ roNumber, destination, reason }: z.infer<typeof ArchiveRepairOrderSchema>) => {
          await tasks.trigger("ai-tool-archive-repair-order", { userId, roNumber, destination, reason });
          const sheetNames: Record<string, string> = {
            returns: "Returns",
            paid: "Paid",
            net: "NET",
          };
          return `✓ Queued: Moving RO #${roNumber} to ${sheetNames[destination]} sheet. ${reason ? `Reason: ${reason}` : ""}`;
        },
      },

      create_email_draft: {
        description:
          "Create an email draft related to a repair order. The draft is saved to the notification queue for user approval - it is NOT sent automatically.",
        inputSchema: CreateEmailDraftSchema,
        execute: async ({ roNumber, toAddress, subject, body }: z.infer<typeof CreateEmailDraftSchema>) => {
          await tasks.trigger("ai-tool-create-email-draft", { userId, roNumber, toAddress, subject, body });
          return `✓ Queued: Creating email draft for RO #${roNumber} to ${toAddress}. Subject: "${subject}". Check the notification queue for approval.`;
        },
      },
    },
  });

  return result.toTextStreamResponse();
}
