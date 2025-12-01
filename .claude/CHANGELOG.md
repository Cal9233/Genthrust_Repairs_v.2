# Changelog

All notable changes to the GenThrust RO Tracker v2 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.0] - 2025-11-29

### Phase 1: Foundation

Initial setup of the authentication and database infrastructure.

### Added

#### Authentication (Auth.js v5)
- Microsoft Entra ID (Azure AD) provider configuration
- JWT session strategy with 30-day expiration
- Edge-compatible middleware for route protection
- Server actions: `signInAction()`, `signOutAction()`
- OAuth token storage including `refresh_token` for background workers
- Sign-in page at `/signin` with shadcn/ui styling
- Protected dashboard at `/dashboard` showing user info

#### Database (Drizzle ORM + Aiven MySQL)
- Global Singleton pattern for connection pooling (`connectionLimit: 10`)
- SSL configuration for Aiven cloud database
- Schema introspection to preserve existing 18 inventory tables
- 5 new Auth.js tables:
  - `users` - User profiles
  - `accounts` - OAuth accounts with refresh tokens
  - `sessions` - Session storage
  - `verificationTokens` - Email verification
  - `authenticators` - WebAuthn support

#### UI Components (shadcn/ui)
- Button component
- Card component
- Avatar component
- Updated home page with auth-aware navigation

#### Configuration Files
- `drizzle.config.ts` - Drizzle Kit configuration
- `src/auth.config.ts` - Edge-compatible auth config
- `src/auth.ts` - Main auth config with DrizzleAdapter
- `components.json` - shadcn/ui configuration
- `.env.local` - Environment variables template

### Technical Details

#### File Structure
```
src/
├── lib/
│   ├── db.ts              # Database connection (Global Singleton)
│   ├── schema.ts          # Combined inventory + auth schema
│   └── utils.ts           # Utility functions (cn)
├── components/ui/         # shadcn/ui components
├── auth.ts                # Auth.js main configuration
├── auth.config.ts         # Edge-compatible auth config
├── actions/auth.ts        # Server actions
├── middleware.ts          # Route protection
└── app/
    ├── api/auth/[...nextauth]/route.ts
    ├── (auth)/signin/page.tsx
    └── (protected)/dashboard/page.tsx
```

#### Environment Variables Required
```env
DATABASE_HOST=
DATABASE_PORT=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=
AUTH_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=
AUTH_MICROSOFT_ENTRA_ID_ISSUER=
NEXTAUTH_URL=
```

#### Preserved Inventory Tables
- `active` - Active repair orders
- `b_e_r_r_a_i` - B.E.R.R.A.I parts
- `bins_inventory_actual` - Bins inventory
- `delta_apa` - Delta APA parts
- `hold` - Hold items
- `inventoryindex` - Inventory index
- `logs` - System logs
- `net` - Net items
- `paid` - Paid orders
- `partes_ar_asia` - AR Asia parts
- `partes_ar_asia_sanford` - AR Asia Sanford parts
- `partes_bolivia` - Bolivia parts
- `pn_no_reparadas_727` - 727 unrepairable parts
- `pn_no_reparadas_md82` - MD82 unrepairable parts
- `returns` - Returns
- `shops` - Shop information
- `stock_room_actual` - Stock room
- `terra` - Terra parts

### Dependencies Added
- `next-auth@beta` - Auth.js v5
- `@auth/drizzle-adapter` - Drizzle adapter for Auth.js
- `drizzle-orm` - TypeScript ORM
- `mysql2` - MySQL driver
- `drizzle-kit` - Migration tooling (dev)
- `class-variance-authority` - shadcn/ui dependency
- `clsx` - shadcn/ui dependency
- `tailwind-merge` - shadcn/ui dependency
- `lucide-react` - Icon library
- `@radix-ui/react-avatar` - Avatar primitive
- `@radix-ui/react-slot` - Slot primitive

---

## [0.2.0] - 2025-11-29

### Phase 2: Inventory Search

Implemented the inventory search feature using Next.js Server Actions.

### Added

#### Server Actions (`src/app/actions/inventory.ts`)
- `searchInventory(query: string)` - Fuzzy search on `inventoryindex` table
  - Searches both `partNumber` and `description` columns using SQL `LIKE`
  - Returns `Result<T>` type per CLAUDE.md guidelines
  - Limited to 50 results to prevent UI flooding
  - Minimum 2 character query requirement

#### Hooks (`src/hooks/useDebounce.ts`)
- `useDebounce<T>(value, delay)` - Generic debounce hook
  - 300ms default delay
  - Prevents excessive DB queries during typing

#### Components
- `InventorySearch` (`src/components/inventory/InventorySearch.tsx`)
  - Client component with debounced search-as-you-type
  - Uses `useTransition` for non-blocking search
  - Displays results in shadcn/ui Table
  - Shows loading state, error handling, and empty state

#### Pages
- Inventory page at `/inventory` (protected route)
  - Located at `src/app/(protected)/inventory/page.tsx`

#### UI Components (shadcn/ui)
- Input component (`src/components/ui/input.tsx`)
- Table component (`src/components/ui/table.tsx`)

### Technical Details

