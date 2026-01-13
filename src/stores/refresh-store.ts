import { create } from "zustand";

interface RefreshState {
  refreshKey: number;
  triggerRefresh: () => void;
}

/**
 * Refresh Store - Global state for triggering component refreshes
 * 
 * Replaces RefreshContext with Zustand.
 * Components can call triggerRefresh() to notify others that data has changed.
 */
export const useRefreshStore = create<RefreshState>((set) => ({
  refreshKey: 0,
  triggerRefresh: () => {
    set((state) => ({ refreshKey: state.refreshKey + 1 }));
  },
}));
