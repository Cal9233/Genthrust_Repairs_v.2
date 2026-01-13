import { create } from "zustand";
import type { DashboardFilters, RepairOrderFilter, SheetFilter } from "@/app/actions/dashboard";
import type { NormalizedRepairOrder } from "@/app/actions/dashboard";

interface RepairOrdersState {
  // Table state
  query: string;
  filters: DashboardFilters;
  page: number;
  filter: RepairOrderFilter;
  sheet: SheetFilter;
  
  // Data
  data: NormalizedRepairOrder[];
  totalPages: number;
  totalCount: number;
  
  // Selected RO
  selectedRoId: number | null;
  
  // Actions
  setQuery: (query: string) => void;
  setFilters: (filters: DashboardFilters) => void;
  setPage: (page: number) => void;
  setFilter: (filter: RepairOrderFilter) => void;
  setSheet: (sheet: SheetFilter) => void;
  setData: (data: NormalizedRepairOrder[], totalPages: number, totalCount: number) => void;
  setSelectedRoId: (roId: number | null) => void;
  reset: () => void;
}

const initialState = {
  query: "",
  filters: {} as DashboardFilters,
  page: 1,
  filter: "all" as RepairOrderFilter,
  sheet: "active" as SheetFilter,
  data: [],
  totalPages: 1,
  totalCount: 0,
  selectedRoId: null,
};

/**
 * Repair Orders Store - Global state for repair orders table
 * 
 * Manages table state (filters, pagination, search) across the application.
 * This ensures consistent state when navigating between pages or components.
 */
export const useRepairOrdersStore = create<RepairOrdersState>((set) => ({
  ...initialState,

  setQuery: (query: string) => {
    set({ query, page: 1 }); // Reset to page 1 when query changes
  },

  setFilters: (filters: DashboardFilters) => {
    set({ filters, page: 1 }); // Reset to page 1 when filters change
  },

  setPage: (page: number) => {
    set({ page });
  },

  setFilter: (filter: RepairOrderFilter) => {
    set({ filter, page: 1 }); // Reset to page 1 when filter changes
  },

  setSheet: (sheet: SheetFilter) => {
    set({ sheet, page: 1 }); // Reset to page 1 when sheet changes
  },

  setData: (data: NormalizedRepairOrder[], totalPages: number, totalCount: number) => {
    set({ data, totalPages, totalCount });
  },

  setSelectedRoId: (roId: number | null) => {
    set({ selectedRoId: roId });
  },

  reset: () => {
    set(initialState);
  },
}));
