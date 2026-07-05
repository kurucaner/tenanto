import { Pool } from "pg";

import { runMigrations } from "./migrations";

export const pool = new Pool({
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: Number.parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
});

export const initializeDatabase = async () => {
  try {
    // Test connection
    const client = await pool.connect();
    client.release();

    // Run migrations
    await runMigrations(pool);

    return true;
  } catch (error) {
    console.error("[DB] Failed to connect to database:", error);
    return false;
  }
};

pool.on("connect", () => {});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});
