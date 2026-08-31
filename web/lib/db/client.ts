import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DATABASE_PATH = process.env.DATABASE_PATH ?? "./data/dank.db";

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

declare global {
  var __dankSqlite: Database.Database | undefined;
}

// Reuse a single connection across hot-reloads in dev.
const sqlite = global.__dankSqlite ?? new Database(DATABASE_PATH);
if (process.env.NODE_ENV !== "production") {
  global.__dankSqlite = sqlite;
}

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
