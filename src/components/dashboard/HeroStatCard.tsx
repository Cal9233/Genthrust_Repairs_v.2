import Link from "next/link";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

type HeroVariant = "primary" | "danger" | "success";

type HeroStatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant: HeroVariant;
  href?: string;
  subtitle?: string;
  isActive?: boolean;
  className?: string;
};

const variantStyles: Record<HeroVariant, { bg: string; hoverShadow: string }> = {
  // Primary (Total Active) - Sky blue gradient
  primary: {
    bg: "bg-hero-primary",
    hoverShadow: "hover-shadow-sky",
  },
  // Danger (Overdue) - Red/orange gradient for attention
  danger: {
    bg: "bg-hero-danger",
    hoverShadow: "hover-shadow-red",
  },
  // Success (Value in Work) - Green gradient
  success: {
    bg: "bg-hero-success",
    hoverShadow: "hover-shadow-emerald",
  },
};

export function HeroStatCard({
  title,
  value,
  icon: Icon,
  variant,
  href,
  subtitle,
  isActive,
  className,
}: HeroStatCardProps) {
  const styles = variantStyles[variant];

  const content = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 shadow-lg transition-all duration-200 h-full cursor-pointer",
        styles.bg,
        isActive && "ring-2 ring-inset ring-white/50 shadow-xl",
        "hover:scale-[1.02] hover:shadow-xl",
        styles.hoverShadow,
        className
      )}
    >
      {/* Background decoration - subtle icon */}
      <div className="absolute right-0 top-0 opacity-10">
        <Icon className="h-20 w-20 sm:h-32 sm:w-32 -translate-y-4 translate-x-4 text-white" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <p className="text-xs sm:text-sm font-medium text-white/90 uppercase tracking-wide">{title}</p>
        <p className="mt-2 sm:mt-3 text-2xl sm:text-4xl lg:text-5xl font-bold text-white tabular-nums select-none leading-tight">
          {value}
        </p>
        {subtitle && (
          <p className="mt-2 text-xs sm:text-sm text-white/80 font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}
