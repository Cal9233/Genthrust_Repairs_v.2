import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load .env.local manually for the migration tool
dotenv.config({ path: ".env.local" });

function getSSLConfig() {
  try {
    const certPath = path.join(process.cwd(), "certs", "ca.pem");
    if (fs.existsSync(certPath)) {
      return { 
        ca: fs.readFileSync(certPath).toString(),
        rejectUnauthorized: true 
      };
    }
    // Fallback if cert is missing
    return { rejectUnauthorized: true };
  } catch {
    return { rejectUnauthorized: true };
  }
}

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.DATABASE_HOST!,
    port: Number(process.env.DATABASE_PORT!),
    user: process.env.DATABASE_USER!,
    password: process.env.DATABASE_PASSWORD!,
    database: process.env.DATABASE_NAME!,
    // @ts-ignore - Drizzle Kit types can be strict about SSL shapes, but this works for mysql2
    ssl: getSSLConfig(), // <--- CHANGED: Actually calling the function
  },
  verbose: true,
  strict: true,
});