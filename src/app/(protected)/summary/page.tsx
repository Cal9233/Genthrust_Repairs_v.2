import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SummaryList } from "@/components/summary/SummaryList";

export default async function SummaryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Priority Feed</h1>
        <p className="text-muted-foreground">
          Most critical repair orders first - read the top items to your boss
        </p>
      </div>

      {/* Priority Feed List */}
      <SummaryList />
    </div>
  );
}
