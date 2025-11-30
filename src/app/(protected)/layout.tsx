/**
 * Protected Layout
 *
 * Wraps protected routes with necessary providers.
 * In production, this would also include auth checks.
 *
 * Note: Trigger.dev v3 realtime hooks don't require a provider -
 * they use the accessToken passed to each hook directly.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
