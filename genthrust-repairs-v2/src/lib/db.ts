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
    const certPath = path.join(process.cwd(), "certs", "ca.pem");
    // check if file exists
    if (fs.existsSync(certPath)) {
      return { 
        ca: fs.readFileSync(certPath).toString(),
        rejectUnauthorized: true 
      };
    }
    console.warn("SSL Cert not found at " + certPath);
    return { rejectUnauthorized: true }; // Fallback
  } catch (e) {
    console.warn("Could not load CA cert for SSL connection", e);
    return { rejectUnauthorized: true }; // Fallback
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
    // SSL configuration for Aiven MySQL
    ssl: getSSLConfig(), // <--- CHANGED: Actually calling the function now
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