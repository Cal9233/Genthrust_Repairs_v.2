"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { Link, Plus, X, ExternalLink, Search } from "lucide-react";
import {
  linkROs,
  unlinkROs,
  searchROsForLinking,
  type RelatedRO,
} from "@/app/actions/repair-orders";

interface RORelatedOrdersProps {
  repairOrderId: number;
  relatedROs: RelatedRO[];
  onRelationChanged: () => void;
}

const RELATION_TYPES = [
  { value: "PARENT", label: "Parent RO" },
  { value: "CHILD", label: "Child RO" },
  { value: "RELATED", label: "Related RO" },
  { value: "REPLACEMENT", label: "Replacement" },
  { value: "REWORK", label: "Rework" },
] as const;

function getRelationLabel(type: string): string {
  const found = RELATION_TYPES.find((r) => r.value === type);
  return found?.label || type;
}

export function RORelatedOrders({
  repairOrderId,
  relatedROs,
  onRelationChanged,
}: RORelatedOrdersProps) {
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: number; ro: number | null; shopName: string | null; part: string | null }>
  >([]);
  const [selectedRoId, setSelectedRoId] = useState<number | null>(null);
  const [relationType, setRelationType] = useState<string>("RELATED");
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchROsForLinking(searchQuery, repairOrderId);
        if (result.success) {
          setSearchResults(result.data);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, repairOrderId]);

  const handleLink = async () => {
    if (!selectedRoId) return;

    setLinking(true);
    setError(null);

    try {
      const result = await linkROs(repairOrderId, selectedRoId, relationType);
      if (result.success) {
        setShowLinkForm(false);
        setSearchQuery("");
        setSelectedRoId(null);
        setRelationType("RELATED");
        onRelationChanged();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link RO");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (relationId: number) => {
    if (!confirm("Remove this relationship?")) return;

    setUnlinkingId(relationId);
    setError(null);

    try {
      const result = await unlinkROs(relationId);
      if (result.success) {
        onRelationChanged();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink RO");
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Link className="h-4 w-4" />
          Related Orders
        </h3>

        {!showLinkForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLinkForm(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Link RO
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-2 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
          {error}
        </div>
      )}

      {/* Link Form */}
      {showLinkForm && (
        <div className="mb-4 p-3 bg-background/50 rounded-lg border border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedRoId(null);
              }}
              placeholder="Search by RO#, shop, or part..."
              className="pl-9"
            />
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {searching ? (
                <div className="flex justify-center py-2">
                  <TurbineSpinner size="sm" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No matching ROs found
                </p>
              ) : (
                searchResults.map((ro) => (
                  <button
                    key={ro.id}
                    onClick={() => setSelectedRoId(ro.id)}
                    className={`w-full text-left p-2 rounded text-sm transition-colors ${
                      selectedRoId === ro.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="font-mono font-medium">G{ro.ro ?? "—"}</span>
                    <span className="mx-2 text-muted-foreground">•</span>
                    <span>{ro.shopName ?? "—"}</span>
                    <span className="mx-2 text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{ro.part ?? "—"}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Relation Type */}
          {selectedRoId && (
            <Select value={relationType} onValueChange={setRelationType}>
              <SelectTrigger>
                <SelectValue placeholder="Select relationship type" />
              </SelectTrigger>
              <SelectContent>
                {RELATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowLinkForm(false);
                setSearchQuery("");
                setSelectedRoId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleLink}
              disabled={linking || !selectedRoId}
            >
              {linking ? (
                <TurbineSpinner size="sm" className="mr-1" />
              ) : (
                <Link className="h-4 w-4 mr-1" />
              )}
              Link
            </Button>
          </div>
        </div>
      )}

      {/* Related ROs List */}
      {relatedROs.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Link className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No related orders</p>
        </div>
      ) : (
        <div className="space-y-2">
          {relatedROs.map((ro) => (
            <div
              key={ro.relationId}
              className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-primary">
                    G{ro.ro}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {getRelationLabel(ro.relationType)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {ro.shopName} • {ro.part}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    window.open(`/dashboard?ro=${ro.ro}`, "_blank")
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlink(ro.relationId)}
                  disabled={unlinkingId === ro.relationId}
                  className="text-danger hover:text-danger"
                >
                  {unlinkingId === ro.relationId ? (
                    <TurbineSpinner size="sm" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
