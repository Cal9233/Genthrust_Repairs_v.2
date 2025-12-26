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
**[Current Status]:** Phase 51 Complete - RO creation reliability fix.

---

## Changelog

### Phase 51 - RO Creation Reliability Fix (2025-12-26)
- **Bug Fix:** Replaced unreliable `$returningId()` with fetch-after-insert pattern
- **Problem:** Drizzle's `$returningId()` can return empty array, causing failures
- **Solution:**
  - Insert record into MySQL
  - Fetch newly created record by RO number (unique identifier)
  - More reliable than relying on `$returningId()` behavior
- **Files Modified:**
  - `src/app/actions/repair-orders.ts` - Changed insert pattern

### Phase 50 - Validation Integration & Excel Write-Back (2025-12-25)
- **Feature 1: Zod Validation Integration**
  - Integrated `createRepairOrderSchema` into `createRepairOrder()` server action
  - Input validated before any database operations
  - Returns detailed error messages with field paths on validation failure
  - Prevents "Ghost Data" (ROs without shopName/part)
- **Feature 2: Immediate Excel Write-Back**
  - New file: `src/lib/graph/write-single-ro.ts`
  - `addSingleRoToExcel()` writes new ROs to SharePoint immediately after MySQL insert
  - Uses Graph API session management for reliability
  - Follows Write-Behind pattern but with instant sync
- **Bug Fix: RECEIVED Status Not Triggering Reminders**
  - Issue: "RECEIVED" was missing from `TRACKED_STATUSES` array
  - Root Cause: `TRACKED_STATUSES = Object.keys(STATUS_CONFIGS)` excluded RECEIVED
  - Fix: Changed to `[...Object.keys(STATUS_CONFIGS), "RECEIVED"]`
  - Now payment reminders (Calendar + To-Do) are created when RO marked RECEIVED with NET terms
- **Files Modified:**
  - `src/app/actions/repair-orders.ts` - Zod validation + Excel write-back integration
  - `src/trigger/ro-lifecycle-flow.ts` - Added RECEIVED to TRACKED_STATUSES
  - `src/lib/graph/write-single-ro.ts` - NEW: Immediate Excel write-back function

### Phase 49 - Zod Validation Schemas (2025-12-25)
- **Feature:** Created centralized Zod validation schemas for Repair Orders
- **Purpose:** Single Source of Truth for data validation, prevents "Ghost Data"
- **New File:** `src/lib/validation/repair-order.ts`
- **Schemas:**
  - `repairOrderSchema` - Base schema matching DB shape
  - `createRepairOrderSchema` - Form validation with required `shopName` and `part`
  - `updateRepairOrderSchema` - All fields optional for partial updates
  - `roStatusEnum` - 13 valid RO statuses
- **Type Exports:** `RepairOrder`, `CreateRepairOrderInput`, `UpdateRepairOrderInput`, `ROStatus`
- **Helper Functions:** `parseCreateInput()`, `safeParseCreateInput()`, `parseUpdateInput()`, `safeParseUpdateInput()`
- **Key Features:**
  - Number coercion for `estimatedCost`/`finalCost` (handles form string inputs)
  - Zod v4 compatible syntax

### Phase 48 - Payment Reminders for RECEIVED ROs (2025-12-25)
- **Feature:** Auto-create payment reminders when RO marked RECEIVED with NET terms
- **Implementation:**
  - Added `parsePaymentTermsDays()` helper to extract days from "NET 30", "Net60", etc.
  - Added "RECEIVED" to `TRACKED_STATUSES` in repair-orders.ts
  - Added special RECEIVED handling in ro-lifecycle-flow.ts
  - Creates Outlook Calendar Event + Microsoft To-Do Task for payment due date
- **Backfill Task:** Added `backfill-payment-reminders` task for existing RECEIVED ROs
  - Finds all ROs in RECEIVED status with NET terms
  - Calculates due date from `curentStatusDate`
  - Skips ROs with past due dates
- **Files Modified:**
  - `src/app/actions/repair-orders.ts` - Added RECEIVED to tracked statuses
  - `src/trigger/ro-lifecycle-flow.ts` - Added payment reminder logic + backfill task

### Phase 47 - RO Creation Null Check Fix (2025-12-25)
- **Bug Fix:** "Cannot read properties of undefined (reading 'id')" when creating ROs
- **Root Cause:** Drizzle's `$returningId()` can return empty array, causing crash when accessing `.id`
- **Fix:** Added null check after insert, return proper error message if no ID returned
- **Files Modified:**
  - `src/app/actions/repair-orders.ts` - Added null check after `$returningId()`
  - `src/trigger/ai-tools.ts` - Same fix for AI-created ROs
  - `src/lib/data/notifications.ts` - Same fix for notification inserts

### Phase 46 - Email Draft Enhancements (2025-12-12)
- **Company Name Update:** Changed all email signatures from "GenThrust" to "Genthrust XVII, LLC"
  - Updated 6 status templates in `ro-lifecycle-flow.ts`
  - Updated overdue follow-up template in `check-overdue-ros.ts`
  - Updated batch email template in `batch-email-template.ts`
  - Updated sender name in thread history
