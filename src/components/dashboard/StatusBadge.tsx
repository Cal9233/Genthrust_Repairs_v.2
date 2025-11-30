import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
};

/**
 * Maps repair order status values to styled badges
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toUpperCase()?.trim() || "";

  const { label, colorClasses } = getStatusConfig(normalizedStatus);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-transparent font-medium",
        colorClasses,
        className
      )}
    >
      {label || status || "Unknown"}
    </Badge>
  );
}

function getStatusConfig(status: string): {
  label: string;
  colorClasses: string;
} {
  switch (status) {
    // Waiting/Pending states - Amber/Warning
    case "WAITING QUOTE":
    case "WAITING FOR QUOTE":
    case "AWAITING QUOTE":
      return {
        label: "Waiting Quote",
        colorClasses:
          "bg-warning-amber/20 text-warning-amber dark:bg-warning-amber/30",
      };

    case "WAITING PARTS":
    case "WAITING FOR PARTS":
      return {
        label: "Waiting Parts",
        colorClasses:
          "bg-warning-amber/20 text-warning-amber dark:bg-warning-amber/30",
      };

    case "PENDING":
      return {
        label: "Pending",
        colorClasses:
          "bg-warning-amber/20 text-warning-amber dark:bg-warning-amber/30",
      };

    // Active/In Progress states - Blue/Cyan
    case "APPROVED":
      return {
        label: "Approved",
        colorClasses:
          "bg-primary-bright-blue/20 text-primary-bright-blue dark:bg-primary-bright-blue/30",
      };

    case "IN WORK":
    case "IN PROGRESS":
    case "WORKING":
      return {
        label: "In Work",
        colorClasses:
          "bg-accent-electric/20 text-accent-electric dark:bg-accent-electric/30",
      };

    case "SHIPPED":
    case "IN TRANSIT":
      return {
        label: status === "SHIPPED" ? "Shipped" : "In Transit",
        colorClasses:
          "bg-primary-bright-blue/20 text-primary-bright-blue dark:bg-primary-bright-blue/30",
      };

    // Success states - Green
    case "RECEIVED":
    case "COMPLETE":
    case "COMPLETED":
    case "DONE":
      return {
        label: status === "RECEIVED" ? "Received" : "Complete",
        colorClasses:
          "bg-success-green/20 text-success-green dark:bg-success-green/30",
      };

    case "PAID":
      return {
        label: "Paid",
        colorClasses:
          "bg-success-green/20 text-success-green dark:bg-success-green/30",
      };

    // Failure/Problem states - Red
    case "BER":
      return {
        label: "BER",
        colorClasses:
          "bg-danger-red/20 text-danger-red dark:bg-danger-red/30",
      };

    case "RAI":
      return {
        label: "RAI",
        colorClasses:
          "bg-danger-red/20 text-danger-red dark:bg-danger-red/30",
      };

    case "RETURNED":
    case "RETURN":
      return {
        label: "Returned",
        colorClasses:
          "bg-danger-red/20 text-danger-red dark:bg-danger-red/30",
      };

    case "CANCELLED":
    case "CANCELED":
      return {
        label: "Cancelled",
        colorClasses:
          "bg-danger-red/20 text-danger-red dark:bg-danger-red/30",
      };

    // Default - Neutral gray
    default:
      return {
        label: status || "Unknown",
        colorClasses: "bg-muted text-muted-foreground",
      };
  }
}
