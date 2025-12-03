# Sheet Filter Implementation Tracking

## Objective
Add a dropdown filter to the repair orders dashboard to switch between viewing data from 4 database tables: Active, Net, Paid, and Returns.

## Branch: `sheet_filter`

## Current Status: COMPLETE - All Steps Implemented

---

## Implementation Steps & Status

### Step 1: Server Action (COMPLETE)
**File:** `/src/app/actions/dashboard.ts`
- [x] Add `SheetFilter` type export
- [x] Add `SHEET_TABLES` lookup map
- [x] Add `normalizeRepairOrder()` helper function
- [x] Add `getRepairOrdersBySheet()` server action
- [x] Active sheet excludes ARCHIVED_STATUSES
- [x] Net/Paid/Returns return all records
- [x] Search works on all sheets
- [x] Pagination works on all sheets
- [x] Type normalization for finalCost, dateMade

### Step 2: Dropdown Component (COMPLETE)
**File:** `/src/components/dashboard/SheetFilterDropdown.tsx`
- [x] Created Select component with 4 options (Active, Net, Paid, Returns)
- [x] Implemented URL-based state management
- [x] Default is "active"

### Step 3: Dashboard Page Integration (COMPLETE)
**File:** `/src/app/(protected)/dashboard/page.tsx`
- [x] Parse `sheet` from searchParams
- [x] Pass `sheet` prop to RepairOrderTable
- [x] Invalid param defaults to "active"

### Step 4: RepairOrderTable Update (COMPLETE)
**File:** `/src/components/dashboard/RepairOrderTable.tsx`
- [x] Add `sheet` prop
- [x] Integrate SheetFilterDropdown
- [x] Update data fetching to use `getRepairOrdersBySheet()`
- [x] Page resets to 1 on sheet change

### Step 5: SCRAP Status Routing (COMPLETE)
**Files:**
- `/src/components/ro-detail/RODetailHeader.tsx`
- `/src/components/dashboard/RODetailDialog.tsx`
- `/src/components/dashboard/StatusBadge.tsx`
- [x] Add SCRAP to STATUS_OPTIONS (both locations)
- [x] Add SCRAP to StatusBadge with red styling
- [x] SCRAP auto-routes to Returns (no prompt)
- [x] BER/RAI/CANCELLED now prompt "Did we receive the unit?"

---

## Test Cases (TDD)

### TC-1: Active Sheet Query
**Purpose:** Verify active sheet excludes archived statuses
**Input:** `getRepairOrdersBySheet("active", "", 1, "all")`
**Expected:**
- Returns records from `active` table
- Excludes COMPLETE, NET, PAID, RETURNS, BER, RAI, CANCELLED statuses
- Pagination info included

### TC-2: Net Sheet Query
**Purpose:** Verify net sheet returns all net table records
**Input:** `getRepairOrdersBySheet("net", "", 1, "all")`
**Expected:**
- Returns records from `net` table
- No status filtering applied
- All records included

### TC-3: Paid Sheet Query
**Purpose:** Verify paid sheet returns all paid table records
**Input:** `getRepairOrdersBySheet("paid", "", 1, "all")`
**Expected:**
- Returns records from `paid` table
- finalCost normalized to string (was varchar in DB)

### TC-4: Returns Sheet Query
**Purpose:** Verify returns sheet returns all returns table records
**Input:** `getRepairOrdersBySheet("returns", "", 1, "all")`
**Expected:**
- Returns records from `returns` table
- Contains BER, RAI, CANCELLED, SCRAP status records

### TC-5: Search Across Sheets
**Purpose:** Verify search works on all sheets
**Input:** `getRepairOrdersBySheet("net", "searchterm", 1, "all")`
**Expected:**
- Searches RO#, shopName, part, serial, description
- Returns matching records only

### TC-6: Pagination Across Sheets
**Purpose:** Verify pagination works correctly
**Input:** `getRepairOrdersBySheet("paid", "", 2, "all")`
**Expected:**
- Returns page 2 of results (20 items per page)
- totalPages and totalCount accurate

### TC-7: Overdue Filter on Non-Active Sheets
**Purpose:** Verify overdue filter works on archive sheets
**Input:** `getRepairOrdersBySheet("net", "", 1, "overdue")`
**Expected:**
- Only returns records where nextDateToUpdate < today
- In-memory filtering applied correctly

### TC-8: Type Normalization - finalCost
**Purpose:** Verify finalCost is normalized to string
**Tables:**
- `active.finalCost` = double → string
- `paid.finalCost` = varchar → string (no change needed)
**Expected:** All sheets return finalCost as string | null

### TC-9: Type Normalization - dateMade
**Purpose:** Verify dateMade is normalized to string
**Tables:**
- `active.dateMade` = varchar → string (no change)
- `net.dateMade` = datetime → ISO string
**Expected:** All sheets return dateMade as string | null

### TC-10: URL State Management
**Purpose:** Verify URL updates correctly
**Steps:**
1. Load /dashboard → sheet=active (default)
2. Select "Net" → URL becomes /dashboard?sheet=net
3. Refresh page → sheet persists as "net"
4. Select "Active" → ?sheet param removed (default)

### TC-11: SCRAP Auto-Routing
**Purpose:** Verify SCRAP status routes to Returns without prompt
**Steps:**
1. Open RO detail panel
2. Change status to "SCRAP"
3. Verify NO confirmation dialog appears
4. Verify destinationSheet = "Returns"

---

## Schema Reference

| Column | active | net | paid | returns |
|--------|--------|-----|------|---------|
| id | bigint | bigint | bigint | bigint |
| ro | double | double | double | double |
| dateMade | varchar | datetime | datetime | varchar |
| finalCost | double | double | varchar | varchar |
| ... | same | same | same | same |

---

## Notes
- All 4 tables have 21 columns with nearly identical structure
- Type normalization required for cross-table consistency
- Stats cards remain unchanged (always Active metrics)