- **Removed Status from Emails:** Removed "Current status: {status}" line from overdue follow-up emails
- **Editable Batch Email Table:** Combined RO emails now have fully editable tables
  - Added `parseTableToRODetails()` to extract structured data from HTML table
  - Added `generateTableHtml()` to reconstruct table from edited data
  - Added `EditableTableRow` component with inline editing
  - Users can edit RO #, Part Number, Serial Number for each row
  - Added "Add Row" button to add new ROs to the table
  - Added trash icon to remove rows (hover to reveal)
- **Files Modified:**
  - `src/lib/batch-email-template.ts` - Added parse/generate functions, updated signature
  - `src/trigger/ro-lifecycle-flow.ts` - Updated 6 email signatures
  - `src/trigger/check-overdue-ros.ts` - Updated signature, removed status line
  - `src/app/actions/notifications.ts` - Updated sender name, added revalidatePath
  - `src/components/notifications/EditableEmailPreview.tsx` - Full table editing UI

### Phase 45 - Dashboard Overdue Card Refresh Fix (2025-12-10)
- **Bug Fix:** Overdue stat card not updating when notifications approved/rejected
- **Root Cause:** `approveNotification()`, `rejectNotification()`, and `approveBatchNotifications()` didn't call `revalidatePath("/dashboard")`
- **Why Bell Worked:** NotificationBell is a Client Component that updates local React state directly
- **Why Overdue Card Didn't:** Dashboard stats rendered by Server Component with cached data
- **Fix:** Added `revalidatePath("/dashboard")` after successful mutation in all three functions
- **Files Modified:**
  - `src/app/actions/notifications.ts` - Added revalidatePath calls to 3 functions

### Phase 44 - Document Uploader Bug Fixes (2025-12-10)
- **Bug Fix 1: 4MB Graph API Limit**
  - Issue: Frontend allowed 10MB but Graph API simple upload only supports 4MB
  - Fix: Reduced `MAX_FILE_SIZE` to 4MB in both server action and UI component
- **Bug Fix 2: Multi-File Upload Error Handling**
  - Issue: Only last error shown when uploading multiple files with failures
  - Fix: Implemented cumulative error tracking with `errors[]` array
  - Only refresh document list if at least one file succeeded
- **Bug Fix 3: Activity Log Resilience**
  - Issue: Activity log insert failure caused entire upload to fail (inconsistent state)
  - Fix: Wrapped activity log inserts in try/catch for both upload and delete operations
- **Bug Fix 4: Missing Parent Folder Error**
  - Issue: Generic error when "Repair Orders" SharePoint folder doesn't exist
  - Fix: Detect 404/itemNotFound and show actionable message
- **Bug Fix 5: File Type Validation**
  - Issue: No validation - any file type could be uploaded
  - Fix: Added `ALLOWED_EXTENSIONS` allowlist (PDF, Word, Excel, images, ZIP)
  - Added `accept` attribute to file input for better UX
- **New Table: `files_upload`**
  - Tracks document uploads with SharePoint file IDs, sizes, and soft delete support
  - Fields: id, repairOrderId, fileName, fileExtension, fileSize, sharePointFileId, sharePointWebUrl, uploadedBy, uploadedAt, deletedAt

### Phase 38 - AI Multi-Turn & Notification Search (2025-12-10)
- **Bug Fix 1:** AI Assistant stopped responding after first message when tools were invoked
  - User Observation: "It's like it only makes one call in backend"
  - Root Cause: AI SDK 5 requires `stopWhen` for multi-step tool calls
  - Solution: Added `stopWhen: stepCountIs(10)` to enable tool call continuation
- **Bug Fix 2:** Notification Bell missing search and wrong sort order
  - Added search bar to filter pending notifications by RO#, shop name, or subject
  - Changed sort order to RO# descending (highest/newest first)
- **Bug Fix 3:** AI messages showing raw markdown symbols (`**`, `*`)
  - Added `formatAIMessage()` helper to strip markdown and make text human-readable
  - Converts `**bold**` → `bold`, `- list` → `• list`
  - Makes output more accessible for all users
- **Files Modified:**
  - `src/app/api/chat/route.ts` - Added `stopWhen: stepCountIs(10)` import + config
  - `src/components/layout/NotificationBell.tsx` - Added search input + filter logic
  - `src/app/actions/notifications.ts` - Changed orderBy to `repairOrderId DESC`
  - `src/components/agent/Assistant.tsx` - Added formatAIMessage() for clean output

### Phase 37 - RO Edit Save Fixes (2025-12-08)
- **Bug Fix 1: Double-Save Race Condition**
  - Issue: Save button required clicking twice - first click failed silently, second worked
  - Root Cause: `useCallback` stale closure captured empty `editedFields` on first save
  - Fix: Added `editedFieldsRef` to always access current state in `saveChanges` callback
- **Bug Fix 2: Silent Error Handling**
  - Issue: Save failures showed no user feedback
  - Fix: Added toast notifications using `sonner` for success/error states
  - `handleSave()` now shows "Changes saved" on success, error message on failure
  - `handleStatusChange()` shows "Status updated to {status}" on success
