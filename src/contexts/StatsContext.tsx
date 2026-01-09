"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard";
import { useRefresh } from "./RefreshContext";

interface StatsContextType {
  /** Current dashboard statistics */
  stats: DashboardStats;
  /** Whether stats are currently being fetched */
  loading: boolean;
  /** Manually trigger a stats refresh */
  refreshStats: () => Promise<void>;
  /** Last time stats were successfully fetched */
  lastUpdated: Date | null;
}

const defaultStats: DashboardStats = {
  totalActive: 0,
  overdue: 0,
  waitingQuote: 0,
  valueInWork: 0,
  inWork: 0,
  shipped: 0,
  net30: 0,
  approved: 0,
};

const StatsContext = createContext<StatsContextType | null>(null);

/**
 * StatsProvider - Provides global dashboard statistics
 *
 * This context serves as the single source of truth for dashboard stats,
 * ensuring all components (StatsGrid, NotificationBell, etc.) display
 * consistent values.
 *
 * Features:
 * - Automatically refreshes when RefreshContext triggers
 * - Can be manually refreshed via refreshStats()
 * - Tracks loading state for skeleton UI
 * - Records last update time for debugging
 *
 * Usage:
 * - Wrap your app with <StatsProvider> inside <RefreshProvider>
 * - Components call useStats() to access stats and refreshStats
 */
export function StatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Hook into existing RefreshContext
  const { refreshKey } = useRefresh();

  const refreshStats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDashboardStats();
      if (result.success) {
        setStats(result.data);
        setLastUpdated(new Date());
      } else {
        console.error("Failed to fetch dashboard stats:", result.error);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and whenever refreshKey changes (RefreshContext trigger)
  useEffect(() => {
    refreshStats();
  }, [refreshKey, refreshStats]);

  // Also listen for custom events (e.g., from Excel import)
  useEffect(() => {
    const handleRefresh = () => {
      refreshStats();
    };

    // Listen for notifications-refresh event (fired by AutoImportTrigger)
    window.addEventListener("notifications-refresh", handleRefresh);
    // Listen for a new stats-refresh event
    window.addEventListener("stats-refresh", handleRefresh);

    return () => {
      window.removeEventListener("notifications-refresh", handleRefresh);
      window.removeEventListener("stats-refresh", handleRefresh);
    };
  }, [refreshStats]);

  return (
    <StatsContext.Provider value={{ stats, loading, refreshStats, lastUpdated }}>
      {children}
    </StatsContext.Provider>
  );
}

/**
 * useStats - Hook to access global dashboard statistics
 *
 * Usage:
 * ```tsx
 * const { stats, loading, refreshStats } = useStats();
 *
 * // Access overdue count
 * const overdueCount = stats.overdue;
 *
 * // Manually refresh after an action
 * await refreshStats();
 * ```
 */
export function useStats() {
  const ctx = useContext(StatsContext);
  if (!ctx) {
    throw new Error("useStats must be used within a StatsProvider");
  }
  return ctx;
}

/**
 * Helper to dispatch a stats refresh event from anywhere
 * Use this when you need to trigger a refresh from non-React code
 */
export function dispatchStatsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("stats-refresh"));
  }
}
