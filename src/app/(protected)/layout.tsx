import { Header } from "@/components/layout/Header";
import { Navigation } from "@/components/layout/Navigation";
import { Assistant } from "@/components/agent/Assistant";

/**
 * Protected Layout - Authenticated Shell
 *
 * Provides consistent header, navigation, and AI assistant
 * for all protected routes.
 *
 * Note: Trigger.dev v3 realtime hooks don't require a provider -
 * they use the accessToken passed to each hook directly.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <Navigation />
      <main className="flex-1">{children}</main>
      <Assistant />
    </div>
  );
}
