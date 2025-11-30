import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    <header className="sticky top-0 z-50 w-full bg-gradient-to-r from-primary-deep-blue to-primary-bright-blue">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">GenThrust</span>
          <span className="text-sm text-white/70">RO Tracker</span>
        </div>

        {/* Right: User Avatar */}
        <div className="flex items-center">
          {user && (
            <Avatar className="h-9 w-9 ring-2 ring-white/20">
              <AvatarImage
                src={user.image ?? undefined}
                alt={user.name ?? "User"}
              />
              <AvatarFallback className="bg-primary-bright-blue text-sm text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </header>
  );
}
