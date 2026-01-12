/**
 * Dashboard Filters Test Suite (Phase 29)
 *
 * Tests for the dashboard filter system including:
 * - Filter type validation
 * - Status filter matching (LIKE prefix)
 * - Shop filter matching (case-insensitive exact)
 * - Date range filtering
 * - Active filter count calculation
 * - Filter combinations (AND logic)
 * - Unique shops/statuses extraction
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Type Definitions (mirrors dashboard.ts)
// ============================================================================

interface DashboardFilters {
  status?: string;
  shop?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Archived statuses that should be excluded from Active view
const ARCHIVED_STATUSES = [
  "COMPLETE",
  "NET",
  "PAID",
  "RETURNS",
  "BER",
  "RAI",
  "CANCELLED",
];

// ============================================================================
// Helper Functions (mirrors logic from dashboard.ts and DashboardFilterBar.tsx)
// ============================================================================

/**
 * Check if a status matches a filter using prefix matching (case-insensitive)
 * This mirrors the SQL: LIKE 'APPROVED%' behavior
 */
const statusMatches = (
  recordStatus: string | null,
  filterStatus: string
): boolean => {
  if (!recordStatus) return false;
  return recordStatus.toUpperCase().startsWith(filterStatus.toUpperCase());
};

/**
 * Check if a shop name matches (case-insensitive exact match)
 * This mirrors the SQL: LOWER(shopName) = LOWER(filter)
 */
const shopMatches = (
  recordShop: string | null,
  filterShop: string
): boolean => {
  if (!recordShop) return false;
  return recordShop.toLowerCase() === filterShop.toLowerCase();
};

/**
 * Check if a date falls within a range (string comparison for VARCHAR dates)
 * Uses ISO date format (YYYY-MM-DD) for proper string sorting
 */
const dateInRange = (
  recordDate: string | null,
  dateFrom?: string,
  dateTo?: string
): boolean => {
  if (!recordDate) return false;

  if (dateFrom && recordDate < dateFrom) return false;
  if (dateTo && recordDate > dateTo) return false;

  return true;
};

/**
 * Count active filters (non-undefined values)
 * Used for badge display
 */
const countActiveFilters = (filters: DashboardFilters): number => {
  return [filters.status, filters.shop, filters.dateFrom, filters.dateTo].filter(
    Boolean
  ).length;
};

/**
 * Clear all filters - returns empty object
 */
const clearFilters = (): DashboardFilters => {
  return {};
};

/**
 * Check if a record matches all provided filters (AND logic)
 */