#### File Structure Added
```
src/
├── app/
│   ├── (protected)/
│   │   └── inventory/
│   │       └── page.tsx          # Inventory search page
│   └── actions/
│       └── inventory.ts          # Server actions
├── components/
│   ├── inventory/
│   │   └── InventorySearch.tsx   # Search component
│   └── ui/
│       ├── input.tsx             # shadcn Input
│       └── table.tsx             # shadcn Table
└── hooks/
    └── useDebounce.ts            # Debounce hook
```

#### Search Implementation
- Uses Drizzle ORM `like()` with `%query%` pattern
- Searches on indexed `partNumber` column for performance
- Falls back to `description` column for broader matches

### Dependencies Added
- None (uses existing Drizzle ORM and shadcn/ui infrastructure)

---

## [0.3.0] - 2025-11-29

### Phase 3: Trigger.dev Orchestration

Integrated Trigger.dev v3 for durable background task execution, solving the "Timeout Fragility" issue from the legacy app.

### Added

#### Task Definition (`src/trigger/excel-sync.ts`)
- `syncRepairOrders` task for background Excel sync operations
  - Accepts payload: `{ batchId: string, repairOrderIds: string[] }`
  - Configured with `machine: { preset: "small-1x" }` (2GB RAM for large Excel files)
  - Progress tracking via `metadata.set()` for realtime UI updates
  - Three-phase execution: initializing → processing → finishing
  - Zod schema validation for type-safe payloads
  - Retry configuration: 3 attempts with exponential backoff

#### Server Actions (`src/app/actions/sync.ts`)
- `triggerSync(payload)` - Dispatches sync job to Trigger.dev
  - Authenticates user via Auth.js session
  - Validates payload (batchId, repairOrderIds required)
  - Returns `{ runId, publicAccessToken }` for realtime tracking
  - Follows `Result<T>` pattern per CLAUDE.md
- `triggerSyncBatch(batchId)` - Placeholder for Phase 4 database integration

#### React Hooks (`src/hooks/use-trigger-run.ts`)
- `useTriggerRun(runId, accessToken)` - Wraps Trigger.dev's `useRealtimeRun`
  - Exposes: `status`, `progress` (0-100), `output`, `error`
  - Additional state: `isRunning`, `isComplete`, `totalItems`, `processedItems`
  - Status types: `idle | starting | initializing | processing | finishing | completed | failed | canceled`
- `useTriggerRunWithProgress()` - Extended version with stream support for logs

#### Configuration
- `trigger.config.ts` - Trigger.dev v3 project configuration
  - Tasks directory: `src/trigger/`
  - Max duration: 600 seconds (10 minutes)
  - Default retry: 3 attempts with exponential backoff

### Technical Details

#### File Structure Added
```
├── trigger.config.ts                    # Trigger.dev configuration
└── src/
    ├── trigger/
    │   └── excel-sync.ts                # Background task definition
    ├── hooks/
    │   └── use-trigger-run.ts           # Realtime progress hook
    └── app/actions/
        └── sync.ts                      # Server action for triggering jobs
```

#### Architecture Flow (Write-Behind Pattern)
```
UI Component
    ↓ calls
triggerSync() Server Action
    ↓ authenticates, then
tasks.trigger("sync-repair-orders", payload)
    ↓ returns
{ runId, publicAccessToken }
    ↓ monitored by
useTriggerRun(runId, accessToken)
    ↓ exposes
{ status, progress, output, error }
```

#### Environment Variables Required
```env
TRIGGER_SECRET_KEY=tr_dev_xxxxx  # From Trigger.dev dashboard
```

### Dependencies Added
- `@trigger.dev/sdk` - Trigger.dev v3 SDK for task definition and triggering
- `@trigger.dev/react-hooks` - React hooks for realtime run monitoring
- `zod` - Schema validation for task payloads

---

## [0.4.0] - 2025-11-29

### Phase 4: Microsoft Graph API Integration

Full implementation of the Excel sync engine using Microsoft Graph API with durable execution.

### Added

#### Graph API Client (`src/lib/graph.ts`)
- `getGraphClient(userId)` - Retrieves refresh_token from DB, exchanges for fresh access_token
- `createExcelSession()` - Creates persistent session with `persistChanges: true`
- `closeExcelSession()` - Properly closes session to persist all changes
- `getWorkbookBasePath()` - Builds Graph API URLs for SharePoint/OneDrive
- `chunkArray()` - Chunks arrays into groups of 20 (Graph API batch limit)
- Automatic token rotation (Microsoft rotates refresh_tokens)

#### Batch Processing (`src/lib/graph/batch.ts`)
- `buildBatchUpdateRequests()` - Creates PATCH requests for row updates
- `executeBatch()` - Posts batch to `/$batch` endpoint with session header
- `analyzeBatchResponse()` - Analyzes results for errors and rate limits
- `hasRateLimitError()` - Detects 429 responses for retry handling

#### Excel Mapping (`src/lib/graph/excel-mapping.ts`)
- `dbRowToExcelRow()` - Converts database row to Excel array format
- `getRowRangeAddress()` - Generates Excel range addresses (e.g., "Active!A5:U5")
- Column mapping from 21 database fields to Excel columns A-U

#### Excel Search (`src/lib/graph/excel-search.ts`)
- `findRowsByRO()` - Searches RO column (A2:A10000) to find existing rows
- `getNextAvailableRow()` - Uses `usedRange` endpoint to find next empty row

