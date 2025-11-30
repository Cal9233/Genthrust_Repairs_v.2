import { defineConfig } from "@trigger.dev/sdk/v3";
import { additionalPackages } from "@trigger.dev/build/extensions/core";

/**
 * Trigger.dev v3 Configuration
 *
 * Per CLAUDE.md Section 3C: All Excel syncing and AI research run in
 * Trigger.dev containers, not Vercel functions. No timeouts.
 */
export default defineConfig({
  project: "proj_waiuxiavkqsniyemifdg",
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
  // Build configuration
  build: {
    // Externalize packages that shouldn't be bundled (installed at runtime)
    external: [
      "isomorphic-fetch",
      "@microsoft/microsoft-graph-client",
    ],
    // Extensions to add additional packages to the container
    extensions: [
      additionalPackages({
        packages: [
          "isomorphic-fetch",
          "@microsoft/microsoft-graph-client",
        ],
      }),
    ],
  },
});
