import { Header } from "@/components/layout/Header";
import { Navigation } from "@/components/layout/Navigation";
import { Assistant } from "@/components/agent/Assistant";
import { RefreshProvider } from "@/contexts/RefreshContext";
import { StatsProvider } from "@/contexts/StatsContext";
import { getDashboardStats } from "@/app/actions/dashboard";

/**
 * Protected Layout - Authenticated Shell (Async Server Component)
 *
 * Provides consistent header, navigation, and AI assistant
 * for all protected routes.
 *
 * RefreshProvider enables cross-component refresh signals
 * (e.g., ExcelDropdownButton triggers RepairOrderTable refresh).
 *
 * StatsProvider provides global dashboard statistics that are
 * shared across all components (StatsGrid, NotificationBell, etc.).
 * - Initial stats are fetched server-side (no flash of zeros)
 * - It automatically refreshes when RefreshContext triggers
 *
 * Note: Trigger.dev v3 realtime hooks don't require a provider -
 * they use the accessToken passed to each hook directly.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch initial stats server-side for SSR hydration
  // Gracefully handle errors (e.g., missing DB env vars) to prevent server crashes
  let initialStats;
  try {
    const statsResult = await getDashboardStats();
    initialStats = statsResult.success ? statsResult.data : undefined;
  } catch (error) {
    // Log error but don't crash - app can still render with undefined stats
    console.error("[ProtectedLayout] Failed to fetch initial stats:", error);
    initialStats = undefined;
  }

  return (
    <RefreshProvider>
      <StatsProvider initialStats={initialStats}>
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
