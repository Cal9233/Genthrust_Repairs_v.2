import { signInAction } from "@/actions/auth";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const params = await searchParams;

  // Redirect if already logged in
  if (session?.user) {
    redirect(params.callbackUrl ?? "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">GenThrust RO Tracker</CardTitle>
          <CardDescription>
            Sign in to access the repair order tracker
          </CardDescription>
        </CardHeader>
        <CardContent>
          {params.error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              Authentication failed. Please try again.
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signInAction(params.callbackUrl);
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Sign in with Microsoft
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
