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
**[Current Status]:** Phase 40 Complete - Light/Dark Mode Polish. Comprehensive audit of 45+ components; fixed StatusBadge light mode contrast and sign-in page theme awareness.

---

## Changelog

### Phase 40 - Light/Dark Mode Polish (2025-12-09)
- **Comprehensive Audit:** Used 3 parallel explore agents to audit 45+ files across dashboard, UI, layout, and modal components
- **Audit Result:** ~93% compliant - codebase has excellent CSS variable architecture
- **Sign-in Page Fix:**
  - Changed `bg-white ring-black/5` to `bg-card border-border` for theme-aware logo container
- **StatusBadge Light Mode Contrast:**
  - Changed from `/20` opacity (too subtle in light mode) to explicit Tailwind colors
  - Warning badges: `bg-amber-100 text-amber-700 dark:bg-warning/30 dark:text-warning`
  - Success badges: `bg-emerald-100 text-emerald-700 dark:bg-success/30 dark:text-success`
  - Danger badges: `bg-red-100 text-red-700 dark:bg-danger/30 dark:text-danger`
  - Cyan badges: `bg-cyan-100 text-cyan-700 dark:bg-accent-cyan/30 dark:text-accent-cyan`
- **Tracking File Created:** `.claude/light-dark-mode-audit.md` for context resumption
- **Files Modified:**
  - `src/app/(auth)/signin/page.tsx` - Theme-aware logo container
  - `src/components/dashboard/StatusBadge.tsx` - Light mode contrast improvements

### Phase 39 - Batch Email Preview Fixes (2025-12-09)
- **Bug Fix 1: Table Text Invisible in Dark Mode**
  - Issue: Table headers in batch email preview had white text on light gray background - invisible in dark mode
  - Root Cause: Inline styles only set `background-color: #f5f5f5` without explicit text color
  - Fix: Added explicit text colors for email-safe rendering
    - Header text: `color: #1f2937` (Tailwind gray-800)
    - Body text: `color: #374151` (Tailwind gray-700)
- **Bug Fix 2: Email Body Not Scrollable**
  - Issue: Couldn't scroll to see full email content in preview dialog
  - Root Cause: Parent div had `overflow-hidden` which clipped child content
  - Fix: Changed parent from `overflow-hidden` to `flex flex-col min-h-0`, added `min-h-0` to body wrapper
  - Why it works: `min-h-0` allows flex children to shrink below content size
- **Fix 3: Batch Email Save (Confirmed Working)**
  - Concern: Editing email should save for ALL grouped ROs, not just primary
  - Analysis: Already works correctly because:
    - Batch emails are only created for ROs from same shop
    - `updateNotificationPayload()` calls `updateShopEmail(shopName, newEmail)`
    - Shop email stored by `businessName`, not per-RO
    - All batched ROs share same shop, so one update covers all
- **Files Modified:**
  - `src/lib/batch-email-template.ts` - Added explicit text colors to table HTML
  - `src/components/notifications/EmailPreviewDialog.tsx` - Fixed flex layout for scrolling

### Phase 38 - Shop Name in Notification Cards (2025-12-09)
- **Feature:** Display shop/vendor name as subtitle in notification bell dropdown
- **Purpose:** Users can quickly identify which shop is working on each RO without opening the email preview
- **Implementation:**
  - Extended `getPendingNotifications()` to include `shopName` via existing INNER JOIN with `active` table
  - Created `NotificationWithShop` type extending `NotificationQueueItem` with `shopName: string | null`
  - Updated `NotificationBell.tsx` state to use new type
  - Added shop name display below subject line with muted foreground styling
- **Visual Result:**
  ```
  RO #79                           Email Draft
  Follow-up: RO# G38573
  Pratt & Whitney Canada           <- NEW
  To: repairs@pwc.com
  [Preview] [Approve & Send] [Reject]
  ```
