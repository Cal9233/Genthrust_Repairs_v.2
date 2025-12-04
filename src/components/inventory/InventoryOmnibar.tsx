"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ScanBarcode, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConditionFilter } from "@/app/actions/inventory";

interface InventoryOmnibarProps {
  onSearch: (query: string, condition: ConditionFilter) => void;
  isSearching?: boolean;
}

const CONDITION_FILTERS: { value: ConditionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "overhauled", label: "Overhauled" },
  { value: "as-removed", label: "As-Removed" },
  { value: "serviceable", label: "Serviceable" },
];

export function InventoryOmnibar({ onSearch, isSearching }: InventoryOmnibarProps) {
  const [query, setQuery] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<ConditionFilter>("all");

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query, selectedCondition);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedCondition, onSearch]);

  // Keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("inventory-search")?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleConditionChange = useCallback((condition: ConditionFilter) => {
    setSelectedCondition(condition);
  }, []);

  return (
    <div className="relative rounded-xl border bg-card/80 backdrop-blur-sm p-4 shadow-sm">
      {/* Search Row */}
      <div className="flex items-center gap-2">
        {/* Search Icon */}
        <div className="flex items-center justify-center w-10 h-14 text-muted-foreground">
          <Search className="h-5 w-5" />
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <Input
            id="inventory-search"
            type="text"
            placeholder="Search part number or description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-14 text-lg font-mono border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Scan Button */}
        <Button
          variant="outline"
          size="lg"
          className="h-14 px-4 gap-2 text-muted-foreground hover:text-foreground"
          title="Scan barcode (coming soon)"
          disabled
        >
          <ScanBarcode className="h-5 w-5" />
          <span className="hidden sm:inline">Scan</span>
        </Button>
      </div>

      {/* Filter Pills Row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          {CONDITION_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handleConditionChange(filter.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                selectedCondition === filter.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Keyboard Shortcut Hint */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-muted/50 font-mono text-[10px]">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
          <span>to search</span>
        </div>
      </div>
    </div>
  );
}
