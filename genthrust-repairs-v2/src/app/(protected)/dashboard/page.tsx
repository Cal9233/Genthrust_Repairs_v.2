import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  const { user } = session;
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "U";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-2xl">Welcome back!</CardTitle>
          <CardDescription>
            You are signed in as {user.name ?? user.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-4 text-sm">
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>User ID:</strong> {user.id}
            </p>
          </div>

          <form
            action={async () => {
              "use server";
              await signOutAction();
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
