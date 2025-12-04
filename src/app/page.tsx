import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          {/* Logo with styled container */}
          <div className="flex justify-center">
            <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5">
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
            <CardTitle className="text-2xl font-bold">RO Tracker</CardTitle>
            <CardDescription className="text-sm">
              Aviation repair order tracking system
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center">
          {session?.user ? (
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
