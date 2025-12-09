import Image from "next/image";
import { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Sign In | GenThrust RO Tracker",
  description:
    "Sign in to access the GenThrust aviation repair order tracking system",
};

export const dynamic = "force-dynamic";

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
    <div className="flex min-h-screen items-center justify-center bg-background bg-diagonal-lines px-4">
      <Card className="w-full max-w-md shadow-vibrant">
        <CardHeader className="text-center space-y-4">
          {/* Logo with styled container */}
          <div className="flex justify-center">
            <div className="rounded-2xl bg-card p-4 shadow-lg border border-border">
              <Image
                src="/GenLogoTab.png"
                alt="GenThrust Logo"
                width={120}
                height={120}
                className="h-24 w-24 object-contain"
                priority
              />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription className="text-sm">
              Sign in to access the repair order tracker
            </CardDescription>
          </div>
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

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Aviation repair order tracking system
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
