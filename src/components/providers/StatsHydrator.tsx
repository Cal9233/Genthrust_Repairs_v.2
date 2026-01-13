"use client";

import { useEffect } from "react";
import { useStatsStore } from "@/stores/stats-store";
import type { DashboardStats } from "@/app/actions/dashboard";

interface StatsHydratorProps {
  children: React.ReactNode;
  initialStats?: DashboardStats;
}

/**
 * StatsHydrator - Client component that hydrates Zustand store with server data
 * 
 * This component runs on the client and initializes the Zustand store
 * with server-side fetched data to prevent flash of zeros.
 */
export function StatsHydrator({ children, initialStats }: StatsHydratorProps) {
  const setInitialStats = useStatsStore((state) => state.setInitialStats);

  useEffect(() => {
    if (initialStats) {
      setInitialStats(initialStats);
    } else {
      // If no initial stats, fetch them
      useStatsStore.getState().refreshStats();
    }
  }, [initialStats, setInitialStats]);

  return <>{children}</>;
}
