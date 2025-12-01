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

const variantStyles: Record<HeroVariant, string> = {
  // Primary (Total Active) - Sky blue gradient
  primary: "bg-hero-primary",
  // Danger (Overdue) - Red/orange gradient for attention
  danger: "bg-hero-danger",
  // Success (Value in Work) - Green gradient
  success: "bg-hero-success",
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
  const gradientClass = variantStyles[variant];

  const content = (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 shadow-lg transition-all h-full",
        gradientClass,
        isActive && "ring-2 ring-inset ring-white/50",
        href && "hover:shadow-xl hover:scale-[1.02]",
        className
      )}
    >
      {/* Background decoration - subtle icon */}
      <div className="absolute right-0 top-0 opacity-10">
        <Icon className="h-32 w-32 -translate-y-4 translate-x-4 text-white" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <p className="text-sm font-medium text-white/80">{title}</p>
        <p className="mt-2 text-4xl font-bold text-white tabular-nums">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-white/70">{subtitle}</p>
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