- **Files Modified:**
  - `src/app/actions/notifications.ts` - Added `NotificationWithShop` type, included `shopName` in select clause
  - `src/components/layout/NotificationBell.tsx` - Updated state type, added shop name display in UI

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
- **Bug Fix 3: Overdue UI Not Refreshing** (Backend already fixed in Phase 36)
  - Backend sets `nextDateToUpdate = today + 7 days` on save
  - `revalidatePath("/dashboard")` invalidates cache
  - UI re-fetches via `fetchData()` after successful save
- **Files Modified:**
  - `src/components/ro-detail/useRODetail.ts` - Added useRef for editedFields, removed from deps
  - `src/components/ro-detail/RODetailPanel.tsx` - Added toast import and feedback

### Phase 36 - roActivityLog Insert Fixes (2025-12-08)
- **Bug Fix:** `ro_activity_log` insert failures in production Trigger.dev
- **Root Cause:** Drizzle ORM generates `default` keyword for omitted nullable columns, MySQL rejects without DEFAULT constraint
- **Locations Fixed (5 total):**
  - `src/app/actions/repair-orders.ts` - createRepairOrder, linkROs, unlinkROs
  - `src/app/actions/documents.ts` - uploadDocument, deleteDocument
- **Solution:** Added explicit `field: null, oldValue: null, newValue: null` to all roActivityLog inserts
- **Overdue Reset:** `updateRepairOrder()` and `updateRepairOrderStatus()` now set `nextDateToUpdate = today + 7 days`

### Phase 35 - AI Assistant Cleanup & list_repair_orders Tool (2025-12-06)
- **Orphaned Code Removal:** Deleted 3 unused AI files (~509 lines)
  - `src/trigger/ai-agent.ts` - Research agent never connected to UI
  - `src/app/actions/agent.ts` - askAgent() never called
  - `src/hooks/use-agent-run.ts` - Hook for orphaned agent
- **New AI Tool:** `list_repair_orders` with flexible filters
  - Status filter: `overdue` | `active` | `completed` | `all`
  - Shop name filter: case-insensitive partial match
  - Limit parameter: default 20 results
  - Sorted by most overdue first
- **Overdue Definition:** `estimatedDeliveryDate` < today AND incomplete status
- **Bug Fix:** Fixed UIMessage type compatibility in Assistant.tsx
- **Files Deleted:**
  - `src/trigger/ai-agent.ts`
  - `src/app/actions/agent.ts`
  - `src/hooks/use-agent-run.ts`
- **Files Modified:**
  - `src/app/api/chat/route.ts` - Added list_repair_orders tool + imports
  - `src/components/agent/Assistant.tsx` - Type assertion fix

### Phase 34 - Streaming AI Assistant (2025-12-06)
- **Architecture:** "Switchboard Architecture" - AI "Brain" (LLM) moved to Next.js Edge, "Muscles" (heavy tools) stay in Trigger.dev
- **Problem Solved:** Users waited 3-10 seconds for AI responses due to Trigger.dev cold start latency
- **Solution:** Streaming API route with hybrid tool strategy
- **READ Tools (Instant - Direct DB):**
  - `search_inventory` - Search parts by P/N or description
  - `get_repair_order` - Lookup RO by number or database ID
- **WRITE Tools (Fire-and-Forget to Trigger.dev):**
  - `create_repair_order` - Queue new RO creation
  - `update_repair_order` - Queue field updates (status, notes, costs, dates)
  - `archive_repair_order` - Queue move to Returns/Paid/NET sheets
  - `create_email_draft` - Queue email draft for approval
- **Frontend Updates:**
  - Uses Vercel AI SDK v5 `useChat` hook from `@ai-sdk/react`
  - `TextStreamChatTransport` for streaming text responses
  - `getMessageText()` helper handles both `msg.content` and `msg.parts` formats
  - Real-time "Thinking..." loading indicator during streaming