#### Type Definitions (`src/lib/types/graph.ts`)
- `TokenResponse` - OAuth token response structure
- `ExcelSession` - Excel session object
- `UserNotConnectedError` - Custom error for missing Microsoft auth
- `TokenRefreshError` - Custom error for token refresh failures

#### Full Sync Task (`src/trigger/excel-sync.ts`)
- 4-phase execution with progress tracking:
  - **Phase 1 (10%)**: Authenticate user, create Excel session
  - **Phase 2 (15%)**: Fetch repair orders from MySQL, find existing Excel rows
  - **Phase 3 (15-90%)**: Process chunks of 20 orders, batch updates/inserts
  - **Phase 4 (95-100%)**: Close Excel session, return summary
- Uses `metadata.set()` for real-time progress tracking
- Separates insert vs. update logic based on RO number lookup
- Rate limit handling (429 errors) triggers Trigger.dev retry
- Returns: `{ syncedCount, failedCount, rowsUpdated, rowsAdded, errors? }`

### Technical Details

#### File Structure Added
```
src/lib/
├── graph.ts                    # Main Graph client
├── graph/
│   ├── batch.ts               # JSON batching utilities
│   ├── excel-mapping.ts       # DB to Excel column mapping
│   └── excel-search.ts        # Row lookup functions
└── types/
    └── graph.ts               # TypeScript definitions
```

#### Environment Variables Required
```env
SHAREPOINT_SITE_ID=             # SharePoint site ID (from Graph Explorer)
EXCEL_WORKBOOK_ID=              # Workbook item ID
EXCEL_WORKSHEET_NAME=Active     # Worksheet name (default: Active)
```

### Dependencies Added
- `@microsoft/microsoft-graph-client` - Official Microsoft Graph SDK
- `isomorphic-fetch` - Fetch polyfill for Node.js (Trigger.dev containers)

---

## [0.4.5] - 2025-11-29

### Phase 4.5: UI Integration

Real-time sync UI with progress tracking and dashboard integration.

### Added

#### SyncStatus Component (`src/components/sync/SyncStatus.tsx`)
- "Sync to Excel" button with loading state
- Real-time progress bar (0-100%)
- 8 status states: idle, starting, initializing, fetching, processing, finishing, completed, failed
- Success summary: rows updated, rows added, failed count
- Error display with retry capability
- "Sync Again" button after completion
- Optimistic UI: button disabled during sync

#### Progress Component (`src/components/ui/progress.tsx`)
- Radix UI Progress bar primitive
- Accessible progress indicator

#### Dashboard Integration (`src/app/(protected)/dashboard/page.tsx`)
- User profile card (avatar, name, email, user ID)
- Sign out button
- Excel Sync Status card
- Responsive card-based layout

#### React Hooks (`src/hooks/use-trigger-run.ts`)
- `useTriggerRun(runId, accessToken)` - Wraps Trigger.dev realtime hooks
- Extracts metadata: status, progress, totalItems, processedItems
- Maps Trigger.dev run states to custom SyncStatus types

### Technical Details

#### File Structure Added
```
src/
├── components/
│   ├── sync/
│   │   └── SyncStatus.tsx      # Sync status card
│   └── ui/
│       └── progress.tsx        # Progress bar
└── app/(protected)/
    └── dashboard/
        └── page.tsx            # Updated with SyncStatus
```

### Dependencies Added
- `@radix-ui/react-progress` - Progress bar primitive

---

## [0.5.0] - 2025-11-30

### Phase 5: Production Hardening

Bug fixes and improvements for Trigger.dev worker compatibility.

### Fixed

#### Lazy Environment Variable Loading (`src/lib/graph.ts`)
- **Problem**: Environment variables read at module load time were `undefined` in Trigger.dev workers
- **Solution**: Moved env var reads inside functions (lazy loading)
- Changed from `SHAREPOINT_HOSTNAME` + `SHAREPOINT_SITE_PATH` to single `SHAREPOINT_SITE_ID`
- Fixed tenant ID loading for single-tenant Microsoft OAuth

#### Trigger.dev Build Configuration (`trigger.config.ts`)
- Added `@trigger.dev/build` package for build extensions
- Configured external packages: `isomorphic-fetch`, `@microsoft/microsoft-graph-client`
- Added `additionalPackages` extension for container installation

### Changed

#### Simplified SharePoint URL Construction
- **Before**: Complex `hostname:path` format prone to errors
- **After**: Simple `/sites/{siteId}/drive/items/{itemId}/workbook` format
- Single `SHAREPOINT_SITE_ID` env var instead of two separate vars

### Technical Details

#### Environment Variables Updated
```env
# Removed:
# SHAREPOINT_HOSTNAME=
# SHAREPOINT_SITE_PATH=

# Added:
SHAREPOINT_SITE_ID=hostname,webId,siteId  # From Graph Explorer
```

### Dependencies Added
- `@trigger.dev/build` - Build extensions for Trigger.dev

---

## [0.6.0] - 2025-11-30

### Phase 6: UI Revamp - Aerospace Design System

Complete visual redesign with custom GenThrust branding and improved navigation.

### Added

