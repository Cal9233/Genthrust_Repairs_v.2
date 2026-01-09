import { Header } from "@/components/layout/Header";
import { Navigation } from "@/components/layout/Navigation";
import { Assistant } from "@/components/agent/Assistant";
import { RefreshProvider } from "@/contexts/RefreshContext";
import { StatsProvider } from "@/contexts/StatsContext";

/**
 * Protected Layout - Authenticated Shell
 *
 * Provides consistent header, navigation, and AI assistant
 * for all protected routes.
 *
 * RefreshProvider enables cross-component refresh signals
 * (e.g., ExcelDropdownButton triggers RepairOrderTable refresh).
 *
 * StatsProvider provides global dashboard statistics that are
 * shared across all components (StatsGrid, NotificationBell, etc.).
 * It automatically refreshes when RefreshContext triggers.
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
    <RefreshProvider>
      <StatsProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <Navigation />
          <main className="flex-1">{children}</main>
          <Assistant />
        </div>
      </StatsProvider>
    </RefreshProvider>
  );
}
