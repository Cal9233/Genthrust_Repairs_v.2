"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { createRepairOrder } from "@/app/actions/repair-orders";
import { useRefresh } from "@/contexts/RefreshContext";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface AddRODialogProps {
  children?: React.ReactNode;
}

/**
 * AddRODialog - Dialog form to create a new repair order
 *
 * Fields:
 * - Shop Name (required)
 * - Part Number (required)
 * - Serial Number
 * - Part Description
 * - Requested Work
 * - Estimated Cost
 */
export function AddRODialog({ children }: AddRODialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { triggerRefresh } = useRefresh();

  // Form state
  const [formData, setFormData] = useState({
    shopName: "",
    part: "",
    serial: "",
    partDescription: "",
    reqWork: "",
    estimatedCost: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.shopName.trim() || !formData.part.trim()) {
      toast.error("Shop name and part number are required");
      return;
    }

    startTransition(async () => {
      const result = await createRepairOrder({
        shopName: formData.shopName.trim(),
        part: formData.part.trim(),
        serial: formData.serial.trim() || undefined,
        partDescription: formData.partDescription.trim() || undefined,
        reqWork: formData.reqWork.trim() || undefined,
        estimatedCost: formData.estimatedCost
          ? parseFloat(formData.estimatedCost)
          : undefined,
      });

      if (result.success) {
        toast.success(`RO #${result.data.ro} created successfully`);
        triggerRefresh();
        setOpen(false);
        // Reset form
        setFormData({
          shopName: "",
          part: "",
          serial: "",
          partDescription: "",
          reqWork: "",
          estimatedCost: "",
        });
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" className="gap-1 cursor-pointer">
            <Plus className="h-4 w-4" />
            Add RO
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Repair Order</DialogTitle>
            <DialogDescription>
              Enter the details for the new repair order. It will be synced to
              Excel automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Shop Name */}
            <div className="grid gap-2">
              <Label htmlFor="shopName">
                Shop Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="shopName"
                name="shopName"
                value={formData.shopName}
                onChange={handleChange}
                placeholder="e.g., Florida Turbine"
                required
              />
            </div>

            {/* Part Number */}
            <div className="grid gap-2">
              <Label htmlFor="part">
                Part Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="part"
                name="part"
                value={formData.part}
                onChange={handleChange}
                placeholder="e.g., 6K-123456"
                required
              />
            </div>

            {/* Serial Number */}
            <div className="grid gap-2">
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                name="serial"
                value={formData.serial}
                onChange={handleChange}
                placeholder="e.g., SN123456"
              />
            </div>

            {/* Part Description */}
            <div className="grid gap-2">
              <Label htmlFor="partDescription">Part Description</Label>
              <Input
                id="partDescription"
                name="partDescription"
                value={formData.partDescription}
                onChange={handleChange}
                placeholder="e.g., Turbine Blade Assembly"
              />
            </div>

            {/* Requested Work */}
            <div className="grid gap-2">
              <Label htmlFor="reqWork">Requested Work</Label>
              <Textarea
                id="reqWork"
                name="reqWork"
                value={formData.reqWork}
                onChange={handleChange}
                placeholder="Describe the work needed..."
                rows={2}
              />
            </div>

            {/* Estimated Cost */}
            <div className="grid gap-2">
              <Label htmlFor="estimatedCost">Estimated Cost ($)</Label>
              <Input
                id="estimatedCost"
                name="estimatedCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={handleChange}
                placeholder="e.g., 1500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <TurbineSpinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                "Create RO"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
