"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, FileText, Menu, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/summary", label: "Summary", icon: FileText },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Find active item for mobile display
  const activeItem = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <nav className="border-t border-header-foreground/10 bg-header-gradient">
      <div className="container mx-auto px-4">
        {/* Desktop Navigation - hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1 py-2">
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

        {/* Mobile Navigation - visible only on mobile */}
        <div className="flex sm:hidden items-center justify-between py-2">
          {/* Current page indicator */}
          <div className="flex items-center gap-2 text-header-foreground font-medium">
            {activeItem && (
              <>
                <activeItem.icon className="h-4 w-4" />
                <span>{activeItem.label}</span>
              </>
            )}
          </div>

          {/* Hamburger menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-header-foreground/80 hover:bg-header-hover hover:text-header-foreground transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-2">
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors min-h-[48px]",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
