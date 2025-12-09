"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SyncContextType {
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  return (
    <SyncContext.Provider value={{ isSyncing, setIsSyncing }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSyncStatus must be used within SyncProvider");
  }
  return context;
}
