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
          "bg-warning/20 text-warning dark:bg-warning/30",
      };

    case "WAITING PARTS":
    case "WAITING FOR PARTS":
      return {
        label: "Waiting Parts",
        colorClasses:
          "bg-warning/20 text-warning dark:bg-warning/30",
      };

    case "PENDING":
      return {
        label: "Pending",
        colorClasses:
          "bg-warning/20 text-warning dark:bg-warning/30",
      };

    // Active/In Progress states - Blue/Cyan
    case "APPROVED":
      return {
        label: "Approved",
        colorClasses:
          "bg-sky-500/20 text-sky-600 dark:bg-sky-500/30 dark:text-sky-400",
      };

    case "IN WORK":
    case "IN PROGRESS":
    case "WORKING":
      return {
        label: "In Work",
        colorClasses:
          "bg-accent-cyan/20 text-accent-cyan dark:bg-accent-cyan/30",
      };

    case "SHIPPED":
    case "IN TRANSIT":
      return {
        label: status === "SHIPPED" ? "Shipped" : "In Transit",
        colorClasses:
          "bg-sky-500/20 text-sky-600 dark:bg-sky-500/30 dark:text-sky-400",
      };

    // Success states - Green
    case "RECEIVED":
    case "COMPLETE":
    case "COMPLETED":
    case "DONE":
      return {
        label: status === "RECEIVED" ? "Received" : "Complete",
        colorClasses:
          "bg-success/20 text-success dark:bg-success/30",
      };

    case "PAID":
      return {
        label: "Paid",
        colorClasses:
          "bg-success/20 text-success dark:bg-success/30",
      };

    // Failure/Problem states - Red
    case "BER":
      return {
        label: "BER",
        colorClasses:
          "bg-danger/20 text-danger dark:bg-danger/30",
      };

    case "RAI":
      return {
        label: "RAI",
        colorClasses:
          "bg-danger/20 text-danger dark:bg-danger/30",
      };

    case "RETURNED":
    case "RETURN":
      return {
        label: "Returned",
        colorClasses:
          "bg-danger/20 text-danger dark:bg-danger/30",
      };

    case "CANCELLED":
    case "CANCELED":
      return {
        label: "Cancelled",
        colorClasses:
          "bg-danger/20 text-danger dark:bg-danger/30",
      };

    // Default - Neutral gray
    default:
      return {
        label: status || "Unknown",
        colorClasses: "bg-muted text-muted-foreground",
      };
  }
}
