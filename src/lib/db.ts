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
      return {
        ca: Buffer.from(process.env.DATABASE_CA_CERT_BASE64, "base64").toString("utf-8"),
        rejectUnauthorized: true,
      };
    }

    // Priority 2: Environment variable (for containerized environments like Trigger.dev)
    if (process.env.DATABASE_CA_CERT) {
      return {
        ca: process.env.DATABASE_CA_CERT,
        rejectUnauthorized: true,
      };
    }

    // Priority 3: File-based cert (for local development)
    const certPath = path.join(process.cwd(), "certs", "ca.pem");
    if (fs.existsSync(certPath)) {
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
  // Validate required database environment variables
  // During build time, we allow missing vars (they'll be set in production)
  // Only throw at runtime when actually trying to use the database
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                      (process.env.NODE_ENV === 'production' && !process.env.VERCEL);
  
  if (!process.env.DATABASE_HOST || !process.env.DATABASE_USER || !process.env.DATABASE_PASSWORD || !process.env.DATABASE_NAME) {
    if (isBuildTime) {
      // During build, just log a warning and return a mock pool
      console.warn("[db.ts] Database env vars missing during build - this is OK if they're set in Vercel");
      // Return a minimal pool that will fail gracefully when used
      // Use a connection string that won't actually connect
      return mysql.createPool({
        host: 'localhost',
        port: 3306,
        user: 'build',
        password: 'build',
        database: 'build',
        connectionLimit: 1,
      });
    }
    
    // At runtime, throw an error
    console.error("[db.ts] Missing required database environment variables:");
    console.error("  - DATABASE_HOST:", process.env.DATABASE_HOST ? "✓" : "✗ MISSING");
    console.error("  - DATABASE_USER:", process.env.DATABASE_USER ? "✓" : "✗ MISSING");
    console.error("  - DATABASE_PASSWORD:", process.env.DATABASE_PASSWORD ? "✓" : "✗ MISSING");
    console.error("  - DATABASE_NAME:", process.env.DATABASE_NAME ? "✓" : "✗ MISSING");
    throw new Error("Missing required database environment variables. Check your .env.local or Vercel environment variables.");
  }

  return mysql.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT) || 3306,
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

// Lazy initialization - only create pool when actually needed
// This allows the build to complete even if env vars are missing
function getPool(): mysql.Pool {
  if (globalForDb.conn) {
    return globalForDb.conn;
  }
  
  const pool = createPool();
  
  if (process.env.NODE_ENV !== "production") {
    globalForDb.conn = pool;
  }
  
  return pool;
}

// Create db instance immediately (needed for Auth.js adapter)
// The pool itself is lazy, so this won't fail during build
export const db = drizzle(
  new Proxy({} as mysql.Pool, {
    get(_target, prop) {
      const actualPool = getPool();
      const value = actualPool[prop as keyof mysql.Pool];
      return typeof value === 'function' ? value.bind(actualPool) : value;
    },
  }),
  { schema, mode: "default" }
);

// Export pool getter for direct access if needed (e.g., cleanup, migrations)
export const pool = new Proxy({} as mysql.Pool, {
  get(_target, prop) {
    const actualPool = getPool();
    const value = actualPool[prop as keyof mysql.Pool];
    return typeof value === 'function' ? value.bind(actualPool) : value;
  },
});