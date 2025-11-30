import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev v3 Configuration
 *
 * Per CLAUDE.md Section 3C: All Excel syncing and AI research run in
 * Trigger.dev containers, not Vercel functions. No timeouts.
 */
export default defineConfig({
  project: "genthrust-repairs-v2",
  // Tasks located in src/trigger/ per project constraint
  dirs: ["src/trigger"],
  // Maximum task duration (10 minutes for Excel operations)
  maxDuration: 600,
  // Default retry configuration for all tasks
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
});
