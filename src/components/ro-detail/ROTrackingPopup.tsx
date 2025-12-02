"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Package, Truck } from "lucide-react";

type Carrier = "fedex" | "ups" | "usps" | "unknown";

interface CarrierInfo {
  name: string;
  trackingUrl: string;
  color: string;
  icon: typeof Package;
}

const CARRIER_CONFIG: Record<Carrier, CarrierInfo> = {
  fedex: {
    name: "FedEx",
    trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=",
    color: "bg-purple-500/20 text-purple-600",
    icon: Truck,
  },
  ups: {
    name: "UPS",
    trackingUrl: "https://www.ups.com/track?tracknum=",
    color: "bg-amber-500/20 text-amber-600",
    icon: Truck,
  },
  usps: {
    name: "USPS",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
    color: "bg-blue-500/20 text-blue-600",
    icon: Package,
  },
  unknown: {
    name: "Unknown Carrier",
    trackingUrl: "",
    color: "bg-muted text-muted-foreground",
    icon: Package,
  },
};

/**
 * Detect carrier from tracking number format
 */
function detectCarrier(trackingNumber: string): Carrier {
  const cleaned = trackingNumber.replace(/\s+/g, "").toUpperCase();

  // FedEx patterns:
  // - 12 digits
  // - 15-22 digits starting with 96
  // - 20 or 22 digits
  if (/^\d{12}$/.test(cleaned)) return "fedex";
  if (/^96\d{13,20}$/.test(cleaned)) return "fedex";
  if (/^\d{20}$/.test(cleaned) || /^\d{22}$/.test(cleaned)) return "fedex";

  // UPS patterns:
  // - 1Z followed by 16 alphanumeric characters
  // - 9 digits (can also be UPS)
  // - T followed by 10 digits
  if (/^1Z[A-Z0-9]{16}$/i.test(cleaned)) return "ups";
  if (/^T\d{10}$/.test(cleaned)) return "ups";

  // USPS patterns:
  // - 20-22 digits starting with 91, 92, 93, 94
  // - 13 characters (international)
  if (/^9[1-4]\d{18,20}$/.test(cleaned)) return "usps";
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(cleaned)) return "usps";

  return "unknown";
}

interface ROTrackingPopupProps {
  trackingNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ROTrackingPopup({
  trackingNumber,
  open,
  onOpenChange,
}: ROTrackingPopupProps) {
  const carrier = detectCarrier(trackingNumber);
  const config = CARRIER_CONFIG[carrier];
  const Icon = config.icon;

  const trackingUrl = config.trackingUrl
    ? `${config.trackingUrl}${encodeURIComponent(trackingNumber)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Tracking Information
          </DialogTitle>
          <DialogDescription>
            Track your shipment with the carrier
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Carrier Badge */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Carrier:</span>
            <Badge className={config.color}>{config.name}</Badge>
          </div>

          {/* Tracking Number */}
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              Tracking Number:
            </span>
            <code className="bg-muted px-3 py-2 rounded-md font-mono text-sm select-all">
              {trackingNumber}
            </code>
          </div>

          {/* Track Button */}
          {trackingUrl ? (
            <Button
              className="w-full"
              onClick={() => window.open(trackingUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Track on {config.name}
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-4">
              <p>Unable to determine carrier.</p>
              <p className="mt-1">
                Try searching the tracking number on FedEx, UPS, or USPS
                directly.
              </p>
            </div>
          )}

          {/* Quick Links for Unknown */}
          {carrier === "unknown" && (
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `${CARRIER_CONFIG.fedex.trackingUrl}${trackingNumber}`,
                    "_blank"
                  )
                }
              >
                Try FedEx
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `${CARRIER_CONFIG.ups.trackingUrl}${trackingNumber}`,
                    "_blank"
                  )
                }
              >
                Try UPS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `${CARRIER_CONFIG.usps.trackingUrl}${trackingNumber}`,
                    "_blank"
                  )
                }
              >
                Try USPS
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