#### Color System (`src/app/globals.css`)
- **Primary Blues:**
  - `--primary-deep-blue`: #0c4a6e (sky-900)
  - `--primary-bright-blue`: #0284c7 (sky-600)
- **Accent Colors:**
  - `--accent-electric`: #06b6d4 (cyan-500)
  - `--accent-sunset`: #f97316 (orange-500)
- **Semantic Colors:**
  - `--success-green`: #22c55e
  - `--warning-amber`: #f59e0b
  - `--danger-red`: #ef4444
- Tailwind v4 `@theme inline` mappings for all colors

#### Custom Utilities (`src/app/globals.css`)
- `.bg-diagonal-lines` - Subtle aerospace-inspired diagonal pattern
- `.shadow-vibrant` - Layered cyan/blue shadow for cards
- `.animate-accordion-down` / `.animate-accordion-up` - Radix accordion animations

#### Layout Components
- **Header** (`src/components/layout/Header.tsx`)
  - Sticky header with gradient background
  - Brand logo "GenThrust RO Tracker"
  - User avatar from Microsoft auth session
  - Server component with `auth()` session access

- **Navigation** (`src/components/layout/Navigation.tsx`)
  - Tab bar with Dashboard, Inventory, Shops links
  - Active state: white pill with shadow
  - Inactive state: semi-transparent hover
  - Icons from lucide-react (LayoutDashboard, Package, Building2)
  - Client component with `usePathname()` for active detection

#### Pages
- **Shops** (`src/app/(protected)/shops/page.tsx`)
  - Placeholder page for repair shop management
  - Coming soon messaging

### Changed

#### Protected Layout (`src/app/(protected)/layout.tsx`)
- Integrated Header and Navigation as authenticated shell
- Flex column layout with sticky header
- Main content area with `flex-1` for proper height

#### Dashboard (`src/app/(protected)/dashboard/page.tsx`)
- Removed full-page centering (now uses shell layout)
- 2-column responsive grid layout
- Simplified user card (avatar now in header)
- Container-based layout

#### Sign-In Page (`src/app/(auth)/signin/page.tsx`)
- Added `bg-diagonal-lines` aerospace background pattern
- Added `shadow-vibrant` to login card
- Gradient brand text "GenThrust"
- Updated metadata: title, description
- Added `export const dynamic = "force-dynamic"` for build compatibility

#### Root Layout (`src/app/layout.tsx`)
- Updated metadata to "GenThrust RO Tracker"

### Technical Details

#### File Structure Added/Modified
```
src/
├── app/
│   ├── globals.css                    # Updated with color system
│   ├── layout.tsx                     # Updated metadata
│   ├── (auth)/signin/page.tsx         # Visual polish
│   └── (protected)/
│       ├── layout.tsx                 # Integrated shell
│       ├── dashboard/page.tsx         # Grid layout
│       └── shops/page.tsx             # NEW placeholder
└── components/
    └── layout/
        ├── Header.tsx                 # NEW sticky header
        └── Navigation.tsx             # NEW tab bar
```

#### Tailwind v4 Theme Configuration
```css
@theme inline {
  --color-primary-deep-blue: hsl(var(--primary-deep-blue));
  --color-primary-bright-blue: hsl(var(--primary-bright-blue));
  --color-accent-electric: hsl(var(--accent-electric));
  --color-accent-sunset: hsl(var(--accent-sunset));
  --color-success-green: hsl(var(--success-green));
  --color-warning-amber: hsl(var(--warning-amber));
  --color-danger-red: hsl(var(--danger-red));
}
```

### Dependencies
- No new dependencies (uses existing shadcn/ui, lucide-react, Tailwind CSS v4)

---

## [0.7.0] - 2025-11-30

### Phase 7: Dashboard Content - KPI Cards & Data Tables

Real business data integration with KPI statistics and paginated repair order table.

### Added

#### Server Actions (`src/app/actions/dashboard.ts`)
- `getDashboardStats()` - Fetches KPI metrics from `active` table:
  - **Total Active**: Count of all active repair orders
  - **Overdue**: Count where `nextDateToUpdate < today`
  - **Waiting Quote**: Count where status is "WAITING QUOTE"
  - **Value in Work**: Sum of `estimatedCost` for non-completed orders
- `getRepairOrders(query, page)` - Paginated repair order list:
  - 20 items per page with server-side pagination
  - Fuzzy search on RO#, shop, part, serial, description
  - Sorted by ID descending (newest first)
  - Returns `{ data, totalCount, totalPages, currentPage }`
- `getRepairOrderById(id)` - Single RO lookup
- `parseDate()` - Multi-format date parser (MM/DD/YYYY, YYYY-MM-DD, Excel serial)

#### UI Components

**StatsGrid (`src/components/dashboard/StatsGrid.tsx`)**
- 4-card responsive grid (2 cols mobile, 4 cols desktop)
- Skeleton loading state
- Currency formatting via `Intl.NumberFormat`

**StatCard (`src/components/dashboard/StatCard.tsx`)**
- Variants: default, danger, warning, success
- Icon support via lucide-react
- Uses `shadow-vibrant` and `bg-diagonal-lines` utilities

