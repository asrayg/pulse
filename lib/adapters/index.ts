import "server-only";
import path from "node:path";
import type { DbAdapter } from "@/lib/types";
import type { DataSource } from "@/lib/db/schema";
import { decryptJson } from "@/lib/crypto";
import { SqliteAdapter } from "./sqlite";
import { PostgresAdapter, type PostgresConfig } from "./postgres";

export { SqliteAdapter, PostgresAdapter };
export type { PostgresConfig };

export function demoDbPath(): string {
  return process.env.PULSE_DEMO_DB_PATH ?? path.join(process.cwd(), "data", "demo.db");
}

/** Build a runtime adapter for a stored data source. */
export function getAdapter(ds: Pick<DataSource, "type" | "encryptedConfig">): DbAdapter {
  switch (ds.type) {
    case "demo":
      return new SqliteAdapter(demoDbPath(), "demo");
    case "sqlite":
    case "csv": {
      const cfg = decryptJson<{ path: string }>(ds.encryptedConfig);
      if (!cfg?.path) throw new Error("SQLite/CSV data source is missing its file path.");
      return new SqliteAdapter(cfg.path, ds.type);
    }
    case "postgres": {
      const cfg = decryptJson<PostgresConfig>(ds.encryptedConfig);
      if (!cfg) throw new Error("Postgres data source is missing connection config.");
      return new PostgresAdapter(cfg);
    }
    case "mysql":
      throw new Error("MySQL support is coming soon.");
    default:
      throw new Error(`Unsupported data source type: ${ds.type}`);
  }
}
