import { promises as fs } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import Papa from "papaparse";
import { nanoid } from "nanoid";
import { requireCtx, fail, json, route } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { SqliteAdapter } from "@/lib/adapters/sqlite";

type ParsedRow = Record<string, unknown>;
type ColType = "INTEGER" | "REAL" | "TEXT";

/** Derive a safe SQLite table name from a file name. */
function safeTableName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned || /^[0-9]/.test(cleaned)) return cleaned ? `t_${cleaned}` : "data";
  return cleaned;
}

/** Sanitize a column name so it is a valid identifier; fall back to a positional name. */
function safeColumnName(raw: string, index: number): string {
  const trimmed = (raw ?? "").toString().trim();
  const cleaned = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned) return `col_${index + 1}`;
  if (/^[0-9]/.test(cleaned)) return `c_${cleaned}`;
  return cleaned;
}

/** Infer a column's SQLite affinity from the first ~50 non-null sample values. */
function inferColType(values: unknown[]): ColType {
  let sawValue = false;
  let allInteger = true;
  let allNumber = true;
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    sawValue = true;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) {
        allInteger = false;
        allNumber = false;
        break;
      }
      if (!Number.isInteger(v)) allInteger = false;
      continue;
    }
    if (typeof v === "boolean") {
      // booleans coerce to 0/1 integers
      continue;
    }
    const s = String(v).trim();
    if (s === "") continue;
    if (/^[+-]?\d+$/.test(s)) {
      continue;
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
      allInteger = false;
      continue;
    }
    allInteger = false;
    allNumber = false;
    break;
  }
  if (!sawValue) return "TEXT";
  if (allInteger) return "INTEGER";
  if (allNumber) return "REAL";
  return "TEXT";
}

/** Coerce a raw parsed value to the inferred column type for insertion. */
function coerce(value: unknown, type: ColType): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return type === "TEXT" ? String(value) : value ? 1 : 0;
  if (type === "TEXT") {
    return typeof value === "number" ? String(value) : String(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (type === "INTEGER") return Number.isInteger(n) ? n : Math.trunc(n);
  return n;
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("Expected multipart/form-data with a 'file' field.");
    }

    const fileEntry = form.get("file");
    if (!fileEntry || typeof fileEntry === "string") {
      return fail("Missing uploaded file.");
    }
    const file = fileEntry as File;
    const providedName = form.get("name");
    const name =
      (typeof providedName === "string" && providedName.trim()) || file.name || "Uploaded CSV";

    const text = await file.text();
    if (!text.trim()) return fail("Uploaded file is empty.");

    const parsed = Papa.parse<ParsedRow>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    const rows = (parsed.data || []).filter(
      (r) => r && typeof r === "object" && Object.keys(r).length > 0,
    );
    if (rows.length === 0) return fail("No data rows found in file.");

    const rawFields =
      parsed.meta?.fields?.filter((f) => f != null && String(f).trim() !== "") ?? [];
    if (rawFields.length === 0) return fail("Could not detect any columns (missing header row).");

    // Map raw header -> safe unique column name.
    const used = new Set<string>();
    const columns = rawFields.map((raw, i) => {
      let nameCandidate = safeColumnName(String(raw), i);
      while (used.has(nameCandidate)) nameCandidate = `${nameCandidate}_${i + 1}`;
      used.add(nameCandidate);
      return { raw: String(raw), name: nameCandidate };
    });

    // Infer types from up to 50 non-null sample values per column.
    const colTypes: ColType[] = columns.map((c) => {
      const samples: unknown[] = [];
      for (const r of rows) {
        const v = r[c.raw];
        if (v !== null && v !== undefined && v !== "") {
          samples.push(v);
          if (samples.length >= 50) break;
        }
      }
      return inferColType(samples);
    });

    const table = safeTableName(name);

    // Materialize into a per-file SQLite DB.
    const uploadsDir = path.join(process.cwd(), "data", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const dbPath = path.join(uploadsDir, `${nanoid()}.db`);

    const sqlite = new Database(dbPath);
    try {
      sqlite.pragma("journal_mode = WAL");
      const colDefs = columns.map((c, i) => `"${c.name}" ${colTypes[i]}`).join(", ");
      sqlite.exec(`CREATE TABLE "${table}" (${colDefs});`);

      const placeholders = columns.map(() => "?").join(", ");
      const colList = columns.map((c) => `"${c.name}"`).join(", ");
      const insert = sqlite.prepare(
        `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
      );

      const insertMany = sqlite.transaction((batch: ParsedRow[]) => {
        for (const r of batch) {
          const vals = columns.map((c, i) => coerce(r[c.raw], colTypes[i]));
          insert.run(vals);
        }
      });
      insertMany(rows);
    } catch (e) {
      try {
        sqlite.close();
      } catch {
        /* noop */
      }
      await fs.rm(dbPath, { force: true }).catch(() => undefined);
      return fail(`Failed to materialize CSV: ${(e as Error).message}`, 500);
    }
    sqlite.close();

    const nowIso = new Date().toISOString();

    // Register the data source.
    const dataSource = db
      .insert(schema.dataSources)
      .values({
        workspaceId: ctx.workspaceId,
        name,
        type: "csv",
        encryptedConfig: encryptJson({ path: dbPath }),
        status: "connected",
        lastConnectedAt: nowIso,
        lastIntrospectedAt: nowIso,
        createdByUserId: ctx.user.id,
      })
      .returning()
      .get();

    // Introspect the freshly built DB and persist schema metadata.
    const adapter = new SqliteAdapter(dbPath, "csv");
    const introspected = await adapter.introspect();

    let columnCount = 0;
    for (const t of introspected.tables) {
      const tableRow = db
        .insert(schema.dataSourceTables)
        .values({
          dataSourceId: dataSource.id,
          tableName: t.name,
          schemaName: t.schema ?? null,
          rowCountEstimate: t.rowCountEstimate ?? null,
          description: t.description ?? null,
        })
        .returning()
        .get();

      for (const col of t.columns) {
        columnCount += 1;
        db.insert(schema.dataSourceColumns)
          .values({
            tableId: tableRow.id,
            columnName: col.name,
            dataType: col.dataType,
            nullable: col.nullable,
            sampleValuesJson: JSON.stringify(col.sampleValues ?? []),
            semanticType: col.semanticType ?? null,
            description: col.description ?? null,
          })
          .run();
      }
    }

    // Record the uploaded file.
    db.insert(schema.uploadedFiles)
      .values({
        workspaceId: ctx.workspaceId,
        fileName: file.name || name,
        fileType: file.type || "text/csv",
        storageUrl: dbPath,
        parsedTableName: table,
        dataSourceId: dataSource.id,
        uploadedByUserId: ctx.user.id,
      })
      .run();

    return json({
      dataSource,
      table,
      rowCount: rows.length,
      columnCount,
    });
  });
}
