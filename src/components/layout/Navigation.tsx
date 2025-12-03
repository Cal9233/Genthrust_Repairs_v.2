"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, FileText } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/summary", label: "Summary", icon: FileText },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-header-foreground/10 bg-header-gradient">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1 py-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-nav-active-bg text-nav-active-text shadow-sm"
                    : "text-header-foreground/80 hover:bg-header-hover hover:text-header-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
