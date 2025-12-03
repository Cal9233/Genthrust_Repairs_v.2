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

const variantStyles: Record<StatCardVariant, { icon: string; value: string; card: string; hoverShadow: string }> = {
  default: {
    icon: "text-sky-500",
    value: "text-foreground",
    card: "bg-diagonal-lines",
    hoverShadow: "hover-shadow-sky",
  },
  danger: {
    icon: "text-danger",
    value: "text-danger",
    card: "",
    hoverShadow: "hover-shadow-red",
  },
  warning: {
    icon: "text-warning",
    value: "text-warning",
    card: "",
    hoverShadow: "hover-shadow-amber",
  },
  success: {
    icon: "text-success",
    value: "text-success",
    card: "",
    hoverShadow: "hover-shadow-emerald",
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
    <Card className={cn(
      "shadow-vibrant cursor-pointer transition-all hover:scale-[1.02]",
      styles.card,
      styles.hoverShadow,
      className
    )}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 sm:space-y-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-xl sm:text-2xl font-bold tabular-nums select-none", styles.value)}>
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-muted/50",
              styles.icon
            )}
          >
            <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
