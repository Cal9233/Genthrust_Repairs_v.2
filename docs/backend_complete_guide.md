# GenThrust RO Tracker v2 - Backend Complete Guide

**Last Updated:** January 2026
**Audience:** Backend Engineers, New Team Members
**Purpose:** Comprehensive documentation of all backend architecture, data flows, and code patterns.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Structure](#2-directory-structure)
3. [Database Layer](#3-database-layer)
4. [Authentication System](#4-authentication-system)
5. [Server Actions](#5-server-actions)
6. [API Routes](#6-api-routes)
7. [Trigger.dev Background Tasks](#7-triggerdev-background-tasks)
8. [Microsoft Graph API Integration](#8-microsoft-graph-api-integration)
9. [Data Flow Patterns](#9-data-flow-patterns)
10. [Code Redundancies & Improvement Opportunities](#10-code-redundancies--improvement-opportunities)

---

## 1. Architecture Overview

GenThrust RO Tracker v2 is an aviation repair order management system following a **"Write-Behind" pattern**:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌──────────────┐
│   Next.js   │────▶│  Server Actions  │────▶│   MySQL     │────▶│ Trigger.dev  │
│     UI      │     │  (Mutations)     │     │ (Aiven)     │     │  (Workers)   │
└─────────────┘     └──────────────────┘     └─────────────┘     └──────────────┘
                                                                        │
                                                                        ▼
                                                              ┌─────────────────┐
                                                              │  SharePoint     │
                                                              │  Excel Sync     │
                                                              └─────────────────┘
```

### Core Principles

1. **MySQL is Source of Truth** - All mutations write to MySQL first
2. **Excel is Downstream Replica** - Never write to Excel synchronously from UI
3. **Durable Execution** - Long-running tasks run in Trigger.dev containers, not Vercel functions
4. **Human-in-the-Loop** - AI drafts emails, humans approve before sending

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (Strict mode) |
| Database | Aiven MySQL via Drizzle ORM |
| Background Jobs | Trigger.dev v3 |
| Authentication | Auth.js v5 + Microsoft Entra ID |
| AI | Vercel AI SDK + Claude |
| External Storage | SharePoint/OneDrive via Graph API |

---

## 2. Directory Structure

```
src/
├── app/
│   ├── actions/              # Server Actions (mutations & queries)
│   │   ├── dashboard.ts      # Dashboard stats & repair order queries
│   │   ├── repair-orders.ts  # RO CRUD operations
│   │   ├── notifications.ts  # Notification queue management
│   │   ├── inventory.ts      # Inventory search operations
│   │   ├── documents.ts      # SharePoint document operations
│   │   ├── sync.ts           # Manual Excel sync triggers
│   │   ├── import.ts         # Excel import operations
│   │   ├── summary.ts        # AI-powered RO summaries
│   │   └── forensics.ts      # Debugging utilities
│   │
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/route.ts  # Auth.js route handlers
│       └── chat/
│           └── route.ts                # AI chat endpoint
│
├── lib/
│   ├── db.ts                 # Database singleton connection
│   ├── schema.ts             # Drizzle ORM table schemas
│   ├── graph.ts              # Graph API client factory
│   ├── date-utils.ts         # Date parsing utilities
│   ├── batch-email-template.ts # Email template generation
│   │
│   ├── data/
│   │   ├── notifications.ts  # Notification data layer
│   │   └── shops.ts          # Shop lookup/email management
│   │
│   ├── graph/
│   │   ├── productivity.ts   # Calendar, To-Do, Email operations
│   │   ├── files.ts          # SharePoint file operations
│   │   ├── batch.ts          # Graph API batch operations
│   │   ├── excel-mapping.ts  # Excel <-> DB mapping
│   │   └── write-single-ro.ts # Single RO Excel write
│   │
│   ├── validation/
│   │   └── repair-order.ts   # Zod validation schemas
│   │
│   └── types/
│       ├── graph.ts          # Graph API types
│       └── notification.ts   # Notification types
│
├── trigger/
│   ├── excel-sync.ts         # Sync ROs to Excel worksheet
│   ├── import-from-excel.ts  # Import Excel data to MySQL
│   ├── ro-lifecycle-flow.ts  # Status change automation
│   ├── check-overdue-ros.ts  # Daily overdue checker (cron)
│   ├── send-approved-email.ts # Send approved notifications
│   └── ai-tools.ts           # AI tool implementations
│
├── auth.ts                   # Auth.js main configuration
└── auth.config.ts            # Edge-compatible auth config
```

---

## 3. Database Layer

### 3.1 Connection Singleton (`src/lib/db.ts`)

**Purpose:** Provides a singleton database connection to prevent connection pool exhaustion in serverless environments.

```typescript
// Key Implementation Pattern
const globalForDb = globalThis as unknown as { conn: mysql.Pool };
const poolConnection = globalForDb.conn ?? mysql.createPool({
  host: process.env.DATABASE_HOST,
  // ... config
  connectionLimit: 10,  // CRITICAL: Limits per container
});
if (process.env.NODE_ENV !== "production") globalForDb.conn = poolConnection;

export const db = drizzle(poolConnection);
```

**Why This Matters:**
- Serverless functions can spin up multiple instances
- Without singleton, each instance creates new connections
- MySQL has hard connection limits (~100-150 on Aiven)

### 3.2 Schema Definition (`src/lib/schema.ts`)

**Purpose:** Defines all database tables using Drizzle ORM.

#### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `active` | Active repair orders | ro, shopName, part, curentStatus |
| `net` | ROs awaiting NET payment | Same structure, finalCost as string |
| `paid` | Completed & paid ROs | Same structure |
| `returns` | Returned/cancelled ROs | Same structure |
| `notificationQueue` | Email/task approval queue | type, status, payload (JSON) |
| `roActivityLog` | Audit trail for changes | action, field, oldValue, newValue |
| `users` | Auth.js user records | id, name, email |
| `accounts` | OAuth tokens storage | access_token, refresh_token |
| `sessions` | Active sessions | sessionToken, expires |
| `inventoryindex` | Part inventory catalog | partNumber, description, quantity |
| `shops` | Shop directory with emails | shopName, email |
| `files_upload` | Document upload tracking | sharePointFileId, uploadedBy |

#### Schema Differences Between Tables

```typescript
// IMPORTANT: Tables have different column types!
// active.finalCost  = double
// paid.finalCost    = varchar (string)
// active.dateMade   = varchar (mm/dd/yy)
// net.dateMade      = datetime (ISO string)
```

This is handled by `normalizeRepairOrder()` in `dashboard.ts`.

---

## 4. Authentication System

### 4.1 Auth Configuration (`src/auth.config.ts`)

**Purpose:** Edge-compatible configuration for Next.js middleware.

```typescript
// Key OAuth Scopes Requested
scope: "openid profile email User.Read offline_access " +
       "Files.ReadWrite.All Sites.ReadWrite.All " +  // Excel sync
       "Calendars.ReadWrite Tasks.ReadWrite " +      // Reminders
       "Mail.Send Mail.ReadWrite"                    // Email
```

**Route Protection:**
- `/dashboard/*` routes require authentication
- `/signin` redirects authenticated users to dashboard

### 4.2 Auth Main (`src/auth.ts`)

**Purpose:** Full Auth.js configuration with database adapter.

**Key Callbacks:**

```typescript
// JWT callback - stores OAuth tokens
async jwt({ token, user, account }) {
  if (account) {
    token.accessToken = account.access_token;
    token.refreshToken = account.refresh_token;  // For background workers
    token.expiresAt = account.expires_at;
    token.userId = user?.id;
  }
  return token;
}

// Session callback - exposes user ID to client
async session({ session, token }) {
  session.user.id = token.userId;
  return session;
}
```

### 4.3 Token Refresh Flow (`src/lib/graph.ts`)

**Purpose:** Background workers need to refresh tokens since they run long after login.

```typescript
// Flow:
// 1. Worker needs to call Graph API
// 2. getGraphClient(userId) retrieves refresh_token from accounts table
// 3. Exchanges refresh_token for fresh access_token
// 4. Updates stored tokens (Microsoft rotates refresh_tokens!)
// 5. Returns authenticated Graph client
```

---

## 5. Server Actions

Server Actions are the primary data access layer. All use the standard Result type:

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: string };
```

### 5.1 Dashboard Actions (`src/app/actions/dashboard.ts`)

| Function | Purpose | Returns |
|----------|---------|---------|
| `getDashboardStats()` | KPI metrics for dashboard | DashboardStats |
| `getRepairOrders()` | Paginated active ROs with search | PaginatedRepairOrders |
| `getRepairOrderById()` | Single RO by database ID | RepairOrder \| null |
| `getRepairOrdersBySheet()` | Query any sheet (active/net/paid/returns) | PaginatedNormalizedRepairOrders |
| `getUniqueShops()` | Distinct shop names for filters | string[] |
| `getUniqueStatuses()` | Distinct statuses for filters | string[] |

**Key Implementation Details:**

```typescript
// Overdue calculation requires in-memory filtering
// because dates are stored as strings (mm/dd/yy)
const overdueResults = allResults.filter((r) => isOverdue(r.nextDateToUpdate));

// ARCHIVED_STATUSES are excluded from Active view
const ARCHIVED_STATUSES = ["COMPLETE", "NET", "PAID", "RETURNS", "BER", "RAI", "CANCELLED"];
```

### 5.2 Repair Order Actions (`src/app/actions/repair-orders.ts`)

| Function | Purpose | Side Effects |
|----------|---------|--------------|
| `createRepairOrder()` | Creates new RO | Triggers Excel sync, writes to Active sheet |
| `updateRepairOrder()` | Updates RO fields | Triggers Excel sync, logs activity |
| `updateRepairOrderStatus()` | Changes status | Triggers lifecycle flow, may move sheets |
| `softDeleteRepairOrder()` | Archives an RO | Moves to appropriate sheet |

**Status Change Flow:**

```typescript
// updateRepairOrderStatus() triggers background automation:
// 1. Updates MySQL immediately
// 2. Triggers "handle-ro-status-change" task
// 3. Task creates Calendar/To-Do reminders
// 4. Waits N days (durable wait)
// 5. Creates follow-up email draft if status unchanged
```

### 5.3 Notification Actions (`src/app/actions/notifications.ts`)

| Function | Purpose |
|----------|---------|
| `getPendingNotifications()` | Fetch pending email drafts |
| `approveNotification()` | Approve and trigger send |
| `rejectNotification()` | Reject and mark as rejected |
| `updateNotificationPayload()` | Edit email before sending |
| `combineNotifications()` | Merge multiple ROs into one email |
| `approveBatchNotifications()` | Approve combined email |

**Approval Flow:**

```typescript
// 1. User clicks "Approve" in UI
// 2. approveNotification() updates status to APPROVED
// 3. Triggers "send-approved-email" task
// 4. Task sends via Graph API
// 5. Updates status to SENT, stores Outlook message IDs
```

### 5.4 Document Actions (`src/app/actions/documents.ts`)

| Function | Purpose |
|----------|---------|
| `uploadDocument()` | Upload file to SharePoint |
| `listDocuments()` | List RO's documents |
| `deleteDocument()` | Remove from SharePoint |
| `getDownloadUrl()` | Get temporary download link |

**File Size Limit:**
```typescript
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB - Graph API simple upload limit
```

### 5.5 Inventory Actions (`src/app/actions/inventory.ts`)

| Function | Purpose |
|----------|---------|
| `searchInventory()` | Search parts by number/description |
| `getWarehouseOverview()` | Aggregate counts by warehouse |

### 5.6 Sync Actions (`src/app/actions/sync.ts`)

| Function | Purpose |
|----------|---------|
| `triggerExcelSync()` | Manually sync specific ROs to Excel |
| `triggerFullSync()` | Sync all active ROs |

### 5.7 Import Actions (`src/app/actions/import.ts`)

| Function | Purpose |
|----------|---------|
| `triggerImportFromExcel()` | Import all sheets from Excel to MySQL |

---

## 6. API Routes

### 6.1 Auth Route (`src/app/api/auth/[...nextauth]/route.ts`)

**Purpose:** Handles OAuth callbacks, session management.

```typescript
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

### 6.2 Chat Route (`src/app/api/chat/route.ts`)

**Purpose:** AI assistant endpoint using Vercel AI SDK.

**Available Tools:**

| Tool | Purpose | Write? |
|------|---------|--------|
| `search_repair_orders` | Find ROs by criteria | No |
| `get_repair_order` | Get single RO details | No |
| `search_inventory` | Search parts inventory | No |
| `create_repair_order` | Create new RO | Yes |
| `update_repair_order` | Update RO fields | Yes |
| `archive_repair_order` | Move RO to archive sheet | Yes |
| `create_email_draft` | Draft follow-up email | Yes |

**Key Configuration:**

```typescript
const result = streamText({
  model: anthropic("claude-sonnet-4-20250514"),
  messages,
  tools,
  stopWhen: stepCountIs(10),  // CRITICAL: Enables multi-step tool use
});

// Write tools call revalidatePath("/dashboard") to bust cache
```

---

## 7. Trigger.dev Background Tasks

All long-running operations use Trigger.dev for durable execution.

### 7.1 Excel Sync (`src/trigger/excel-sync.ts`)

**Task ID:** `sync-repair-orders`

**Purpose:** Syncs MySQL changes to SharePoint Excel.

**Flow:**
1. Creates Excel session with `persistChanges: true`
2. Reads existing rows to find matching RO numbers
3. Batches updates (max 20 per batch - Graph API limit)
4. Closes session to save changes

**Key Pattern:**
```typescript
// Session management prevents file corruption
const session = await createExcelSession(client, workbookId);
try {
  // ... batch updates
} finally {
  await closeExcelSession(client, workbookId, session.id);
}
```

### 7.2 Import from Excel (`src/trigger/import-from-excel.ts`)

**Task ID:** `import-from-excel`

**Purpose:** Imports all 4 Excel sheets to MySQL tables.

**Sheets Mapped:**
- Active → `active` table
- NET → `net` table
- Paid → `paid` table
- Returns → `returns` table

**Upsert Logic:**
```typescript
// Uses RO number as unique key
// Existing ROs: UPDATE
// New ROs: INSERT
```

### 7.3 RO Lifecycle Flow (`src/trigger/ro-lifecycle-flow.ts`)

**Task ID:** `handle-ro-status-change`

**Purpose:** Automates follow-ups based on status changes.

**Status Configurations:**

| Status | Wait Days | Action |
|--------|-----------|--------|
| WAITING QUOTE | 7 | Email asking for quote |
| APPROVED | 10 | Email checking repair progress |
| IN WORK / IN PROGRESS | 10 | Email checking progress |
| SHIPPED / IN TRANSIT | 5 | Email asking for tracking |
| RECEIVED (with NET terms) | 0 | Creates payment reminder |

**Durable Wait Pattern:**
```typescript
// This survives server restarts!
await wait.for({ days: config.waitDays });
```

### 7.4 Overdue Checker (`src/trigger/check-overdue-ros.ts`)

**Task ID:** `check-overdue-ros`
**Schedule:** Daily at 8:00 AM UTC

**Purpose:** Safety net for ROs that missed real-time triggers.

**Steps:**
1. Bumps stale pending notifications (24h+) to top of queue
2. Finds overdue ROs (nextDateToUpdate < today)
3. Creates follow-up email drafts for approval

### 7.5 Send Approved Email (`src/trigger/send-approved-email.ts`)

**Task ID:** `send-approved-email`

**Purpose:** Sends human-approved notifications.

**Features:**
- Email threading via conversation IDs
- CC support
- Auto-updates shop email for future use
- Resets RO follow-up dates after sending
- Triggers Excel sync for date columns

### 7.6 AI Tools (`src/trigger/ai-tools.ts`)

**Purpose:** Durable task wrappers for AI tool operations.

| Task ID | Purpose |
|---------|---------|
| `ai-tool-search-inventory` | Search inventory with retries |
| `ai-tool-get-repair-order` | Get RO with retries |
| `ai-tool-create-repair-order` | Create RO + Excel sync |
| `ai-tool-update-repair-order` | Update RO + Excel sync |
| `ai-tool-archive-repair-order` | Archive RO + sheet move |
| `ai-tool-create-email-draft` | Create Outlook draft |

---

## 8. Microsoft Graph API Integration

### 8.1 Graph Client Factory (`src/lib/graph.ts`)

**Purpose:** Creates authenticated Graph clients for background workers.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `getGraphClient(userId)` | Get authenticated client |
| `createExcelSession()` | Start batch Excel session |
| `closeExcelSession()` | Save and close session |
| `getWorkbookBasePath()` | Build SharePoint path |
| `chunkArray()` | Split into batches of 20 |

### 8.2 Productivity APIs (`src/lib/graph/productivity.ts`)

| Function | Purpose |
|----------|---------|
| `createCalendarEvent()` | Create Outlook calendar event |
| `createToDoTask()` | Create Microsoft To-Do task |
| `sendEmail()` | Send email (supports threading, CC) |
| `createDraftEmail()` | Create email draft |
| `getConversationMessages()` | Fetch email thread history |

**Shared Mailbox Support:**
```typescript
// If MS_GRAPH_SHARED_MAILBOX is set, emails send from that address
const sharedMailbox = process.env.MS_GRAPH_SHARED_MAILBOX;
if (sharedMailbox) {
  message.from = { emailAddress: { address: sharedMailbox } };
}
```

### 8.3 File Operations (`src/lib/graph/files.ts`)

| Function | Purpose |
|----------|---------|
| `ensureROFolder()` | Create RO folder if missing |
| `uploadRODocument()` | Upload file to RO folder |
| `listRODocuments()` | List files in RO folder |
| `deleteRODocument()` | Delete file |
| `getDocumentDownloadUrl()` | Get temporary download URL |

**Folder Structure:**
```
SharePoint Site/
└── Documents/
    └── Repair Orders/
        ├── RO-12345/
        │   ├── quote.pdf
        │   └── invoice.pdf
        └── RO-12346/
            └── cert.pdf
```

### 8.4 Excel Batch Operations (`src/lib/graph/batch.ts`)

| Function | Purpose |
|----------|---------|
| `executeBatch()` | Execute batched requests |
| `buildUpdateRowRequest()` | Build PATCH for single row |
| `buildDeleteRowRequest()` | Build DELETE for row |
| `buildBatchUpdateRequests()` | Build multiple updates |
| `analyzeBatchResponse()` | Check for errors |

**Batch Limit:**
```typescript
if (requests.length > 20) {
  throw new Error("Batch request exceeds 20 item limit");
}
```

### 8.5 Excel Mapping (`src/lib/graph/excel-mapping.ts`)

**Purpose:** Maps between database columns and Excel columns.

**Column Order (A-U):**
```typescript
const EXCEL_COLUMNS = [
  "ro", "dateMade", "shopName", "part", "serial",
  "partDescription", "reqWork", "dateDroppedOff",
  "estimatedCost", "finalCost", "terms", "shopRef",
  "estimatedDeliveryDate", "curentStatus", "curentStatusDate",
  "genthrustStatus", "shopStatus", "trackingNumberPickingUp",
  "notes", "lastDateUpdated", "nextDateToUpdate"
];
```

**Key Functions:**
| Function | Purpose |
|----------|---------|
| `dbRowToExcelRow()` | Convert DB record to Excel row |
| `excelRowToDbRow()` | Convert Excel row to DB record |
| `excelRowToDbRowForTable()` | Table-specific conversion |
| `parseCurrency()` | Handle "$1,500" format |
| `parseDate()` | Handle ISO and mm/dd/yy formats |
| `cleanStatus()` | Remove trailing symbols like ">>>>" |

---

## 9. Data Flow Patterns

### 9.1 Creating a Repair Order

```
┌───────┐    ┌──────────────────────┐    ┌───────┐    ┌──────────────┐
│  UI   │───▶│ createRepairOrder()  │───▶│ MySQL │───▶│ sync-repair- │
│ Form  │    │ (Server Action)      │    │       │    │ orders task  │
└───────┘    └──────────────────────┘    └───────┘    └──────────────┘
                                                             │
                                                             ▼
                                                      ┌──────────────┐
                                                      │ SharePoint   │
                                                      │ Excel        │
                                                      └──────────────┘
```

### 9.2 Status Change Automation

```
┌───────┐    ┌────────────────────────┐    ┌───────┐    ┌──────────────────┐
│Status │───▶│updateRepairOrderStatus │───▶│MySQL  │───▶│handle-ro-status- │
│Dropdown│   │(Server Action)         │    │       │    │change task       │
└───────┘    └────────────────────────┘    └───────┘    └──────────────────┘
                                                               │
                                           ┌───────────────────┼───────────────────┐
                                           ▼                   ▼                   ▼
                                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                                    │  Calendar   │     │   To-Do     │     │ wait.for()  │
                                    │   Event     │     │    Task     │     │  N days     │
                                    └─────────────┘     └─────────────┘     └─────────────┘
                                                                                   │
                                                                                   ▼
                                                                            ┌─────────────┐
                                                                            │ Email Draft │
                                                                            │ in Queue    │
                                                                            └─────────────┘
```

### 9.3 Email Approval Flow

```
┌──────────┐    ┌───────────────────┐    ┌─────────┐    ┌───────────────────┐
│Notifica- │───▶│approveNotification│───▶│ MySQL   │───▶│send-approved-email│
│tion Bell │    │(Server Action)    │    │APPROVED │    │     task          │
└──────────┘    └───────────────────┘    └─────────┘    └───────────────────┘
                                                               │
                                                               ▼
                                                        ┌─────────────┐
                                                        │ Graph API   │
                                                        │ sendEmail() │
                                                        └─────────────┘
                                                               │
                                           ┌───────────────────┼───────────────────┐
                                           ▼                   ▼                   ▼
                                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                                    │Update Shop  │     │ Reset RO    │     │ Sync to     │
                                    │Email (if    │     │ Follow-up   │     │   Excel     │
                                    │ different)  │     │   Dates     │     │             │
                                    └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 10. Code Redundancies & Improvement Opportunities

### 10.1 Duplicate Status Handling Logic

**Location:** Multiple files
**Files Affected:**
- `src/app/actions/dashboard.ts` (lines 199-217)
- `src/trigger/ro-lifecycle-flow.ts` (lines 61-207)
- `src/trigger/check-overdue-ros.ts` (lines 109-117)

**Issue:** Status normalization and matching logic is duplicated.

```typescript
// dashboard.ts - Status matching
if (status === "WAITING QUOTE" || status === "WAITING FOR QUOTE" ||
    status === "AWAITING QUOTE" || status === "PENDING") {
  waitingQuote++;
}

// Should be centralized as:
// src/lib/constants/statuses.ts
export const STATUS_GROUPS = {
  WAITING_QUOTE: ["WAITING QUOTE", "WAITING FOR QUOTE", "AWAITING QUOTE", "PENDING"],
  IN_WORK: ["IN WORK", "IN PROGRESS", "WORKING"],
  SHIPPED: ["SHIPPED", "IN TRANSIT", "CURRENTLY BEING SHIPPED", "SHIPPING"],
  // ...
};

export function matchesStatusGroup(status: string, group: keyof typeof STATUS_GROUPS): boolean {
  return STATUS_GROUPS[group].some(s =>
    status.toUpperCase().trim().startsWith(s)
  );
}
```

**Improvement:** Create `src/lib/constants/statuses.ts` with centralized status configuration.

---

### 10.2 Repeated Date Parsing

**Location:** Multiple files
**Files Affected:**
- `src/lib/date-utils.ts`
- `src/lib/graph/excel-mapping.ts` (lines 156-224, 360-404)

**Issue:** Date parsing logic is implemented twice with slight variations.

```typescript
// excel-mapping.ts has its own parseDate() and parseDateToISO()
// date-utils.ts has parseDate() and isOverdue()
```

**Improvement:** Consolidate all date utilities into `src/lib/date-utils.ts`:

```typescript
// Unified date utilities
export const dateUtils = {
  parseToDate(value: unknown): Date | null,
  formatUS(date: Date): string,      // mm/dd/yy
  formatISO(date: Date): string,     // YYYY-MM-DD HH:mm:ss
  isOverdue(dateStr: string | null): boolean,
  parseExcelSerial(serial: number): Date,
};
```

---

### 10.3 Duplicate Email Template Generation

**Location:** Two separate email template systems
**Files Affected:**
- `src/trigger/ro-lifecycle-flow.ts` (lines 61-207)
- `src/trigger/check-overdue-ros.ts` (lines 109-117)
- `src/lib/batch-email-template.ts`

**Issue:** Email templates are defined inline in multiple places.

```typescript
// ro-lifecycle-flow.ts
emailBody: (roNumber, partNumber) =>
`Hi Team,

Just checking in on RO# G${roNumber} for part ${partNumber}.
...`

// check-overdue-ros.ts
const body = `Hi Team,

Just checking in on RO# G${roNumber} for part ${partNumber}.
...`
```

**Improvement:** Create `src/lib/templates/emails.ts`:

```typescript
export const emailTemplates = {
  followUp: (params: { roNumber: number; partNumber: string }) => ({
    subject: `Follow-up: RO# G${params.roNumber}`,
    body: `Hi Team,\n\nJust checking in on RO# G${params.roNumber}...`,
  }),
  quoteRequest: (params) => ({ ... }),
  trackingRequest: (params) => ({ ... }),
};
```

---

### 10.4 Inconsistent Result Type Usage

**Location:** Server Actions
**Files Affected:**
- `src/app/actions/documents.ts`
- `src/app/actions/sync.ts`

**Issue:** Some functions return different Result type shapes.

```typescript
// documents.ts returns custom shape
return { success: true, documents, folderUrl };

// dashboard.ts uses standard Result<T>
type Result<T> = { success: true; data: T } | { success: false; error: string };
```

**Improvement:** Standardize all actions to use `Result<T>`:

```typescript
// documents.ts should be:
return {
  success: true,
  data: { documents, folderUrl }
};
```

---

### 10.5 Repeated Graph Client Initialization Pattern

**Location:** Graph API functions
**Files Affected:**
- `src/lib/graph/productivity.ts` (repeated in each function)
- `src/lib/graph/files.ts` (repeated in each function)

**Issue:** Each function calls `getGraphClient(userId)` separately.

```typescript
// Every function starts with:
export async function createCalendarEvent(userId, ...) {
  const graphClient = await getGraphClient(userId);
  // ...
}

export async function createToDoTask(userId, ...) {
  const graphClient = await getGraphClient(userId);
  // ...
}
```

**Improvement:** Create a Graph service class or use function composition:

```typescript
// Option 1: Service class
class GraphService {
  private client: Client;

  static async create(userId: string) {
    const client = await getGraphClient(userId);
    return new GraphService(client);
  }

  async createCalendarEvent(...) { ... }
  async createToDoTask(...) { ... }
}

// Usage:
const graph = await GraphService.create(userId);
await graph.createCalendarEvent(...);
await graph.createToDoTask(...);
```

---

### 10.6 Hardcoded Company Name

**Location:** Email templates
**Files Affected:**
- `src/trigger/ro-lifecycle-flow.ts` (6 occurrences)
- `src/trigger/check-overdue-ros.ts` (1 occurrence)
- `src/lib/batch-email-template.ts` (1 occurrence)

**Issue:** Company name "Genthrust XVII, LLC" is hardcoded throughout.

```typescript
// Multiple places have:
Thanks!
Genthrust XVII, LLC`;
```

**Improvement:** Create environment variable or constant:

```typescript
// src/lib/constants/company.ts
export const COMPANY_NAME = process.env.COMPANY_NAME || "Genthrust XVII, LLC";
export const COMPANY_EMAIL = process.env.COMPANY_EMAIL || "repairs@genthrust.com";

// Email templates use:
import { COMPANY_NAME } from "@/lib/constants/company";
`Thanks!\n${COMPANY_NAME}`;
```

---

### 10.7 Missing Error Logging Standardization

**Location:** Throughout codebase
**Issue:** Inconsistent error logging patterns.

```typescript
// Some use console.error
console.error("getDashboardStats error:", error);

// Some use logger
logger.error("Failed to process notification", { error });

// Some have detailed context, some don't
```

**Improvement:** Create standardized logging utility:

```typescript
// src/lib/logging.ts
import { logger as triggerLogger } from "@trigger.dev/sdk/v3";

export const log = {
  error: (message: string, context: Record<string, unknown>) => {
    // In Trigger.dev context
    if (typeof triggerLogger !== "undefined") {
      triggerLogger.error(message, context);
    }
    // In Next.js context
    console.error(`[ERROR] ${message}`, context);
  },
  // ...
};
```

---

### 10.8 Schema Type Inference Could Be Centralized

**Location:** Multiple files doing type inference
**Files Affected:**
- `src/app/actions/dashboard.ts` (line 12)
- `src/trigger/ai-tools.ts` (lines 8-9)
- `src/lib/graph/excel-mapping.ts` (lines 5-8)

**Issue:** Same type inference done in multiple places.

```typescript
// dashboard.ts
export type RepairOrder = typeof active.$inferSelect;

// ai-tools.ts
export type RepairOrder = typeof active.$inferSelect;
export type InventoryItem = typeof inventoryindex.$inferSelect;
```

**Improvement:** Create centralized types file:

```typescript
// src/lib/types/schema.ts
import { active, net, paid, returns, inventoryindex, notificationQueue } from "../schema";

export type RepairOrder = typeof active.$inferSelect;
export type NetRepairOrder = typeof net.$inferSelect;
export type PaidRepairOrder = typeof paid.$inferSelect;
export type ReturnRepairOrder = typeof returns.$inferSelect;
export type InventoryItem = typeof inventoryindex.$inferSelect;
export type Notification = typeof notificationQueue.$inferSelect;

// Re-export from single location
export * from "./schema";
```

---

## Summary

This guide covers the complete backend architecture of GenThrust RO Tracker v2. Key takeaways:

1. **MySQL is always written first** - Excel sync happens asynchronously
2. **Trigger.dev handles all long-running operations** - Email sending, Excel sync, status automation
3. **Human-in-the-loop for emails** - AI drafts, humans approve
4. **Token refresh is critical** - Background workers need fresh tokens
5. **Batch operations respect Graph API limits** - Max 20 requests per batch

For questions or updates to this guide, contact the backend team.
