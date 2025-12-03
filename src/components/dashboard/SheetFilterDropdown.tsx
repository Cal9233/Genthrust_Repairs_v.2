"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet } from "lucide-react";
import type { SheetFilter } from "@/app/actions/dashboard";

/**
 * Sheet filter options for the dropdown
 */
const SHEET_OPTIONS: {
  value: SheetFilter;
  label: string;
  description: string;
}[] = [
  {
    value: "active",
    label: "Active",
    description: "Current repairs in progress",
  },
  {
    value: "net",
    label: "Net",
    description: "Awaiting NET30 payment",
  },
  {
    value: "paid",
    label: "Paid",
    description: "Completed and paid",
  },
  {
    value: "returns",
    label: "Returns",
    description: "RAI, BER, Cancelled, Scrap",
  },
];

interface SheetFilterDropdownProps {
  /**
   * Currently selected sheet filter
   */
  currentSheet: SheetFilter;
  /**
   * Optional callback when sheet changes (for client-side state management)
   */
  onSheetChange?: (sheet: SheetFilter) => void;
}

/**
 * SheetFilterDropdown - A dropdown to switch between different repair order sheets/tables
 *
 * Updates the URL query parameter when selection changes:
 * - /dashboard (default, active sheet)
 * - /dashboard?sheet=net
 * - /dashboard?sheet=paid
 * - /dashboard?sheet=returns
 */
export function SheetFilterDropdown({
  currentSheet,
  onSheetChange,
}: SheetFilterDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSheetChange = (value: string) => {
    const newSheet = value as SheetFilter;

    // If callback provided, use it (for client-side state)
    if (onSheetChange) {
      onSheetChange(newSheet);
      return;
    }

    // Otherwise, update URL
    const params = new URLSearchParams(searchParams.toString());

    if (newSheet === "active") {
      // Remove sheet param for default (cleaner URLs)
      params.delete("sheet");
    } else {
      params.set("sheet", newSheet);
    }

    // Reset page to 1 when changing sheets
    params.delete("page");

    const queryString = params.toString();
    router.push(queryString ? `/dashboard?${queryString}` : "/dashboard");
  };

  const currentOption = SHEET_OPTIONS.find((opt) => opt.value === currentSheet);

  return (
    <div className="flex items-center gap-2">
      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
      <Select value={currentSheet} onValueChange={handleSheetChange}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Select sheet">
            {currentOption?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SHEET_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex flex-col py-0.5">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
