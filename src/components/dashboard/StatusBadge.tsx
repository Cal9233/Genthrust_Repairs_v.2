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
          "bg-amber-100 text-amber-700 dark:bg-warning/30 dark:text-warning",
      };

    case "WAITING PARTS":
    case "WAITING FOR PARTS":
      return {
        label: "Waiting Parts",
        colorClasses:
          "bg-amber-100 text-amber-700 dark:bg-warning/30 dark:text-warning",
      };

    case "PENDING":
      return {
        label: "Pending",
        colorClasses:
          "bg-amber-100 text-amber-700 dark:bg-warning/30 dark:text-warning",
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
          "bg-cyan-100 text-cyan-700 dark:bg-accent-cyan/30 dark:text-accent-cyan",
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
          "bg-emerald-100 text-emerald-700 dark:bg-success/30 dark:text-success",
      };

    case "PAID":
      return {
        label: "Paid",
        colorClasses:
          "bg-emerald-100 text-emerald-700 dark:bg-success/30 dark:text-success",
      };

    // Failure/Problem states - Red
    case "BER":
      return {
        label: "BER",
        colorClasses:
          "bg-red-100 text-red-700 dark:bg-danger/30 dark:text-danger",
      };

    case "RAI":
      return {
        label: "RAI",
        colorClasses:
          "bg-red-100 text-red-700 dark:bg-danger/30 dark:text-danger",
      };

    case "RETURNED":
    case "RETURN":
      return {
        label: "Returned",
        colorClasses:
          "bg-red-100 text-red-700 dark:bg-danger/30 dark:text-danger",
      };

    case "CANCELLED":
    case "CANCELED":
      return {
        label: "Cancelled",
        colorClasses:
          "bg-red-100 text-red-700 dark:bg-danger/30 dark:text-danger",
      };

    case "SCRAP":
      return {
        label: "Scrap",
        colorClasses:
          "bg-red-100 text-red-700 dark:bg-danger/30 dark:text-danger",
      };

    // Action needed states - Amber/Warning (to draw attention)
    case "TO SEND":
    case "SEND":
      return {
        label: "To Send",
        colorClasses:
          "bg-amber-100 text-amber-700 dark:bg-warning/30 dark:text-warning",
      };

    // Default - Neutral gray
    default:
      return {
        label: status || "Unknown",
        colorClasses: "bg-muted text-muted-foreground",
      };
  }
}
