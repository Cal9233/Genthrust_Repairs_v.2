import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

/**
 * Global Singleton Pattern for Database Connection
 *
 * Per CLAUDE.md: Serverless environments exhaust connections.
 * This pattern prevents connection pool exhaustion during Next.js hot reload
 * by reusing the same pool instance across module reloads in development.
 */
const globalForDb = globalThis as unknown as {
  conn: mysql.Pool | undefined;
};

// Helper to get SSL config safely
function getSSLConfig() {
  try {
    // Priority 1: Base64 encoded cert (safe for production - avoids newline issues in dashboards)
    if (process.env.DATABASE_CA_CERT_BASE64) {
      console.log("[db] SSL: Using Base64 CA Cert");
      return {
        ca: Buffer.from(process.env.DATABASE_CA_CERT_BASE64, "base64").toString("utf-8"),
        rejectUnauthorized: true,
      };
    }

    // Priority 2: Environment variable (for containerized environments like Trigger.dev)
    if (process.env.DATABASE_CA_CERT) {
      console.log("[db] SSL: Using DATABASE_CA_CERT env var");
      return {
        ca: process.env.DATABASE_CA_CERT,
        rejectUnauthorized: true,
      };
    }

    // Priority 3: File-based cert (for local development)
    const certPath = path.join(process.cwd(), "certs", "ca.pem");
    if (fs.existsSync(certPath)) {
      console.log("[db] SSL: Using file-based cert at " + certPath);
      // Note: rejectUnauthorized:false needed for scripts (tsx) where Node's
      // TLS doesn't fully trust Aiven's self-signed CA chain
      return {
        ca: fs.readFileSync(certPath).toString(),
        rejectUnauthorized: false,
      };
    }

    console.warn("SSL Cert not found at " + certPath);
    // Fallback: This is unsafe in production, but allows non-SSL local dev to run
    return { rejectUnauthorized: true };
  } catch (e) {
    console.warn("Could not load CA cert for SSL connection", e);
    // Fallback
    return { rejectUnauthorized: true };
  }
}

const createPool = () => {
  return mysql.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    connectionLimit: 10, // Per CLAUDE.md requirement
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // Connection lifecycle - prevent stale connections from Aiven timeout (~600s)
    idleTimeout: 60000, // Close idle connections after 60s
    maxIdle: 5, // Reduce idle connection count
    // SSL configuration for Aiven MySQL
    ssl: getSSLConfig(),
  });
};

// Reuse pool in development to prevent hot reload exhaustion
const pool = globalForDb.conn ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = pool;
}

// Export the Drizzle instance with schema for relational queries
export const db = drizzle(pool, { schema, mode: "default" });

// Export pool for direct access if needed (e.g., cleanup, migrations)
export { pool };