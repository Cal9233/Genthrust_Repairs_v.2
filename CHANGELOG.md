# Changelog

All notable changes to GenThrust RO Tracker v2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added - Phase 4: Microsoft Graph Logic (Durable Execution)

#### Dependencies
- `@microsoft/microsoft-graph-client` - Official Microsoft Graph SDK
- `isomorphic-fetch` - Fetch polyfill for Node.js (Trigger.dev containers)
- `@trigger.dev/sdk` - Trigger.dev v3 SDK for durable execution
- `drizzle-orm` - Type-safe ORM for MySQL
- `mysql2` - MySQL driver
- `zod` - Schema validation

#### New Files

**Type Definitions**
- `src/lib/types/graph.ts` - TypeScript types for Graph API operations (TokenResponse, ExcelSession, BatchRequest/Response, RepairOrderExcelRow, custom errors)

**Graph Client**
- `src/lib/graph.ts` - Core Graph client helper with:
  - `getGraphClient(userId)` - Retrieves refresh_token from accounts table, exchanges for access_token
  - `createExcelSession(client, workbookId)` - Creates persistent Excel session
  - `closeExcelSession(client, workbookId, sessionId)` - Closes session to save changes
  - `chunkArray(array, size)` - Utility for batching (20 item limit)

**Excel Utilities**
- `src/lib/graph/excel-mapping.ts` - Column mapping utilities:
  - Maps 21 `active` table columns to Excel columns A-U
  - `dbRowToExcelRow(row)` - Converts DB row to Excel array
  - `getRowRangeAddress(worksheet, rowNumber)` - Generates Excel range addresses

- `src/lib/graph/excel-search.ts` - Row lookup functions:
  - `findRowsByRO(client, workbookId, worksheet, sessionId, roNumbers)` - Searches for existing rows by RO number
  - `getNextAvailableRow(...)` - Gets next empty row for new entries

- `src/lib/graph/batch.ts` - Batch request builder:
  - `executeBatch(client, requests, sessionId)` - Executes Graph API batch requests
  - `buildUpdateRowRequest(...)` - Builds PATCH request for row updates
  - `buildBatchUpdateRequests(...)` - Builds multiple update requests
  - `analyzeBatchResponse(response)` - Analyzes batch results for errors

**Trigger.dev Task**
- `src/trigger/excel-sync.ts` - Full durable sync implementation:
  - Payload: `{ userId: string, repairOrderIds: number[] }`
  - Phase 1: Authenticate and create Excel session
  - Phase 2: Fetch repair orders from MySQL, find existing Excel rows
  - Phase 3: Process in batches of 20, update existing or add new rows
  - Phase 4: Close session, return summary
  - Real-time progress tracking via `metadata.set()`
  - 429 rate limit handling (throws for Trigger.dev retry)
  - Session cleanup in finally block

**Server Actions**
- `src/app/actions/sync.ts` - Server action to trigger Excel sync:
  - `triggerExcelSync(userId, repairOrderIds)` - Dispatches background sync task
  - Returns `runId` and `publicAccessToken` for real-time UI tracking

**Configuration**
- `trigger.config.ts` - Trigger.dev v3 configuration

**Infrastructure**
- `src/lib/db.ts` - Database singleton pattern (Drizzle ORM + mysql2)
- `src/lib/schema.ts` - Full schema (active table + Auth.js tables)

#### Environment Variables Required
```bash
EXCEL_WORKBOOK_ID=<sharepoint-workbook-item-id>
EXCEL_WORKSHEET_NAME=Active
```

#### Key Patterns Implemented
- **Persistent Sessions**: Uses `workbook-session-id` header with `persistChanges: true`
- **JSON Batching**: Chunks operations into groups of 20 (Graph API limit)
- **Search by RO**: Finds existing rows for updates, appends new entries
- **Token Refresh**: Automatically refreshes Microsoft tokens from stored refresh_token
- **Error Handling**: 429 rate limits trigger Trigger.dev automatic retry
- **SharePoint Support**: Updated to use SharePoint site paths instead of OneDrive

### Added - Phase 4.5: Sync Button (UI Integration)

#### Dependencies
- `@trigger.dev/react-hooks` - Realtime progress hooks
- `@radix-ui/react-slot` - Button composition
- `@radix-ui/react-progress` - Progress bar primitive
- `class-variance-authority` - Variant styling
- `clsx` + `tailwind-merge` - Class merging utilities
- `lucide-react` - Icons

#### UI Components
- `src/components/ui/button.tsx` - shadcn/ui Button component
- `src/components/ui/progress.tsx` - shadcn/ui Progress bar component
- `src/components/sync/SyncStatus.tsx` - Excel sync status card with:
  - "Sync to Excel" button (disabled during sync)
  - Real-time progress bar (0-100%)
  - Status text (Connecting, Syncing, Completed, etc.)
  - Success/error feedback with item counts
  - "Sync Again" button after completion

#### Hooks
- `src/hooks/use-trigger-run.ts` - Wrapper for Trigger.dev realtime hooks:
  - `useTriggerRun(runId, accessToken)` - Returns status, progress, output, error
  - `useTriggerRunWithProgress(...)` - Extended version with stream support

#### Pages
- `src/app/(protected)/layout.tsx` - Protected route layout
- `src/app/(protected)/dashboard/page.tsx` - Dashboard with SyncStatus component

#### Styling
- `src/app/globals.css` - Updated with shadcn/ui CSS variables (light/dark themes)
- `components.json` - shadcn/ui configuration

#### Key Patterns Implemented
- **Optimistic UI**: Button disabled during sync to prevent double-clicks
- **Real-time Progress**: Uses Trigger.dev's `useRealtimeRun` hook
- **Status Feedback**: Visual indicators for all sync states

---

## [0.1.0] - 2024-11-29

### Added - Phase 1: Foundation
- Initial Next.js 15 setup (App Router)
- Drizzle ORM with Global Singleton pattern
- Auth.js v5 with Microsoft Entra ID
- Database schema introspection from legacy system
- Trigger.dev v3 skeleton configuration
