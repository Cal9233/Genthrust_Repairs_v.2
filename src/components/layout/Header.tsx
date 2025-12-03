import { auth } from "@/auth";
import { ExcelDropdownButton } from "./ExcelDropdownButton";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { UserProfileDropdown } from "./UserProfileDropdown";

export async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 w-full bg-header-gradient">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-lg sm:text-xl font-bold text-header-foreground">GenThrust</span>
          <span className="text-xs sm:text-sm text-header-foreground/70">RO Tracker</span>
        </div>

        {/* Right: Excel Sync + Theme Toggle + Notifications + User Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {user && <ExcelDropdownButton userId={user.id} />}
          <ThemeToggle />
          {user && <NotificationBell />}
          {user && <UserProfileDropdown user={user} />}
        </div>
      </div>
    </header>
  );
}