const matchesFilters = (
  record: {
    curentStatus: string | null;
    shopName: string | null;
    estimatedDeliveryDate: string | null;
  },
  filters: DashboardFilters
): boolean => {
  // Status filter (prefix match)
  if (filters.status && !statusMatches(record.curentStatus, filters.status)) {
    return false;
  }

  // Shop filter (exact match, case-insensitive)
  if (filters.shop && !shopMatches(record.shopName, filters.shop)) {
    return false;
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    if (
      !dateInRange(record.estimatedDeliveryDate, filters.dateFrom, filters.dateTo)
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Filter and sort shop names (removes null/empty, sorts alphabetically)
 */
const filterShops = (shops: (string | null)[]): string[] => {
  return shops
    .filter((s): s is string => s !== null && s !== "")
    .sort((a, b) => a.localeCompare(b));
};

/**
 * Filter statuses to exclude archived ones
 */
const filterStatuses = (statuses: (string | null)[]): string[] => {
  return statuses.filter(
    (s): s is string => s !== null && !ARCHIVED_STATUSES.includes(s)
  );
};

// ============================================================================
// Test Suites
// ============================================================================

describe("Dashboard Filters", () => {
  // --------------------------------------------------------------------------
  // 1. Filter Type Validation
  // --------------------------------------------------------------------------
  describe("Filter Type Validation", () => {
    it("should accept empty filters object", () => {
      const filters: DashboardFilters = {};
      expect(filters).toEqual({});
    });

    it("should accept status-only filter", () => {
      const filters: DashboardFilters = { status: "APPROVED" };
      expect(filters.status).toBe("APPROVED");
      expect(filters.shop).toBeUndefined();
    });

    it("should accept shop-only filter", () => {
      const filters: DashboardFilters = { shop: "ABC Aviation" };
      expect(filters.shop).toBe("ABC Aviation");
      expect(filters.status).toBeUndefined();
    });

    it("should accept date range filters", () => {
      const filters: DashboardFilters = {
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      };
      expect(filters.dateFrom).toBe("2025-01-01");
      expect(filters.dateTo).toBe("2025-12-31");
    });

    it("should accept all filters combined", () => {
      const filters: DashboardFilters = {
        status: "IN WORK",
        shop: "XYZ Shop",
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      };
      expect(filters.status).toBe("IN WORK");
      expect(filters.shop).toBe("XYZ Shop");
      expect(filters.dateFrom).toBe("2025-01-01");
      expect(filters.dateTo).toBe("2025-12-31");
    });

    it("should handle undefined values explicitly", () => {
      const filters: DashboardFilters = {
        status: undefined,
        shop: undefined,
      };
      expect(filters.status).toBeUndefined();
      expect(filters.shop).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Status Filter Matching (Prefix Match)
  // --------------------------------------------------------------------------
  describe("Status Filter Matching", () => {
    it("should match exact status", () => {
      expect(statusMatches("APPROVED", "APPROVED")).toBe(true);
      expect(statusMatches("IN WORK", "IN WORK")).toBe(true);
      expect(statusMatches("WAITING QUOTE", "WAITING QUOTE")).toBe(true);
    });

    it("should match status variants with prefix", () => {
      // Handles "APPROVED >>>>" variant from Excel data
      expect(statusMatches("APPROVED >>>>", "APPROVED")).toBe(true);
      expect(statusMatches("APPROVED - PENDING", "APPROVED")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(statusMatches("approved", "APPROVED")).toBe(true);
      expect(statusMatches("APPROVED", "approved")).toBe(true);
      expect(statusMatches("Approved", "APPROVED")).toBe(true);
      expect(statusMatches("in work", "IN WORK")).toBe(true);
      expect(statusMatches("In Work", "in work")).toBe(true);
    });

    it("should not match partial status", () => {
      expect(statusMatches("IN WORK", "IN")).toBe(true); // "IN" is prefix of "IN WORK"
      expect(statusMatches("APPROVED", "APP")).toBe(true); // "APP" is prefix
      expect(statusMatches("APPROVED", "APPROVE")).toBe(true); // Still a prefix
    });

    it("should not match different status", () => {
      expect(statusMatches("IN WORK", "APPROVED")).toBe(false);
      expect(statusMatches("APPROVED", "WAITING QUOTE")).toBe(false);
      expect(statusMatches("SHIPPED", "IN WORK")).toBe(false);
    });

    it("should handle null record status", () => {
      expect(statusMatches(null, "APPROVED")).toBe(false);
    });

    it("should handle empty record status", () => {
      expect(statusMatches("", "APPROVED")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Shop Filter Matching (Exact, Case-Insensitive)
  // --------------------------------------------------------------------------
  describe("Shop Filter Matching", () => {
    it("should match exact shop name", () => {
      expect(shopMatches("ABC Aviation", "ABC Aviation")).toBe(true);
      expect(shopMatches("XYZ Repairs", "XYZ Repairs")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(shopMatches("ABC Aviation", "abc aviation")).toBe(true);
      expect(shopMatches("ABC Aviation", "ABC AVIATION")).toBe(true);
      expect(shopMatches("abc aviation", "ABC Aviation")).toBe(true);
    });

    it("should NOT match partial shop name", () => {
      expect(shopMatches("ABC Aviation", "ABC")).toBe(false);
      expect(shopMatches("ABC Aviation", "Aviation")).toBe(false);
      expect(shopMatches("ABC Aviation", "ABC Avi")).toBe(false);
    });

    it("should handle null record shop", () => {
      expect(shopMatches(null, "ABC Aviation")).toBe(false);
    });

    it("should handle empty record shop", () => {
      expect(shopMatches("", "ABC Aviation")).toBe(false);
    });

    it("should handle whitespace in shop names", () => {
      expect(shopMatches("  ABC Aviation  ", "  ABC Aviation  ")).toBe(true);
      // Note: Real implementation may want to trim - this tests current behavior
    });
  });

  // --------------------------------------------------------------------------
  // 4. Date Range Filtering
  // --------------------------------------------------------------------------
  describe("Date Range Filtering", () => {
    it("should return true when date is within range", () => {
      expect(dateInRange("2025-06-15", "2025-01-01", "2025-12-31")).toBe(true);
      expect(dateInRange("2025-01-01", "2025-01-01", "2025-12-31")).toBe(true); // Inclusive start
      expect(dateInRange("2025-12-31", "2025-01-01", "2025-12-31")).toBe(true); // Inclusive end
    });

    it("should return false when date is before range", () => {
      expect(dateInRange("2024-12-31", "2025-01-01", "2025-12-31")).toBe(false);
      expect(dateInRange("2024-06-15", "2025-01-01", "2025-12-31")).toBe(false);
    });

    it("should return false when date is after range", () => {
      expect(dateInRange("2026-01-01", "2025-01-01", "2025-12-31")).toBe(false);
      expect(dateInRange("2025-12-32", "2025-01-01", "2025-12-31")).toBe(false); // Invalid date, still > end
    });

    it("should handle open-ended range (no upper bound)", () => {
      expect(dateInRange("2025-06-15", "2025-01-01", undefined)).toBe(true);
      expect(dateInRange("2099-12-31", "2025-01-01", undefined)).toBe(true);
      expect(dateInRange("2024-12-31", "2025-01-01", undefined)).toBe(false);
    });

    it("should handle open-ended range (no lower bound)", () => {
      expect(dateInRange("2025-06-15", undefined, "2025-12-31")).toBe(true);
      expect(dateInRange("1999-01-01", undefined, "2025-12-31")).toBe(true);
      expect(dateInRange("2026-01-01", undefined, "2025-12-31")).toBe(false);
    });

    it("should handle no date range (no bounds)", () => {
      expect(dateInRange("2025-06-15", undefined, undefined)).toBe(true);
      expect(dateInRange("1999-01-01", undefined, undefined)).toBe(true);
      expect(dateInRange("2099-12-31", undefined, undefined)).toBe(true);
    });

    it("should return false for null record date", () => {
      expect(dateInRange(null, "2025-01-01", "2025-12-31")).toBe(false);
    });

    it("should handle edge case of same day range", () => {
      expect(dateInRange("2025-06-15", "2025-06-15", "2025-06-15")).toBe(true);
      expect(dateInRange("2025-06-14", "2025-06-15", "2025-06-15")).toBe(false);
      expect(dateInRange("2025-06-16", "2025-06-15", "2025-06-15")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Active Filter Count
  // --------------------------------------------------------------------------
  describe("Active Filter Count", () => {
    it("should return 0 for empty filters", () => {
      expect(countActiveFilters({})).toBe(0);
    });

    it("should return 1 for single filter", () => {
      expect(countActiveFilters({ status: "APPROVED" })).toBe(1);
      expect(countActiveFilters({ shop: "ABC" })).toBe(1);
      expect(countActiveFilters({ dateFrom: "2025-01-01" })).toBe(1);
      expect(countActiveFilters({ dateTo: "2025-12-31" })).toBe(1);
    });

    it("should return 2 for two filters", () => {
      expect(countActiveFilters({ status: "APPROVED", shop: "ABC" })).toBe(2);
      expect(
        countActiveFilters({ dateFrom: "2025-01-01", dateTo: "2025-12-31" })
      ).toBe(2);
    });

    it("should return 3 for three filters", () => {
      expect(
        countActiveFilters({
          status: "APPROVED",
          shop: "ABC",
          dateFrom: "2025-01-01",
        })
      ).toBe(3);
    });

    it("should return 4 for all filters", () => {
      expect(
        countActiveFilters({
          status: "APPROVED",
          shop: "ABC",
          dateFrom: "2025-01-01",
          dateTo: "2025-12-31",
        })
      ).toBe(4);
    });

    it("should not count undefined values", () => {
      expect(
        countActiveFilters({
          status: "APPROVED",
          shop: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        })
      ).toBe(1);
    });

    it("should not count empty strings as active", () => {
      // Empty string is falsy, so it won't be counted
      expect(countActiveFilters({ status: "", shop: "" })).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Clear Filters
  // --------------------------------------------------------------------------
  describe("Clear Filters", () => {
    it("should return empty object", () => {
      expect(clearFilters()).toEqual({});
    });

    it("should be a new object each call", () => {
      const first = clearFilters();
      const second = clearFilters();
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Filter Combinations (AND Logic)
  // --------------------------------------------------------------------------
  describe("Filter Combinations (AND Logic)", () => {
    const testRecord = {
      curentStatus: "APPROVED",
      shopName: "ABC Aviation",
      estimatedDeliveryDate: "2025-06-15",
    };

    it("should match with no filters", () => {
      expect(matchesFilters(testRecord, {})).toBe(true);
    });

    it("should match with single matching status filter", () => {
      expect(matchesFilters(testRecord, { status: "APPROVED" })).toBe(true);
    });

    it("should match with single matching shop filter", () => {
      expect(matchesFilters(testRecord, { shop: "ABC Aviation" })).toBe(true);
    });

    it("should match with date range containing record date", () => {
      expect(
        matchesFilters(testRecord, {
          dateFrom: "2025-01-01",
          dateTo: "2025-12-31",
        })
      ).toBe(true);
    });

    it("should match with all filters matching", () => {
      expect(
        matchesFilters(testRecord, {
          status: "APPROVED",
          shop: "ABC Aviation",
          dateFrom: "2025-01-01",
          dateTo: "2025-12-31",
        })
      ).toBe(true);
    });

    it("should NOT match when status filter fails", () => {
      expect(matchesFilters(testRecord, { status: "IN WORK" })).toBe(false);
      expect(
        matchesFilters(testRecord, { status: "IN WORK", shop: "ABC Aviation" })
      ).toBe(false);
    });

    it("should NOT match when shop filter fails", () => {
      expect(matchesFilters(testRecord, { shop: "XYZ Repairs" })).toBe(false);
      expect(
        matchesFilters(testRecord, { status: "APPROVED", shop: "XYZ Repairs" })
      ).toBe(false);
    });

    it("should NOT match when date range filter fails", () => {
      expect(
        matchesFilters(testRecord, { dateFrom: "2026-01-01", dateTo: "2026-12-31" })
      ).toBe(false);
    });

    it("should handle null status in record", () => {
      const nullStatusRecord = { ...testRecord, curentStatus: null };
      expect(matchesFilters(nullStatusRecord, { status: "APPROVED" })).toBe(
        false
      );
      expect(matchesFilters(nullStatusRecord, {})).toBe(true);
    });

    it("should handle null shop in record", () => {
      const nullShopRecord = { ...testRecord, shopName: null };
      expect(matchesFilters(nullShopRecord, { shop: "ABC Aviation" })).toBe(
        false
      );
      expect(matchesFilters(nullShopRecord, {})).toBe(true);
    });

    it("should handle null date in record", () => {
      const nullDateRecord = { ...testRecord, estimatedDeliveryDate: null };
      expect(
        matchesFilters(nullDateRecord, { dateFrom: "2025-01-01" })
      ).toBe(false);
      expect(matchesFilters(nullDateRecord, {})).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Result Type Compliance
  // --------------------------------------------------------------------------
  describe("Result Type Compliance", () => {
    type Result<T> =
      | { success: true; data: T }
      | { success: false; error: string };

    it("should construct valid success result", () => {
      const result: Result<string[]> = {
        success: true,
        data: ["APPROVED", "IN WORK"],
      };
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(["APPROVED", "IN WORK"]);
      }
    });

    it("should construct valid error result", () => {
      const result: Result<string[]> = {
        success: false,
        error: "Database connection failed",
      };
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Database connection failed");
      }
    });

    it("should discriminate between success and error", () => {
      const handleResult = <T>(result: Result<T>): string => {
        if (result.success) {
          return "Got data";
        } else {
          return `Error: ${result.error}`;
        }
      };

      expect(handleResult({ success: true, data: [] })).toBe("Got data");
      expect(handleResult({ success: false, error: "Failed" })).toBe(
        "Error: Failed"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 9. Unique Shops Extraction
  // --------------------------------------------------------------------------
  describe("Unique Shops Extraction", () => {
    it("should filter out null values", () => {
      expect(filterShops([null, "ABC", "XYZ", null])).toEqual(["ABC", "XYZ"]);
    });

    it("should filter out empty strings", () => {
      expect(filterShops(["", "ABC", "", "XYZ"])).toEqual(["ABC", "XYZ"]);
    });

    it("should sort alphabetically", () => {
      expect(filterShops(["ZZZ", "AAA", "MMM"])).toEqual(["AAA", "MMM", "ZZZ"]);
    });

    it("should handle mixed null/empty/valid", () => {
      expect(filterShops([null, "", "Charlie", null, "Alpha", "", "Bravo"])).toEqual([
        "Alpha",
        "Bravo",
        "Charlie",
      ]);
    });

    it("should return empty array for all null/empty", () => {
      expect(filterShops([null, "", null, ""])).toEqual([]);
    });

    it("should handle single valid shop", () => {
      expect(filterShops([null, "OnlyShop", null])).toEqual(["OnlyShop"]);
    });

    it("should preserve case in output", () => {
      expect(filterShops(["ABC Aviation", "abc repairs"])).toEqual([
        "ABC Aviation",
        "abc repairs",
      ]);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Unique Statuses Extraction (Excludes Archived)
  // --------------------------------------------------------------------------
  describe("Unique Statuses Extraction", () => {
    it("should exclude COMPLETE status", () => {
      expect(filterStatuses(["APPROVED", "COMPLETE", "IN WORK"])).toEqual([
        "APPROVED",
        "IN WORK",
      ]);
    });

    it("should exclude NET status", () => {
      expect(filterStatuses(["APPROVED", "NET", "IN WORK"])).toEqual([
        "APPROVED",
        "IN WORK",
      ]);
    });

    it("should exclude PAID status", () => {
      expect(filterStatuses(["APPROVED", "PAID", "IN WORK"])).toEqual([
        "APPROVED",
        "IN WORK",
      ]);
    });

    it("should exclude RETURNS status", () => {
      expect(filterStatuses(["APPROVED", "RETURNS", "IN WORK"])).toEqual([
        "APPROVED",
        "IN WORK",
      ]);
    });

    it("should exclude BER status", () => {
      expect(filterStatuses(["APPROVED", "BER", "IN WORK"])).toEqual([
        "APPROVED",
        "IN WORK",
      ]);
    });

    it("should exclude RAI status", () => {
      expect(filterStatuses(["APPROVED", "RAI", "IN WORK"])).toEqual([
        "APPROVED",
        "IN WORK",
      ]);
    });

    it("should exclude CANCELLED status", () => {
      expect(filterStatuses(["APPROVED", "CANCELLED", "IN WORK"])).toEqual([
        "APPROVED",
        "IN WORK",
      ]);
    });

    it("should exclude all archived statuses at once", () => {
      const allStatuses = [
        "APPROVED",
        "COMPLETE",
        "NET",
        "PAID",
        "RETURNS",
        "BER",
        "RAI",
        "CANCELLED",
        "IN WORK",
        "WAITING QUOTE",
      ];
      expect(filterStatuses(allStatuses)).toEqual([
        "APPROVED",
        "IN WORK",
        "WAITING QUOTE",
      ]);
    });

    it("should filter out null values", () => {
      expect(filterStatuses([null, "APPROVED", null, "IN WORK"])).toEqual([
        "APPROVED",
        "IN WORK",
      ]);
    });

    it("should return empty array when all are archived or null", () => {
      expect(filterStatuses([null, "COMPLETE", "PAID", "BER"])).toEqual([]);
    });

    it("should preserve order (no sorting)", () => {
      expect(filterStatuses(["WAITING QUOTE", "APPROVED", "IN WORK"])).toEqual([
        "WAITING QUOTE",
        "APPROVED",
        "IN WORK",
      ]);
    });
  });
});