**StatusBadge (`src/components/dashboard/StatusBadge.tsx`)**
- Maps status strings to colored badges:
  - Amber: WAITING QUOTE, WAITING PARTS, PENDING
  - Blue/Cyan: APPROVED, IN WORK, SHIPPED
  - Green: RECEIVED, COMPLETE, PAID
  - Red: BER, RAI, RETURNED, CANCELLED
- Uses semantic color variables from globals.css

**RepairOrderTable (`src/components/dashboard/RepairOrderTable.tsx`)**
- Client component with debounced search
- Paginated with page numbers
- Columns: RO#, Shop, Part/Serial, Status, Next Update, Est. Cost
- Loading overlay with spinner
- Empty state handling

**Pagination (`src/components/ui/pagination.tsx`)**
- Previous/Next buttons
- Page number buttons with ellipsis for large page counts
- Disabled states at bounds

**Badge (`src/components/ui/badge.tsx`)**
- shadcn/ui Badge component
- Variants: default, secondary, destructive, outline

### Changed

#### Dashboard Page (`src/app/(protected)/dashboard/page.tsx`)
- Added StatsGrid at top of page
- Added RepairOrderTable below existing cards
- Server-side stats fetching via `getDashboardStats()`
- Maintained existing Session Info and Excel Sync cards

### Technical Details

#### File Structure Added
```
src/
├── app/
│   └── actions/
│       └── dashboard.ts              # NEW: Dashboard server actions
├── components/
│   ├── dashboard/
│   │   ├── index.ts                  # NEW: Barrel export
│   │   ├── StatCard.tsx              # NEW: KPI card component
│   │   ├── StatsGrid.tsx             # NEW: KPI grid layout
│   │   ├── StatusBadge.tsx           # NEW: Status color mapper
│   │   └── RepairOrderTable.tsx      # NEW: Paginated table
│   └── ui/
│       ├── badge.tsx                 # NEW: shadcn Badge
│       └── pagination.tsx            # NEW: Page navigation
```

#### Date Parsing Strategy
- Handles multiple formats from legacy Excel data
- MM/DD/YYYY (US format)
- YYYY-MM-DD (ISO format)
- Excel serial numbers (days since 1899-12-30)
- Returns `null` for invalid/empty dates (graceful degradation)

### Dependencies Added
- None (uses existing shadcn/ui infrastructure)

---

## [0.8.0] - 2025-11-30

### Phase 8: Repair Order Detail View

Clickable table rows with modal detail view and improved date parsing.

### Added

#### RODetailDialog (`src/components/dashboard/RODetailDialog.tsx`)
- Modal dialog for viewing repair order details
- 2-column layout: Part Information (left) + Dates & Logistics (right)
- **Part Info**: Part Number, Serial Number, Description, Requested Work
- **Dates**: Date Dropped Off, Estimated Delivery, Next Update Date
- **Logistics**: Tracking Number with external link detection
- **Notes**: `cleanNotes()` helper to strip HISTORY JSON and extract actual notes
- **Cost Summary**: Estimated Cost and Final Cost with USD formatting
- Loading state with spinner
- Error state handling
- StatusBadge in header next to RO number
- DialogDescription for accessibility compliance

#### Date Utilities (`src/lib/date-utils.ts`)
- Extracted `parseDate()` to shared module for client/server use
- Added `isOverdue(dateStr)` function for overdue detection
- Supports: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, ISO 8601, Excel serial numbers

### Fixed

#### Date Parsing (`src/app/actions/dashboard.ts`)
- **Bug**: Overdue count was 0 when dates were ISO 8601 format (`2025-11-15T05:00:00.000Z`)
- **Fix**: Changed regex from `/^(\d{4})-(\d{2})-(\d{2})$/` to `/^(\d{4})-(\d{2})-(\d{2})/` (removed end anchor)
- Added debug logging for unparseable dates
- Overdue count now correctly shows 47 instead of 0

### Changed

#### RepairOrderTable (`src/components/dashboard/RepairOrderTable.tsx`)
- Added row click handler: `onClick={() => setSelectedRoId(ro.id)}`
- Added `cursor-pointer` class to rows
- Integrated RODetailDialog component

---

## [0.9.0] - 2025-11-30

### Phase 9: Overdue Visibility - Highlighting & Filtering

Visual highlighting of overdue items and clickable KPI cards for filtering.

### Added

#### Server Actions (`src/app/actions/dashboard.ts`)
- `RepairOrderFilter` type: `"all" | "overdue"`
- Updated `getRepairOrders(query, page, filter)` with filter parameter
- **Overdue filter**: Fetches all records, filters in-memory with `isOverdue()`, then paginates
- Efficient for small datasets (<1000 rows)

#### Overdue Highlighting (`src/components/dashboard/RepairOrderTable.tsx`)
- Red `AlertCircle` icon for overdue dates
- `text-danger-red` color class for overdue text
- `font-medium` weight for emphasis
- Filter indicator in subtitle: "(Overdue)" when filtered
- `shadow-vibrant` card styling
- Loading spinner inside search input
- Table wrapped in `rounded-md border`
- `hover:bg-muted/50` row hover states
- `font-mono` for RO# column
- `Intl.DateTimeFormat` for consistent date formatting

