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
      "shadow-sm border-border/50 cursor-pointer transition-all duration-200",
      "hover:shadow-md hover:scale-[1.02] hover:border-border",
      styles.card,
      styles.hoverShadow,
      className
    )}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className={cn("text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums select-none leading-tight", styles.value)}>
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-muted/50 flex-shrink-0 ml-3",
              styles.icon
            )}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
