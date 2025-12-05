// scripts/trigger-overdue-check.ts
// Run with: npx tsx scripts/trigger-overdue-check.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { tasks } from "@trigger.dev/sdk/v3";

async function main() {
  console.log("Triggering check-overdue-ros task...");

  const handle = await tasks.trigger("check-overdue-ros", {});

  console.log(`Task triggered successfully!`);
  console.log(`Run ID: ${handle.id}`);
  console.log(`View in dashboard: https://cloud.trigger.dev/projects/genthrust-repairs/runs/${handle.id}`);
}

main().catch((err) => {
  console.error("Error triggering task:", err);
  process.exit(1);
});
