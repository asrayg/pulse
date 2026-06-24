import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const DB_PATH = process.env.PULSE_DB_PATH ?? path.join(process.cwd(), "data", "pulse.db");

// Ensure the data dir exists.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __pulseSqlite: Database.Database | undefined;
}

const sqlite = global.__pulseSqlite ?? new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
if (process.env.NODE_ENV !== "production") global.__pulseSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
export const rawDb = sqlite;
