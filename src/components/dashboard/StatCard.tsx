import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

type StatCardVariant = "default" | "danger" | "warning" | "success";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatCardVariant;
  className?: string;
};

const variantStyles: Record<StatCardVariant, { icon: string; value: string; card: string }> = {
  default: {
    icon: "text-primary-bright-blue",
    value: "text-foreground",
    card: "bg-diagonal-lines",
  },
  danger: {
    icon: "text-danger-red",
    value: "text-danger-red",
    card: "",
  },
  warning: {
    icon: "text-warning-amber",
    value: "text-warning-amber",
    card: "",
  },
  success: {
    icon: "text-success-green",
    value: "text-success-green",
    card: "",
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={cn("shadow-vibrant", styles.card, className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold tabular-nums", styles.value)}>
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-muted/50",
              styles.icon
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