#### Clickable Stats Cards (`src/components/dashboard/StatsGrid.tsx`)
- `activeFilter` prop to show selected state
- "Total Active" card links to `/dashboard` (reset filter)
- "Overdue" card links to `/dashboard?filter=overdue`
- Ring highlight on active card: `ring-2 ring-primary-bright-blue` or `ring-danger-red`
- `transition-opacity hover:opacity-80` for hover feedback

### Changed

#### Dashboard Page (`src/app/(protected)/dashboard/page.tsx`)
- Added `searchParams: Promise<{ filter?: string }>` prop
- Parses filter from URL query params
- Passes `activeFilter` to StatsGrid
- Passes `filter` to RepairOrderTable

---

## [1.0.0] - 2025-11-30

### Phase 10: High-Density UI Polish

Toolbar and filter enhancements for improved user workflow.

### Added

#### Toolbar Components
- **RepairOrderToolbar** (`src/components/dashboard/RepairOrderToolbar.tsx`)
  - Search input with debouncing
  - View toggle (active/all)
  - "+ New RO" placeholder button

- **RepairOrderFilters** (`src/components/dashboard/RepairOrderFilters.tsx`)
  - Filter chips: Overdue, Due This Week, High Value ($10k+), Waiting Quote
  - Status-based filtering

- **DashboardContent** (`src/components/dashboard/DashboardContent.tsx`)
  - State coordination wrapper for toolbar, filters, and table
  - ViewMode (active/all) status-based filtering

### Changed
- RepairOrderTable refactored with Tooltips and reduced padding
- Toast notifications via Sonner for status changes

---

## [1.1.0] - 2025-11-30

### Phase 11: Notification Queue Infrastructure

Complete infrastructure for automated email drafting, human-in-the-loop approval, and durable workflow execution.

### Added

#### Database Schema
- `notification_queue` table with status tracking (PENDING_APPROVAL, APPROVED, REJECTED, SENT)
- Foreign keys to `active` (repair orders) and `users` tables
- Indexes on `status` and `userId` for query performance
- VARCHAR + `.$type<T>()` pattern for enums (not MySQL ENUM)

#### Type Definitions (`src/lib/types/notification.ts`)
- `NotificationType`: 'EMAIL_DRAFT' | 'TASK_REMINDER'
- `NotificationStatus`: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT'
- `EmailDraftPayload` and `TaskReminderPayload` interfaces

#### Server Actions (`src/app/actions/notifications.ts`)
- `getPendingNotifications()` - Fetch pending approvals for current user
- `approveNotification(id)` - Approve and dispatch to Trigger.dev
- `rejectNotification(id)` - Mark as rejected
- `createNotification()` - Queue new notification
- `getAllNotifications(limit)` - Fetch all notifications (for history)

#### Pure Drizzle Functions (`src/lib/data/notifications.ts`)
- `insertNotificationCore(data)` - Used by background tasks without auth
- `getNotificationById(id)` - Fetch single notification
- `updateNotificationStatus(id, status)` - Update status

#### Microsoft Graph Productivity Helpers (`src/lib/graph/productivity.ts`)
- `createCalendarEvent()` - Create Outlook calendar events
- `createToDoTask()` - Create Microsoft To Do tasks
- `sendEmail()` - Send emails via Graph API
- `createDraftEmail()` - Create draft emails in Drafts folder

#### Trigger.dev Durable Tasks
- **`send-approved-email`** (`src/trigger/send-approved-email.ts`)
  - Processes approved notifications with retry logic
  - Sends email via Graph API, updates status to SENT

- **`handle-ro-status-change`** (`src/trigger/ro-lifecycle-flow.ts`)
  - Triggers when RO enters tracked statuses (WAITING QUOTE, APPROVED, IN WORK, etc.)
  - Creates Calendar event and To Do task immediately
  - 7-day durable wait via `wait.for({ days: 7 })`
  - Re-checks status after wake-up
  - Drafts follow-up email if still waiting

- **`check-overdue-ros`** (`src/trigger/check-overdue-ros.ts`)
  - Daily cron at 8:00 AM UTC
  - Finds ROs in WAITING QUOTE > 7 days
  - Generates email drafts for approval

#### UI Components
- **NotificationBell** (`src/components/layout/NotificationBell.tsx`)
  - Bell icon in header with pending count badge
  - Tabbed interface: "Pending" and "History"
  - Approve/Reject buttons with loading states
  - History tab with status-colored badges

- **shadcn/ui Components Added**
  - `src/components/ui/sheet.tsx` - Slide-out sidebar
  - `src/components/ui/tabs.tsx` - Tabbed interface
  - `src/components/ui/select.tsx` - Status dropdown

#### Status Change Integration (`src/app/actions/repair-orders.ts`)
- `updateRepairOrderStatus()` - Updates MySQL and triggers lifecycle flow
- Follows Write-Behind pattern: UI → Server Action → MySQL → Trigger.dev

#### RODetailDialog Status Editing
- Status dropdown with 11 status options
- Triggers lifecycle flow for tracked statuses
- Toast notifications for success/error

#### SSL Certificate Resilience (`src/lib/db.ts`)
- `DATABASE_CA_CERT` environment variable fallback
- Priority: env var → file-based cert → fallback
- Enables Trigger.dev container database access

### Fixed

