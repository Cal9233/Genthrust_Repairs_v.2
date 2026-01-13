import { create } from "zustand";

interface SyncState {
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
}

/**
 * Sync Store - Global state for Excel sync status
 * 
 * Replaces SyncContext with Zustand.
 * Tracks whether Excel import/sync is in progress.
 */
export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  setIsSyncing: (syncing: boolean) => {
    set({ isSyncing: syncing });
  },
}));
