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
