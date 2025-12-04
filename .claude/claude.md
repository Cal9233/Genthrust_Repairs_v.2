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
**[Current Status]:** Phase 23 Complete - "Virtual Warehouse" Inventory Page. Transformed blank search into command center with Zero State dashboard, Omnibar search, high-density manifest table, and condition data forensics.

---

## Changelog

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