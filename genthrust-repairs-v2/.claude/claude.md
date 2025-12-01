# CLAUDE.md - GenThrust RO Tracker (v2) Context & Guidelines

## 1. Project Overview
**Name:** GenThrust RO Tracker v2
**Goal:** Rebuild the legacy React/Express aviation repair tracker into a resilient, distributed system.
**Core Philosophy:** Move from "Fragile Serverless" to **Durable Execution**. The UI must never block on Excel; all heavy lifting is offloaded to containerized background tasks.

## 2. Technology Stack (Strict)
* **Framework:** Next.js 15 (App Router).
* **Language:** TypeScript (Strict mode).
* **Database:** Aiven for MySQL (via Drizzle ORM).
* **Orchestration:** Trigger.dev v3 (Containerized Tasks).
* **Auth:** Auth.js v5 (Microsoft Entra ID).
* **AI:** Vercel AI SDK (integrated into Trigger.dev tasks).
* **Styling:** Tailwind CSS + shadcn/ui.
* **External Data:** Microsoft Graph API (Excel/SharePoint).

## 3. Architectural Rules & Patterns

### A. Data Persistence (The "Write-Behind" Pattern)
1.  **Source of Truth:** Aiven MySQL is the immediate system of record.
2.  **Excel Sync:** Excel is a *downstream* replica. Never write to Excel synchronously from the UI.
3.  **Flow:** UI -> Server Action -> MySQL Write -> Push Job to Trigger.dev -> Background Worker writes to Excel.

### B. Database Connections (The "Singleton" Rule)
* **Constraint:** Serverless environments exhaust connections.
* **Implementation:** You MUST use the `Global Singleton` pattern for Drizzle.
* **Config:** Set `connectionLimit: 10` per container.
* **Reference:**
    ```typescript
    const globalForDb = globalThis as unknown as { conn: mysql.Pool };
    const poolConnection = globalForDb.conn ?? mysql.createPool({ ... });
    if (process.env.NODE_ENV !== "production") globalForDb.conn = poolConnection;
    ```

### C. Durable Execution (Trigger.dev)
* **No Timeouts:** All Excel syncing and AI research run in Trigger.dev containers, not Vercel functions.
* **Excel Optimization:**
    * **Batching:** Always chunk Graph API writes into groups of 20 (JSON Batching).
    * **Sessions:** Use `workbook-session-id` with `persistChanges: true`. Never open/close files per row.
* **Realtime:** Use `useRealtimeRun` hooks to show progress bars in the UI. No WebSockets.

### D. User Interface
* **Optimistic UI:** Use `useOptimistic` for all mutations. The user sees "Saved" immediately; we handle the eventual consistency in the background.
* **Server Components:** Fetch data in RSCs. Pass actions to Client Components.

## 4. Coding Standards
* **Naming:** `camelCase` for functions, `PascalCase` for components.
* **Exports:** Named exports preferred over default exports.
* **Error Handling:** All Server Actions must return a standardized `Result<T>` type `{ success: boolean, data?: T, error?: string }`.
* **AI:** When generating UI, use `generative-ui` from Vercel AI SDK to stream components, not just text.

## 5. Memory & Context Maintenance
* **Update Strategy:** After completing a phase, update the `[Current Status]` section below.
* **Decision Log:** If we deviate from the stack (e.g., adding Redis), log the "Why" in a `docs/decision-log.md`.
* **Token Efficiency:** Do not dump massive raw JSON files into context. Summarize interfaces.

---
**[Current Status]:** Phase 11 Complete - Notification Queue Infrastructure with automated email drafting, human-in-the-loop approval via NotificationBell (tabbed Pending/History UI), Trigger.dev durable tasks (send-approved-email, handle-ro-status-change, check-overdue-ros cron), Microsoft Graph productivity helpers, and status change integration.