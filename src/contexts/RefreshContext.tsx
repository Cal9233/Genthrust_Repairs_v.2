"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface RefreshContextType {
  /** Increment this to trigger a refresh in subscribed components */
  refreshKey: number;
  /** Call this to trigger a refresh across all subscribed components */
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextType | null>(null);

/**
 * RefreshProvider - Provides global refresh coordination
 *
 * Wrap your app or layout with this provider to enable cross-component
 * refresh signals. Components can call triggerRefresh() to notify others
 * that data has changed.
 */
export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

/**
 * useRefresh - Hook to access refresh context
 *
 * Usage:
 * - Call triggerRefresh() when you've made changes that others should see
 * - Include refreshKey in useEffect deps to re-fetch when triggered
 */
export function useRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return ctx;
}