- **AI SDK v5 Compatibility:**
  - Tool definitions use `inputSchema` (not `parameters`)
  - `maxOutputTokens` (not `maxTokens`)
  - `toTextStreamResponse()` for streaming
  - `convertToModelMessages()` to convert UIMessage[] to ModelMessage[]
- **Files Created:**
  - `src/app/api/chat/route.ts` - Streaming API endpoint with hybrid tools
- **Files Modified:**
  - `src/components/agent/Assistant.tsx` - Replaced Trigger.dev hook with useChat

### Phase 33 - Email Preview Bug Fixes (2025-12-05)
- **Bug Fix 1: Notification Approval Flow**
  - Issue: "Notification not found or already processed" error when approving/rejecting
  - Root Cause: `userId` filter in notification actions didn't match session user ID
  - Solution: Removed `userId` filter from `approveNotification()`, `rejectNotification()`, `updateNotificationPayload()` for single-tenant admin app
- **Bug Fix 2: Stale Email Preview Content**
  - Issue: Editing RO# 38386, then previewing RO# 38586 showed old content from 38386
  - Root Cause: `localPayload` state persisted across notification switches (Radix Dialog doesn't fire `onOpenChange` on programmatic open)
  - Solution: Added `useEffect` to reset `localPayload` and `isEditMode` when `notification?.id` changes
- **Bug Fix 3: Warning Banner Not Clearing**
  - Issue: "Shop email not configured" warning persisted after saving valid email
  - Root Cause: OR logic checked `missingEmail` flag which wasn't cleared on save
  - Solution: Changed to check only if email field is actually empty, ignoring `missingEmail` flag
- **Feature: Shop Email Persistence on Save**
  - When editing "To" email in Email Preview Dialog, clicking Save now persists the email to the shop's record
  - Future notifications to same shop will use the saved email address
  - Uses existing `updateShopEmail()` function from Phase 26
- **Files Modified:**
  - `src/app/actions/notifications.ts` - Removed userId filters, added shop email update on save
  - `src/components/notifications/EmailPreviewDialog.tsx` - Added useEffect for state reset, fixed isMissingEmail logic

### Phase 32 - Orphaned Notifications Cleanup (2025-12-05)
- **Bug Fix:** Notification badge showed stale count (58) after Excel import updated dashboard (37 overdue)
- **Root Cause:** When ROs are deleted from MySQL (Phase 30), `notificationQueue` entries remained orphaned
- **Solution 1:** `getPendingNotifications()` now INNER JOINs with `active` table to filter orphans
- **Solution 2:** Excel import Phase 4.6 explicitly deletes orphaned notification queue entries
- **Files Modified:**
  - `src/app/actions/notifications.ts` - Added INNER JOIN in `getPendingNotifications()`
  - `src/trigger/import-from-excel.ts` - Added Phase 4.6 orphan cleanup, new imports

### Phase 31 - Batch Email Notifications (2025-12-05)
- **Feature:** Combine multiple pending ROs from the same shop into one email
- **Problem Solved:** Shops receiving 5 individual emails when one consolidated email would suffice
- **UI Flow:**
  1. Click "Preview" eye icon on a notification
  2. System checks for other pending ROs from the same shop
  3. If siblings exist, BatchPromptDialog opens with checkable list
  4. User can combine selected ROs into one email or send separately
  5. Combined email uses HTML table listing all RO#, Part#, Serial#
- **Subject Line Strategy:**
  - 1 RO: `Status Update for RO #12345`
  - 2-3 ROs: `Status Update: RO #12345, #12346, #12347`
  - 4+ ROs: `Status Update: Multiple Orders ({Shop Name})`
- **Timestamp Consistency:** All batched notifications get same `outlookMessageId`, `outlookConversationId`
- **User Preference:** "Don't ask again" checkbox saves to localStorage; reset link in History tab
- **Files Created:**
  - `src/components/notifications/BatchPromptDialog.tsx` - Dialog with checkbox selection
  - `src/lib/batch-email-template.ts` - Generates merged email subject/body with HTML table
  - `src/components/ui/checkbox.tsx` - Added shadcn checkbox component
- **Files Modified:**
  - `src/app/actions/notifications.ts` - Added `getRelatedPendingNotifications()`, `approveBatchNotifications()`, `SiblingNotification` type
  - `src/components/layout/NotificationBell.tsx` - Batch prompt interception, state management, reset preference
  - `src/components/notifications/EmailPreviewDialog.tsx` - Added `isBatch`/`batchCount` props, batch indicator
  - `src/trigger/send-approved-email.ts` - Added `batchedNotificationIds` payload, updates all sibling RO dates/statuses

### Phase 30 - Full Sync Excel Import (2025-12-05)
- **Feature:** Excel import now deletes MySQL rows not present in Excel
- **Problem Solved:** ROs deleted from Excel remained in MySQL dashboard forever (append-only import)
- **Solution:** After upserting all Excel rows, delete MySQL rows whose RO# is not in Excel
- **Safety Guard:** If Excel returns 0 RO numbers, skip deletion to prevent accidental data wipe
- **Output Schema:** Added `deletedCount` field to track deletions
- **Files Modified:**
  - `src/trigger/import-from-excel.ts`:
    - Added Phase 4.5: Delete Orphaned MySQL Rows
    - Collects `excelRONumbers` Set after parsing
    - Uses `notInArray` to find orphaned MySQL rows
    - Logs deleted RO numbers for audit trail
- **Data Flow:** Excel is now the true source of truth for the `active` table

### Phase 29 - Dashboard Filter System (2025-12-05)
- **Feature:** Advanced filtering for dashboard repair order table
- **Filter Bar Component:** `DashboardFilterBar` with collapsible filter chips
- **Available Filters:**
  - Status filter (multi-select): Filter by current status values
  - Shop filter: Filter by shop name
  - Date range filters: Filter by date received, next update date
  - Overdue toggle: Show only overdue items
- **Server-Side Filtering:** Filters passed to `getRepairOrdersBySheet()` action
- **Persistence:** Filter state maintained during pagination
- **Files Added:**
  - `src/components/dashboard/DashboardFilterBar.tsx` - Filter bar UI component
- **Files Modified:**
  - `src/components/dashboard/RepairOrderTable.tsx` - Integrated filter bar, passes filters to action
  - `src/app/actions/dashboard.ts` - Added `DashboardFilters` type, filter logic in query

### Phase 28 - UX Polish & Bug Fixes (2025-12-05)
- **Year 45988 Fix:** Dates > 2100 or < 1900 display as "-" instead of absurd values
  - SQL "end of time" dates and parsing errors no longer show garbage data
  - Added year validation in `formatDate()` and `getDaysOverdue()` functions
- **Overdue Days Display:** Now shows "(+Xd)" suffix for overdue dates
  - Example: "11/24/2025 (+11d)" shows date is 11 days overdue
  - Added `getDaysOverdue()` helper function
  - Applied to both desktop table and mobile cards
- **TO SEND Status Color:** Changed from grey (default) to amber/warning
  - Action items now visually stand out for attention
  - Added explicit case in `StatusBadge.tsx` switch statement
- **Empty States:** Est. Cost "-" now dimmed with `text-muted-foreground/50`
  - `formatCurrency()` returns JSX with styled dash for null values
- **Dark Mode Contrast:** Improved placeholder text visibility
  - Added CSS rule in `globals.css` for `.dark input::placeholder`
  - Placeholder color changed to `hsl(215 20% 72%)` for better readability
- **Removed Left Borders:** Eliminated colored left borders from table rows
  - No "Priority" field exists in data, so borders added visual noise ("rainbow effect")
  - Removed `getStatusBorderColor()` function and `border-l-4` classes
- **Files Modified:**
  - `src/components/dashboard/RepairOrderTable.tsx` - Date validation, overdue days, borders removed
  - `src/components/dashboard/StatusBadge.tsx` - TO SEND amber color
  - `src/app/globals.css` - Dark mode placeholder contrast

### Phase 27 - RO Date Update on Email Send (2025-12-04)
- **Feature:** Sending a follow-up email now resets the RO's overdue status
- **Date Updates:** After successful email send:
  - `lastDateUpdated` → set to today's date
  - `nextDateToUpdate` → set to today + 7 days
- **Excel Sync:** Automatically triggers sync to update columns T & U
- **Dashboard Impact:** "Overdue" stat decreases after email sent (on page refresh)
- **TDD Approach:** 21 tests written before implementation
- **Files Added:**
  - `src/__tests__/ro-date-update.test.ts` - TDD test suite (21 tests)
- **Files Modified:**
  - `src/trigger/send-approved-email.ts` - Added Steps 3e (date update) + 3f (Excel sync trigger)

### Phase 26 - Save Edited Shop Email (2025-12-04)
- **Feature:** When user edits email in approval dialog, shop record is updated for future use
- **Shop Email Persistence:** Edited emails are saved to the shop's record in database
- **Future Pre-population:** Next email to same shop will be pre-populated with saved address
- **TDD Approach:** 23 tests written before implementation
- **Files Added:**
  - `src/__tests__/shop-email-update.test.ts` - TDD test suite (23 tests)
- **Files Modified:**
  - `src/lib/data/shops.ts` - Added `updateShopEmail()` function
  - `src/trigger/send-approved-email.ts` - Added Step 3d for shop email update

### Bug Fix - Email Threading Headers (2025-12-04)
- **Issue:** Emails failing with "In-Reply-To should start with 'x-'" error
- **Root Cause:** Microsoft Graph API's `internetMessageHeaders` only allows custom `x-` headers
- **Fix:** Removed invalid `In-Reply-To` and `References` headers from `sendEmail()`
- **Impact:** Emails send successfully but without threading (threading requires different API approach)
- **Files Modified:**
  - `src/lib/graph/productivity.ts` - Removed invalid threading headers block

### Phase 25 - Auto Excel Sync (2025-12-04)
- **Architecture:** Full implementation of Write-Behind pattern per CLAUDE.md Section 3A
- **Auto-Import on Dashboard Load:**
  - New `AutoImportTrigger` component triggers Excel → MySQL import once per browser session
  - Uses `sessionStorage` to prevent duplicate imports on page refresh
  - Non-blocking background import via Trigger.dev
  - Toast notifications show sync progress and completion
- **Status Updates Auto-Sync to Excel:**
  - `updateRepairOrderStatus()` now triggers `sync-repair-orders` task after MySQL update
  - Previously only `updateRepairOrder()` had sync capability (gap fixed)
  - Wrapped in try/catch so Excel failures don't break status updates
- **Manual Sync Fixed:**
  - `ExcelDropdownButton` no longer uses hardcoded `[1, 2, 3]` RO IDs
  - New `triggerSyncAllActive()` action fetches ALL active RO IDs from database
  - Syncs entire active table to Excel in one background task
- **Files Added:**
  - `src/components/dashboard/AutoImportTrigger.tsx` - Session-based auto-import trigger
- **Files Modified:**
  - `src/app/(protected)/dashboard/page.tsx` - Added AutoImportTrigger component
  - `src/app/actions/repair-orders.ts` - Added sync call to updateRepairOrderStatus
  - `src/app/actions/sync.ts` - Added triggerSyncAllActive() function
  - `src/components/layout/ExcelDropdownButton.tsx` - Uses triggerSyncAllActive instead of hardcoded IDs
- **Data Flow:**
  - On app load: Excel → MySQL (auto-import, once per session)
  - On status update: MySQL → Excel (auto-sync, per change)
  - Manual sync: MySQL → Excel (all active ROs)

### Phase 24 - Auto Email Sender (2025-12-04)
- **Real Shop Emails:** Replaced placeholder `shop@example.com` with actual shop email lookup
- **Shop Email Lookup:** Created `getShopEmailByName()` function in `src/lib/data/shops.ts`
  - Case-insensitive matching by `businessName`
  - Fuzzy fallback with LIKE query
  - Graceful handling when shop not found (skips email, logs warning)
- **CC Support:** Added multi-recipient CC capability
  - `sendEmail()` now accepts comma-separated CC list
  - Configure via `GENTHRUST_CC_EMAIL` environment variable
  - Supports single or multiple recipients (e.g., `a@example.com,b@example.com`)
- **Shared Mailbox:** Emails sent FROM `repairs@genthrust.net`
  - Uses `MS_GRAPH_SHARED_MAILBOX` environment variable
  - Existing `getMailboxPath()` helper routes API calls correctly
- **Files Modified:**
  - `src/lib/graph/productivity.ts` - Added `SendEmailOptions` interface with CC support
  - `src/lib/data/shops.ts` - NEW FILE - Shop email lookup helper
  - `src/lib/types/notification.ts` - Updated type guard for robustness
  - `src/trigger/send-approved-email.ts` - Passes CC to sendEmail
  - `src/trigger/ro-lifecycle-flow.ts` - Uses real shop emails + CC
  - `src/trigger/check-overdue-ros.ts` - Uses real shop emails + CC
- **Email Templates:** 6 status-based templates (WAITING QUOTE, APPROVED, IN WORK, IN PROGRESS, SHIPPED, IN TRANSIT)

### Phase 23 - Virtual Warehouse Inventory (2025-12-04)
- **Major Feature:** Complete redesign of Inventory page from blank search to "Parts Depot" command center
- **Zero State Dashboard:**
  - Low Stock Alerts: Shows items with qty < 5, sorted by scarcity
  - Recently Updated: Last 5 items by `lastSeen` timestamp
  - Inventory Stats: Total items (5,216), total quantity (162,372), condition breakdown
- **Omnibar Search Component:**
  - Large hero-style search input (h-14, font-mono)
  - Condition filter pills: All, New, Overhauled, As-Removed, Serviceable
  - Keyboard shortcut support (⌘K)
  - Disabled Scan button (placeholder for future barcode scanning)
- **Manifest Table (Desktop):**
  - High-density data display with stacked part identity (P/N + description)
  - Location tags with MapPin icon
  - Condition badges with color-coded dots (NE=sky, OH=emerald, SV=teal, AR=zinc, RP=amber)
  - Stock-level colored quantities (green ≥10, amber 5-9, red <5)
  - Ghost-style slide-in action buttons on hover
  - Smart actions: "Issue" (clipboard) for NE/SV, "Create RO" for AR/RP/OH
- **Mobile Cards:**
  - Responsive card-based view for mobile devices
  - Same visual language as table (condition dots, stock colors, location tags)
  - Touch-friendly action buttons
- **Condition Data Forensics:**
  - Created `/api/forensics` endpoint for database analysis
  - Discovered: Only 35 of 5,216 items (0.7%) have condition data
  - Source tables lack proper aviation condition codes
  - UI gracefully shows "?" for unknown conditions
- **Files Added:**
  - `src/components/inventory/WarehouseOverview.tsx` - Zero State dashboard
  - `src/components/inventory/InventoryOmnibar.tsx` - Search with filter pills
  - `src/components/inventory/InventoryTable.tsx` - Desktop manifest table
  - `src/components/inventory/InventoryCard.tsx` - Mobile card view
  - `src/app/(protected)/inventory/InventoryContent.tsx` - Client state manager
  - `src/app/actions/forensics.ts` - Database forensics queries
  - `src/app/api/forensics/route.ts` - Forensics API endpoint
  - `scripts/investigate-conditions.ts` - Standalone forensics script
- **Files Modified:**
  - `src/app/actions/inventory.ts` - Added dashboard queries (getLowStockItems, getRecentlyUpdated, getInventoryStats, searchInventory with condition filter)
  - `src/app/(protected)/inventory/page.tsx` - Server-side data prefetch, title changed to "Inventory"

### Phase 22 - Aero-Glass UI Redesign (2025-12-04)
- **Major Redesign:** Transformed from Bootstrap-style to "Industrial Precision" cockpit interface
- **Design System:**
  - Added Gunmetal color palette (10 shades) for monochromatic base
  - Added semantic status colors: Signal Orange, Aviation Blue, Tactical Green, Caution Amber, Critical Red
  - Glass effects with backdrop blur for panels and cards
  - Dark mode set as default ("Cockpit" mode)
- **New Components:**
  - `StatTicker` - Slim horizontal KPI bar with sparklines (replaces hero cards)
  - `Sparkline` - SVG trend visualization for metrics
  - `DotStatus` - Compact status indicator (dot + label)
  - `PipelineRail` - Subway-map style process tracker with HUD glow effect
  - `BlueprintPattern` - Technical schematic SVG pattern for login background
- **Login Page ("The Hangar"):**
  - Split-screen layout (40% control panel / 60% blueprint texture)
  - Turbine wireframe + altimeter grid SVG patterns
  - Frosted glass overlay with aviation blue accent
- **Dashboard:**
  - Replaced large gradient hero cards with slim StatTicker
  - Real-time trend data with 7-day sparklines
  - Increased density (reduced padding/spacing)
- **DataGrid (Table):**
  - Row hover glow effect with aviation blue accent
  - DotStatus indicators instead of full-width badges
  - Uppercase column headers with tracking
  - Font-mono tabular-nums for all data columns
- **Header:**
  - Glass panel effect with backdrop blur
  - Reduced height (h-12) for cockpit density
  - Aviation blue bottom accent line
- **Files Added:**
  - `src/components/ui/sparkline.tsx`
  - `src/components/ui/dot-status.tsx`
  - `src/components/ui/blueprint-pattern.tsx`
  - `src/components/dashboard/StatTicker.tsx`
  - `src/components/dashboard/PipelineRail.tsx`
  - `src/app/actions/trends.ts`
- **Files Modified:**
  - `src/app/globals.css` - Gunmetal palette, glass utilities, pipeline-active glow
  - `src/components/ui/card.tsx` - Added glass variant
  - `src/components/dashboard/StatsGrid.tsx` - Uses StatTicker
  - `src/components/dashboard/RepairOrderTable.tsx` - DataGrid styling with DotStatus
  - `src/app/(auth)/signin/page.tsx` - Split-screen "Hangar" design
  - `src/components/layout/Header.tsx` - Glass panel effect
  - `src/components/providers/ThemeProvider.tsx` - Dark mode default
  - `src/app/(protected)/dashboard/page.tsx` - Fetches trends, compact layout

### Phase 21 - Logo Integration (2025-12-04)
- **New Feature:** GenThrust logo added throughout application
- **Sign-in Page:** Large logo (80x80) displayed above brand name
- **Header:** Logo (32x32) displayed left of "GenThrust RO Tracker" title
- **Favicon:** Browser tab now shows GenThrust logo
- **Files Added:**
  - `/assets/GenLogoTab.png` - Original logo asset
  - `/public/GenLogoTab.png` - Public-accessible logo
- **Files Modified:**
  - `src/components/layout/Header.tsx` - Added logo image
  - `src/app/(auth)/signin/page.tsx` - Added logo to sign-in card
  - `src/app/layout.tsx` - Added favicon metadata

### Phase 20 - Data Cleaning for Status Fields (2025-12-04)
- **New Feature:** Automatic cleaning of status fields during Excel import
- **Cleaning Logic:**
  - Removes trailing/leading symbols (>, <, -, =, *, #, @, etc.)
  - Normalizes capitalization to Title Case ("APPROVED >>>>" → "Approved")
- **Fields Affected:** `curentStatus`, `genthrustStatus`, `shopStatus`
- **Files Modified:**
  - `src/lib/graph/excel-mapping.ts` - Added `cleanStatus()` function

### Phase 19 - Vercel Production Deployment (2025-12-03)
- **Deployment:** App deployed to Vercel at `genthrust-repairs-v-2.vercel.app`
- **Trigger.dev Production:** Background workers deployed to Trigger.dev cloud
- **SSL Fix:** Added `DATABASE_CA_CERT_BASE64` env var support for Base64-encoded certificates
  - Avoids newline corruption issues in web dashboards
  - Priority order: Base64 env var → Raw env var → File-based cert
- **Environment Variables Configured:**
  - Vercel: Database, Auth, SharePoint credentials
  - Trigger.dev: Database, Auth, Excel/SharePoint, Anthropic API
- **Files Modified:**
  - `src/lib/db.ts` - Added Base64 certificate decoding support

### Phase 18 - Responsive UI for Mobile & Tablet (2025-12-03)
- **New Feature:** Mobile-first responsive design across all major components
- **Navigation:** Hamburger menu with Sheet overlay for mobile, horizontal tabs for desktop
- **RepairOrderTable:** Card-based view on mobile (`MobileROCard`), table on desktop
- **Summary Components:** Touch-friendly padding, responsive font sizes, line-clamp on mobile
- **RODetailPanel:** Full-screen on mobile, responsive tabs with icon-only on small screens
- **Header:** Compact layout on mobile with reduced height and gaps
- **Stats Components:** Responsive sizing for HeroStatCard, StatCard, StatsGrid
- **Breakpoints Supported:**
  - Base (< 640px): iPhone SE, iPhone 14/15, Pixel 7, Galaxy S23
  - sm (640px+): Large phones landscape
  - md (768px+): iPad Mini, iPad Air
  - lg (1024px+): iPad Pro, desktop
- **Files Modified:**
  - `Navigation.tsx` - Added mobile hamburger menu
  - `RepairOrderTable.tsx` - Added MobileROCard component
  - `SummaryCard.tsx` - Touch-friendly adjustments
  - `SummaryList.tsx` - Mobile spacing, removed duplicate title
  - `RODetailPanel.tsx` - Full-screen mobile, responsive tabs
  - `Header.tsx` - Compact mobile layout
  - `StatsGrid.tsx`, `HeroStatCard.tsx`, `StatCard.tsx` - Responsive sizing

### Phase 17 - Priority Feed Summary (2025-12-03)
- **New Feature:** Priority Feed tab replacing "Shops" placeholder
- **Smart Sorting:** ROs sorted by urgency (P1: Overdue, P2: Action Required, P3: Arriving Soon, P4: Standard WIP)
- **Time-Aware Summaries:** Template-based text that changes based on days in status
- **Files Created:**
  - `/src/lib/summary-generator.ts` - Priority calculation + time-aware templates
  - `/src/lib/date-utils.ts` - Added `daysSince()`, `daysUntil()`, `formatRelativeDate()`
  - `/src/app/actions/summary.ts` - Server action for fetching ROs
  - `/src/components/summary/SummaryCard.tsx` - Priority-styled card component
  - `/src/components/summary/SummaryList.tsx` - Grouped priority feed
  - `/src/app/(protected)/summary/page.tsx` - Summary page
- **Files Modified:** Navigation.tsx (Shops → Summary)
- **Files Deleted:** `/src/app/(protected)/shops/page.tsx`

### Phase 16 - Add RO & AI Tools (Previous)
- AddRODialog + createRepairOrder server action
- AI Assistant expanded with 4 new tools
- User Profile Dropdown with sign-out/switch account
- ExcelDropdownButton for Import/Sync operations