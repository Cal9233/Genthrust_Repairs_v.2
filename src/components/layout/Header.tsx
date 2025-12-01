import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

export async function Header() {
  const session = await auth();
  const user = session?.user;

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-50 w-full bg-header-gradient">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-header-foreground">GenThrust</span>
          <span className="text-sm text-header-foreground/70">RO Tracker</span>
        </div>

        {/* Right: Theme Toggle + Notifications + User Avatar */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && <NotificationBell />}
          {user && (
            <Avatar className="h-9 w-9 ring-2 ring-header-foreground/20">
              <AvatarImage
                src={user.image ?? undefined}
                alt={user.name ?? "User"}
              />
              <AvatarFallback className="bg-sky-500 text-sm text-header-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </header>
  );
}
