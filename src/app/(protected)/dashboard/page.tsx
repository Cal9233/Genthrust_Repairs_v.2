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
import { SyncStatus } from "@/components/sync/SyncStatus";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  const { user } = session;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.name ?? user.email}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Session Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session Info</CardTitle>
            <CardDescription>Your current session details</CardDescription>
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

        {/* Excel Sync Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Excel Sync Status</CardTitle>
            <CardDescription>
              Sync repair orders to SharePoint Excel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncStatus userId={user.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
