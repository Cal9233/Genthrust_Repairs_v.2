import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard";

interface StatsState {
  stats: DashboardStats | null;
  loading: boolean;
  lastUpdated: Date | null;
  refreshStats: () => Promise<void>;
  setInitialStats: (stats: DashboardStats) => void;
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

/**
 * Stats Store - Global state for dashboard statistics
 * 
 * Replaces StatsContext with Zustand for better performance and simpler API.
 * 
 * Features:
 * - Automatic stats refresh
 * - Loading state management
 * - SSR hydration support
 * - Event-based refresh triggers
 * - Listens to refreshKey changes from refresh store
 */
export const useStatsStore = create<StatsState>()(
  subscribeWithSelector((set, get) => ({
    stats: null,
    loading: false,
    lastUpdated: null,

    // Set initial stats from server (SSR hydration)
    setInitialStats: (stats: DashboardStats) => {
      set({ stats, loading: false, lastUpdated: new Date() });
    },

    // Refresh stats from server
    refreshStats: async () => {
      set({ loading: true });
      try {
        const result = await getDashboardStats();
        if (result.success) {
          set({ 
            stats: result.data, 
            loading: false, 
            lastUpdated: new Date() 
          });
        } else {
          console.error("Failed to fetch dashboard stats:", result.error);
          set({ loading: false });
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        set({ loading: false });
      }
    },
  }))
);

// Subscribe to refresh store changes
if (typeof window !== "undefined") {
  // Dynamically import to avoid circular dependency
  import("./refresh-store").then(({ useRefreshStore }) => {
    // Listen to refreshKey changes from refresh store
    useRefreshStore.subscribe(
      (state) => state.refreshKey,
      (refreshKey) => {
        // Only refresh if refreshKey > 0 (user triggered refresh)
        if (refreshKey > 0) {
          useStatsStore.getState().refreshStats();
        }
      }
    );
  });

  // Listen for custom refresh events
  window.addEventListener("stats-refresh", () => {
    useStatsStore.getState().refreshStats();
  });

  window.addEventListener("notifications-refresh", () => {
    useStatsStore.getState().refreshStats();
  });
}

/**
 * Helper function to dispatch stats refresh from anywhere
 * Use this when you need to trigger a refresh from non-React code
 */
export function dispatchStatsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("stats-refresh"));
  }
}