#### RODetailDialog Theme Bug
- **Problem**: Dialog showed dark background with invisible text in light mode
- **Cause**: Hardcoded `!bg-white dark:!bg-slate-950` doesn't work without `.dark` class on HTML
- **Fix**: Changed to `bg-background` which uses CSS variable from `globals.css`

#### Table Refresh After Status Change
- **Problem**: Table showed old status after changing in dialog (revalidatePath didn't work)
- **Cause**: `revalidatePath` only revalidates server-rendered content, not client-side `useState`
- **Fix**: Implemented callback pattern:
  - Added `onStatusChanged?: () => void` prop to RODetailDialog
  - Added `refreshTrigger` state to RepairOrderTable
  - Table passes `onStatusChanged={() => setRefreshTrigger(x => x + 1)}` to dialog
  - Dialog calls `onStatusChanged?.()` on successful status update
  - Table's useEffect includes `refreshTrigger` in dependencies

### Changed
- `src/auth.config.ts` - Added Graph API scopes: Calendars.ReadWrite, Tasks.ReadWrite, Mail.Send, Mail.ReadWrite
- `src/lib/graph.ts` - Updated `refreshAccessToken` with new scopes
- `src/components/layout/Header.tsx` - Added NotificationBell component
- `trigger.config.ts` - Added AI SDK packages to build

### Technical Details

#### Files Added
```
src/
├── lib/
│   ├── types/notification.ts      # Type definitions
│   ├── data/notifications.ts      # Pure Drizzle functions
│   └── graph/productivity.ts      # Graph API helpers
├── trigger/
│   ├── send-approved-email.ts     # Email sender task
│   ├── ro-lifecycle-flow.ts       # 7-day durable waiter
│   └── check-overdue-ros.ts       # Daily cron safety net
├── app/actions/
│   ├── notifications.ts           # CRUD server actions
│   └── repair-orders.ts           # Status update action
└── components/
    ├── layout/NotificationBell.tsx # Approval UI
    ├── ui/sheet.tsx               # Slide-out panel
    ├── ui/tabs.tsx                # Tabbed interface
    └── ui/select.tsx              # Status dropdown
```

#### Key Patterns
- **Write-Behind Pattern**: UI → Server Action → MySQL → Trigger.dev
- **Human-in-the-Loop**: AI drafts emails, humans approve before sending
- **Durable Execution**: 7-day waits survive container restarts
- **Callback Pattern**: Client-side state refresh via prop callbacks (not revalidatePath)

---

## [1.2.0] - 2025-12-01

### Phase 12: Email Thread History & Conversation View

Extension of the notification system to display full email conversation threads per repair order.

### Added

#### Type Definitions (`src/lib/types/notification.ts`)
- `ThreadMessage` - Unified type for both DB and Graph messages with direction (inbound/outbound)
- `SentEmailResult` - Structure returned when emails are sent (messageId, conversationId, internetMessageId)
- `GraphMessage` - Graph API message structure with full email metadata
- `ThreadHistoryResult` - Return type with graceful degradation flag

#### UI Components
- **EmailThreadView** (`src/components/notifications/EmailThreadView.tsx`)
  - Client component displaying threaded email conversation
  - Collapsible thread view with message count badges
  - Shows inbound/outbound message counts
  - Refresh button and loading states
  - Graceful error handling for Graph API failures

#### Server Actions (`src/app/actions/notifications.ts`)
- `getFullThreadHistory(repairOrderId)` - Hybrid DB + Graph API fetching
  - Combines notification_queue records with Outlook conversation
  - Graceful degradation: returns DB records if Graph fails
  - Mock mode support for UI testing

#### Mock System (`src/lib/mocks/thread-messages.ts`)
- `generateMockThreadMessages()` - Generates realistic 5-message conversation
  - Shows typical RO flow: quote request → shop response → approval → confirmation → follow-up
  - Enabled via `MOCK_EMAIL_THREADS=true` (development only)
- Mock mode restricted to development: `NODE_ENV !== "production"`

#### Graph API Helpers (`src/lib/graph/productivity.ts`)
- `getConversationMessages(userId, conversationId)` - Fetches full Outlook conversation
- `updateNotificationOutlookIds()` - Stores messageId/conversationId after send

#### Trigger.dev Tasks
- **send-approved-email.ts** - Enhanced with email threading
  - Looks up previous message via `getEmailThreadForRO()`
  - Passes In-Reply-To header for conversation threading
  - Updates notification with Outlook IDs after send

### Changed
- `NotificationBell.tsx` - Integrated EmailThreadView component
- `send-approved-email.ts` - Now threads emails using previous message ID

### Database
- Added `outlookMessageId` column to `notification_queue` - Stores Graph API message ID
- Added `outlookConversationId` column to `notification_queue` - Stores Outlook conversation ID
- New migrations:
  - `drizzle/0001_solid_randall_flagg.sql`
  - `drizzle/0002_narrow_victor_mancha.sql`

### Environment Variables
```env
# Optional - Development only
MOCK_EMAIL_THREADS=true  # Enable mock email threads for UI testing
```

### Technical Details

#### File Structure Added
```
src/
├── lib/
│   ├── types/notification.ts     # Extended with thread types
│   ├── mocks/
│   │   └── thread-messages.ts    # Mock data generator
│   └── data/notifications.ts     # Extended with thread helpers
├── components/
│   └── notifications/
│       └── EmailThreadView.tsx   # Thread visualization
└── app/actions/
    └── notifications.ts          # Extended with getFullThreadHistory
```

#### Key Patterns
- **Hybrid Data Source**: Combines DB (internal state) with Graph API (external thread)
- **Graceful Degradation**: Graph API failures don't break UI
- **Email Threading**: RFC 2822 `In-Reply-To` headers for Outlook conversation threading
- **Mock-Driven Development**: Realistic mock data without Graph API dependency

---

## [Unreleased]

### Phase 5 Addendum: Durable AI Agent Integration

Integration of Vercel AI SDK with Trigger.dev for durable AI-powered research capabilities.

### Added

#### Dependencies
- `ai` (v5.0.104) - Vercel AI SDK for LLM integration
- `@ai-sdk/anthropic` (v2.0.50) - Anthropic provider for Claude models
- `zod` - Schema validation for tool parameters

#### Trigger.dev Tasks

**AI Tools (`src/trigger/ai-tools.ts`)**
- `searchInventoryTool` - Searches inventory by part number or description
- `getRepairOrderTool` - Looks up repair order details by RO number or ID
- Both tasks run in isolated containers with automatic retry (3 attempts)

**AI Agent (`src/trigger/ai-agent.ts`)**
- Uses Vercel AI SDK v5 with `generateText()` and `inputSchema` tool definitions
- Claude claude-sonnet-4-20250514 model via Anthropic provider
- Durable tool execution via `tasks.triggerAndWait()` (sub-task isolation)
- Real-time progress metadata updates (thinking, searching_inventory, fetching_repair_order)
- Supports up to 5 sequential tool calls via `stopWhen: stepCountIs(5)`

#### Server Actions (`src/app/actions/agent.ts`)
- `askAgent(prompt)` - Triggers research-agent task
- Returns `runId` and `publicAccessToken` for real-time UI tracking
- Follows `Result<T>` pattern per CLAUDE.md

#### Hooks (`src/hooks/use-agent-run.ts`)
- `useAgentRun(runId, accessToken)` - Returns status, progress, output, error
- Status types: idle, thinking, searching_inventory, fetching_repair_order, completed, failed

#### UI Components
- `src/components/ui/dialog.tsx` - shadcn/ui Dialog component (Radix UI)
- `src/components/agent/Assistant.tsx` - Floating AI chat assistant:
  - Chat bubble button fixed to bottom-right corner
  - Expandable dialog with message history
  - Real-time status updates during agent execution
  - Session-only chat (no database persistence)
  - Auto-scroll to latest messages

#### Modified Files
- `src/app/(protected)/layout.tsx` - Added Assistant component to protected routes
- `package.json` - Added AI SDK dependencies

### Technical Details

#### File Structure Added
```
src/
├── trigger/
│   ├── ai-tools.ts           # Durable sub-tasks for AI tools
│   └── ai-agent.ts           # Main research agent task
├── app/actions/
│   └── agent.ts              # Server action for AI assistant
├── hooks/
│   └── use-agent-run.ts      # React hook for agent status
└── components/
    ├── ui/
    │   └── dialog.tsx        # shadcn Dialog
    └── agent/
        └── Assistant.tsx     # Floating chat assistant
```

#### Environment Variables Required
```env
ANTHROPIC_API_KEY=sk-ant-...
```

#### Key Patterns Implemented
- **Sub-task Isolation**: Each AI tool runs as a separate Trigger.dev task for maximum durability
- **Durable Tool Execution**: Uses `tasks.triggerAndWait()` - if container restarts, execution resumes
- **AI SDK v5 Compatibility**: Uses `inputSchema` instead of `parameters`, `stopWhen` instead of `maxSteps`
- **Real-time Progress**: Metadata updates shown via `useAgentRun` hook
- **Non-blocking UI**: AI runs in background container, UI polls for status

---

## Notes

### Architecture Decisions
Per `CLAUDE.md` guidelines:
- **Write-Behind Pattern**: MySQL is source of truth; Excel sync happens via background workers
- **Global Singleton**: Prevents connection pool exhaustion in serverless
- **Edge/Node Split**: Middleware uses edge-compatible config; API routes use full config with DB adapter
- **Durable Execution**: All Excel syncing runs in Trigger.dev containers (no timeouts)
- **Lazy Loading**: Environment variables read at runtime for worker compatibility

### Architecture Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ UI Layer (SyncStatus Component)                                 │
│ - Dashboard with progress bar                                   │
│ - useTriggerRun hook polls for updates                         │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server Action (triggerExcelSync)                                │
│ - Validates auth, dispatches to Trigger.dev                    │
│ - Returns { runId, publicAccessToken }                         │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Durable Task (sync-repair-orders in Trigger.dev container)     │
│ - 4-phase execution with progress tracking                     │
│ - JSON batching (20 items per batch)                           │
│ - Persistent Excel sessions                                    │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
          ┌───────────────────────────┴───────────────────────┐
          ▼                                                    ▼
    ┌──────────────┐                                ┌──────────────┐
    │ Aiven MySQL  │                                │ SharePoint   │
    │ (Source)     │                                │ Excel (Sync) │
    └──────────────┘                                └──────────────┘
```
