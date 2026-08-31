import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgresql://localhost:5432/dank_fun";

declare global {
  var __dankPool: Pool | undefined;
}

export const pool = global.__dankPool ?? new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
if (process.env.NODE_ENV !== "production") global.__dankPool = pool;

export const db = drizzle(pool, { schema });
