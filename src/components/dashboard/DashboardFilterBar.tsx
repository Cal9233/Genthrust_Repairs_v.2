"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getUniqueShops, getUniqueStatuses, type DashboardFilters } from "@/app/actions/dashboard";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardFilterBarProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

export function DashboardFilterBar({
  filters,
  onFiltersChange,
}: DashboardFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shops, setShops] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Count active filters
  const activeFilterCount = [
    filters.status,
    filters.shop,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  // Load shops and statuses on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      setIsLoading(true);
      const [shopsResult, statusesResult] = await Promise.all([
        getUniqueShops(),
        getUniqueStatuses(),
      ]);

      if (shopsResult.success) {
        setShops(shopsResult.data);
      }
      if (statusesResult.success) {
        setStatuses(statusesResult.data);
      }
      setIsLoading(false);
    };

    loadFilterOptions();
  }, []);

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value === "all" ? undefined : value,
    });
  };

  const handleShopChange = (value: string) => {
    onFiltersChange({
      ...filters,
      shop: value === "all" ? undefined : value,
    });
  };

  const handleDateFromChange = (value: string) => {
    onFiltersChange({
      ...filters,
      dateFrom: value || undefined,
    });
  };

  const handleDateToChange = (value: string) => {
    onFiltersChange({
      ...filters,
      dateTo: value || undefined,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
    setIsOpen(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {activeFilterCount}
              </Badge>
            )}
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        {/* Show active filter pills when collapsed */}
        {!isOpen && activeFilterCount > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-wrap">
            {filters.status && (
              <Badge variant="secondary" className="text-xs">
                Status: {filters.status}
              </Badge>
            )}
            {filters.shop && (
              <Badge variant="secondary" className="text-xs max-w-[150px] truncate">
                Shop: {filters.shop}
              </Badge>
            )}
            {(filters.dateFrom || filters.dateTo) && (
              <Badge variant="secondary" className="text-xs">
                Date: {filters.dateFrom || "..."} → {filters.dateTo || "..."}
              </Badge>
            )}
          </div>
        )}
      </div>

      <CollapsibleContent className="mt-3">
        <div className="p-4 rounded-lg border bg-card/50 backdrop-blur-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status-filter" className="text-sm font-medium">
                Status
              </Label>
              <Select
                value={filters.status || "all"}
                onValueChange={handleStatusChange}
                disabled={isLoading}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shop Filter */}
            <div className="space-y-2">
              <Label htmlFor="shop-filter" className="text-sm font-medium">
                Shop
              </Label>
              <Select
                value={filters.shop || "all"}
                onValueChange={handleShopChange}
                disabled={isLoading}
              >
                <SelectTrigger id="shop-filter">
                  <SelectValue placeholder="All Shops" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shops</SelectItem>
                  {shops.map((shop) => (
                    <SelectItem key={shop} value={shop}>
                      {shop}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From Filter */}
            <div className="space-y-2">
              <Label htmlFor="date-from" className="text-sm font-medium">
                Delivery Date From
              </Label>
              <Input
                id="date-from"
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Date To Filter */}
            <div className="space-y-2">
              <Label htmlFor="date-to" className="text-sm font-medium">
                Delivery Date To
              </Label>
              <Input
                id="date-to"
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {activeFilterCount > 0 && (
            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-muted-foreground hover:text-foreground gap-1"
              >
                <X className="h-4 w-4" />
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
