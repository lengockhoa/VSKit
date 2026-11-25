// src/ui/exportStructure.ts
// Export Structure — render CREATE TABLE DDL string cho table/view node,
// copy vào clipboard (pattern TASK-008 postmanPayload: pure builder + command
// trong tableCommands + context menu table/view).
//
// Nguồn dữ liệu: adapter.listColumns (name/dataType/nullable/isPrimaryKey).
// PK đánh dấu qua column_default không có → dùng ColumnInfo.isPrimaryKey trên
// mỗi cột; nếu ≥1 cột có isPrimaryKey thì emit CONSTRAINT ... PRIMARY KEY (...)
// dòng cuối, else mỗi cột NOT NULL giữ nguyên nullable flag.

import type { DbAdapter } from "../adapters/types";
import type {
  SchemaStructureRows,
  StructureColumnRow,
  StructureConstraintRow,
  StructureTableRow,
} from "../core/ddl/pgStructure";

/** Escape ' inside COMMENT-style string literals. */
function sqlLiteral(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * Reserved keywords phải quote kể cả khi toàn chữ thường (SELECT, ORDER...).
 * Tối thiểu theo PGreserved thông dụng — đủ cho DDL emit an toàn.
 */
const SQL_RESERVED: Record<string, true> = {
  select: true, from: true, where: true, order: true, group: true, having: true,
  limit: true, offset: true, insert: true, update: true, delete: true,
  table: true, view: true, index: true, primary: true, foreign: true,
  references: true, constraint: true, default: true, null: true, true: true,
  false: true, not: true, and: true, or: true, in: true, is: true, as: true,
  on: true, join: true, inner: true, left: true, right: true, outer: true,
  full: true, cross: true, union: true, all: true, distinct: true, case: true,
  when: true, then: true, else: true, end: true, create: true, drop: true,
  alter: true, add: true, column: true, check: true, unique: true, values: true,
  into: true, set: true, user: true, grant: true, revoke: true, begin: true,
  commit: true, rollback: true, with: true, recursive: true, using: true,
  cast: true, collate: true, desc: true, asc: true, between: true, exists: true,
};

/** Quote identifier khi không phải chữ thường thường gặp [a-z_][a-z0-9_]*. */
export function quoteIdentIfNeeded(name: string): string {
  if (SQL_RESERVED[name]) return `"${name.replace(/"/g, '""')}"`;
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

export interface ExportColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
}

/**
 * Build CREATE TABLE DDL cho bảng (thuần data → string, không I/O).
 * View node: chỉ trả header CREATE VIEW ... AS SELECT ...; -- columns list
 * (definition column không có trong ColumnInfo — ghi chú estruct limitation).
 */
export function buildTableStructure(
  schema: string,
  table: string,
  columns: ExportColumn[],
): string {
  const q = quoteIdentIfNeeded;
  const lines: string[] = [`CREATE TABLE ${q(schema)}.${q(table)} (`];
  const body = columns.map((c) => {
    let line = `    ${q(c.name)} ${c.dataType}`;
    if (!c.nullable) line += " NOT NULL";
    return line;
  });
  const pk = columns.filter((c) => c.isPrimaryKey).map((c) => q(c.name));
  if (pk.length > 0) {
    body.push(`    CONSTRAINT ${q(`pk_${table}`)} PRIMARY KEY (${pk.join(", ")})`);
  }
  lines.push(body.join(",\n"));
  lines.push(");");
  return lines.join("\n");
}

/** Build structure text cho view node (column list + note). */
export function buildViewStructure(
  schema: string,
  view: string,
  columns: ExportColumn[],
): string {
  const q = quoteIdentIfNeeded;
  const cols = columns.map((c) => `    ${q(c.name)} ${c.dataType}`).join(",\n");
  return [
    `-- View structure: ${q(schema)}.${q(view)}`,
    `-- Output columns (${columns.length}):`,
    cols,
    `-- CREATE VIEW definition requires pg_get_viewdef — not in ColumnInfo.`,
  ].join("\n");
}

/** Input shape cho buildDatabaseStructure — agent tool builds from adapter results. */
export interface DatabaseStructureInput {
  schemas: Array<{ name: string }>;
  tables: Array<{ schema: string; name: string }>;
  views: Array<{ schema: string; name: string }>;
  /** Key "schema.table" → column list cho table/view. Missing key → empty columns. */
  columns: Record<string, ExportColumn[]>;
}

/**
 * Render full-DB DDL text từ introspection results.
 * Pure, deterministic. Empty DB → header only, không schema/table blocks.
 * Blocks cách nhau bằng 1 blank line; trailing blanks stripped.
 */
export function buildDatabaseStructure(db: DatabaseStructureInput): string {
  const header = `-- Database structure (${db.schemas.length} schemas, ${db.tables.length} tables, ${db.views.length} views)`;
  if (db.schemas.length === 0) return header;

  const blocks: string[] = [];
  for (const s of db.schemas) {
    blocks.push(`-- Schema: ${s.name}`);
    for (const t of db.tables.filter((x) => x.schema === s.name)) {
      const key = `${t.schema}.${t.name}`;
      blocks.push(buildTableStructure(t.schema, t.name, db.columns[key] ?? []));
      blocks.push("");
    }
    for (const v of db.views.filter((x) => x.schema === s.name)) {
      const key = `${v.schema}.${v.name}`;
      blocks.push(buildViewStructure(v.schema, v.name, db.columns[key] ?? []));
      blocks.push("");
    }
  }

  while (blocks.length > 0 && blocks[blocks.length - 1] === "") blocks.pop();
  return [header, ...blocks].join("\n");
}

export { sqlLiteral };

// =============================================================================
// Full structure export (keys + indexes) — migration-ready PostgreSQL DDL.
// Rows come from CatalogApi.schemaStructure (src/core/ddl/pgStructure.ts).
// Order inside the document is dependency-safe so it can be replayed:
//   CREATE SCHEMA → sequences → tables (cols + PK/UQ/CHECK/EXCLUDE) →
//   partitions → indexes → comments → sequence OWNED BY → FOREIGN KEYs (all
//   tables exist by then) → views.
// =============================================================================

export interface SchemaStructureSection {
  schema: string;
  rows: SchemaStructureRows;
  /** Restrict to these tables (sequences filtered by owner table). */
  tables?: readonly string[];
  views?: Array<{ name: string; definition: string | null; columns: ExportColumn[] }>;
}

export interface StructureSqlResult {
  sql: string;
  tables: number;
  views: number;
  indexes: number;
  foreignKeys: number;
}

function qn(schema: string, name: string): string {
  return `${quoteIdentIfNeeded(schema)}.${quoteIdentIfNeeded(name)}`;
}

function commentLiteral(s: string): string {
  return `'${sqlLiteral(s)}'`;
}

function renderColumn(c: StructureColumnRow): string {
  let line = `    ${quoteIdentIfNeeded(c.attname)} ${c.type}`;
  if (c.attgenerated === "s" && c.def) {
    line += ` GENERATED ALWAYS AS (${c.def}) STORED`;
  } else if (c.attidentity === "a") {
    line += " GENERATED ALWAYS AS IDENTITY";
  } else if (c.attidentity === "d") {
    line += " GENERATED BY DEFAULT AS IDENTITY";
  } else if (c.def) {
    line += ` DEFAULT ${c.def}`;
  }
  if (c.attnotnull && c.attidentity === "") line += " NOT NULL";
  return line;
}

/** FK def with the referenced table always schema-qualified. */
function qualifyFkDef(k: StructureConstraintRow): string {
  if (!k.ref_display || !k.ref_qualified) return k.def;
  const needle = `REFERENCES ${k.ref_display}(`;
  const idx = k.def.indexOf(needle);
  if (idx < 0) return k.def;
  return (
    k.def.slice(0, idx) +
    `REFERENCES ${k.ref_qualified}(` +
    k.def.slice(idx + needle.length)
  );
}

function sameKey(a: string | number, b: string | number): boolean {
  return String(a) === String(b);
}

/** Render one schema section; FK statements are returned separately. */
function renderSchemaSection(sec: SchemaStructureSection): {
  body: string[];
  foreignKeys: string[];
  ownership: string[];
  views: string[];
  tableCount: number;
  indexCount: number;
} {
  const { schema, rows } = sec;
  const filter = sec.tables && sec.tables.length > 0 ? new Set(sec.tables) : null;
  const tables = rows.tables.filter((t) => !filter || filter.has(t.relname));
  const tableNames = new Set(tables.map((t) => t.relname));
  const body: string[] = [];
  const foreignKeys: string[] = [];
  const ownership: string[] = [];
  const comments: string[] = [];
  let indexCount = 0;

  body.push(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentIfNeeded(schema)};`, "");

  const sequences = rows.sequences.filter(
    (s) => !filter || (s.owner_table !== null && tableNames.has(s.owner_table)),
  );
  if (sequences.length > 0) {
    body.push("-- Sequences");
    for (const s of sequences) {
      body.push(
        `CREATE SEQUENCE IF NOT EXISTS ${qn(schema, s.seqname)} AS ${s.type}` +
          ` INCREMENT BY ${s.seqincrement} MINVALUE ${s.seqmin} MAXVALUE ${s.seqmax}` +
          ` START WITH ${s.seqstart} CACHE ${s.seqcache}${s.seqcycle ? " CYCLE" : ""};`,
      );
      if (s.owner_table && s.owner_column && tableNames.has(s.owner_table)) {
        ownership.push(
          `ALTER SEQUENCE ${qn(schema, s.seqname)} OWNED BY ${qn(schema, s.owner_table)}.${quoteIdentIfNeeded(s.owner_column)};`,
        );
      }
    }
    body.push("");
  }

  const renderTable = (t: StructureTableRow): void => {
    const name = qn(schema, t.relname);
    const cols = rows.columns.filter((c) => sameKey(c.oid, t.oid) && c.attislocal);
    const cons = rows.constraints.filter((k) => sameKey(k.oid, t.oid));
    const inline = cons.filter((k) => k.contype !== "f");
    const fks = cons.filter((k) => k.contype === "f");
    const idx = rows.indexes.filter((i) => sameKey(i.oid, t.oid));
    const unlogged = t.relpersistence === "u" ? "UNLOGGED " : "";

    body.push(`-- Table: ${name}`);
    if (t.relispartition && t.parent) {
      body.push(
        `CREATE ${unlogged}TABLE ${name} PARTITION OF ${t.parent} ${t.partbound ?? "DEFAULT"};`,
      );
      for (const k of inline) {
        body.push(`ALTER TABLE ${name} ADD CONSTRAINT ${quoteIdentIfNeeded(k.conname)} ${k.def};`);
      }
    } else {
      const lines = cols.map(renderColumn);
      for (const k of inline) {
        lines.push(`    CONSTRAINT ${quoteIdentIfNeeded(k.conname)} ${k.def}`);
      }
      const partition = t.relkind === "p" && t.partkey ? ` PARTITION BY ${t.partkey}` : "";
      body.push(`CREATE ${unlogged}TABLE ${name} (`, lines.join(",\n"), `)${partition};`);
    }
    for (const i of idx) {
      // Partition-child indexes are omitted, so a parent index must cascade
      // on replay: "ON ONLY" would leave it invalid/unattached.
      const def = t.relkind === "p" ? i.def.replace(/ ON ONLY /, " ON ") : i.def;
      body.push(`${def};`);
      indexCount += 1;
      if (i.comment) {
        comments.push(`COMMENT ON INDEX ${qn(schema, i.indexname)} IS ${commentLiteral(i.comment)};`);
      }
    }
    body.push("");
    if (t.comment) comments.push(`COMMENT ON TABLE ${name} IS ${commentLiteral(t.comment)};`);
    for (const c of cols) {
      if (c.comment) {
        comments.push(
          `COMMENT ON COLUMN ${name}.${quoteIdentIfNeeded(c.attname)} IS ${commentLiteral(c.comment)};`,
        );
      }
    }
    for (const k of fks) {
      foreignKeys.push(
        `ALTER TABLE ${name} ADD CONSTRAINT ${quoteIdentIfNeeded(k.conname)} ${qualifyFkDef(k)};`,
      );
    }
  };

  // Parents (non-partitions) first, then partitions — SQL orders by relispartition.
  for (const t of tables) renderTable(t);

  if (comments.length > 0) body.push("-- Comments", ...comments, "");

  const views: string[] = [];
  for (const v of sec.views ?? []) {
    if (v.definition) {
      views.push(
        `CREATE OR REPLACE VIEW ${qn(schema, v.name)} AS\n${v.definition.trim().replace(/;\s*$/, "")};`,
        "",
      );
    } else {
      views.push(buildViewStructure(schema, v.name, v.columns), "");
    }
  }

  return { body, foreignKeys, ownership, views, tableCount: tables.length, indexCount };
}

/**
 * Render migration-ready DDL for one or more schemas. Pure + deterministic.
 * Foreign keys are emitted after every table (ALTER TABLE … ADD CONSTRAINT)
 * so cross-table / cross-schema references replay in any order.
 */
export function buildStructureSql(
  sections: SchemaStructureSection[],
  title: string,
): StructureSqlResult {
  const parts = sections.map(renderSchemaSection);
  const tables = parts.reduce((n, p) => n + p.tableCount, 0);
  const indexes = parts.reduce((n, p) => n + p.indexCount, 0);
  const fks = parts.flatMap((p) => p.foreignKeys);
  const ownership = parts.flatMap((p) => p.ownership);
  const viewCount = sections.reduce((n, s) => n + (s.views?.length ?? 0), 0);

  const out: string[] = [
    `-- VSKit structure export: ${title}`,
    `-- PostgreSQL DDL — ${sections.length} schema(s), ${tables} table(s), ${indexes} index(es), ${fks.length} foreign key(s), ${viewCount} view(s)`,
    `-- Order: schemas → sequences → tables (PK/UNIQUE/CHECK) → indexes → comments → sequence ownership → foreign keys → views`,
    "",
  ];
  for (let i = 0; i < sections.length; i++) {
    out.push(`-- ==================== Schema: ${sections[i].schema} ====================`);
    out.push(...parts[i].body);
  }
  if (ownership.length > 0) out.push("-- Sequence ownership", ...ownership, "");
  if (fks.length > 0) out.push("-- Foreign keys", ...fks, "");
  const viewLines = parts.flatMap((p) => p.views);
  if (viewLines.length > 0) out.push("-- Views", ...viewLines);

  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return {
    sql: out.join("\n") + "\n",
    tables,
    views: viewCount,
    indexes,
    foreignKeys: fks.length,
  };
}

export interface CollectStructureScope {
  /** Schemas to export (in order). */
  schemas: string[];
  /** Only these tables (meaningful with a single schema). */
  tables?: readonly string[];
  includeViews: boolean;
  title: string;
}

/**
 * Introspect via `adapter.catalog.schemaStructure` and render full DDL.
 * Returns null when the adapter does not expose the bulk API (callers keep
 * their column-only fallback). View definitions via catalog.objectDdl; a view
 * whose definition cannot be read falls back to its column list.
 */
export async function collectStructureSql(
  adapter: DbAdapter,
  scope: CollectStructureScope,
): Promise<StructureSqlResult | null> {
  const catalog = adapter.catalog;
  if (!catalog || typeof catalog.schemaStructure !== "function") return null;
  const sections: SchemaStructureSection[] = [];
  for (const schema of scope.schemas) {
    const rows = await catalog.schemaStructure(schema, scope.tables);
    const section: SchemaStructureSection = { schema, rows, tables: scope.tables };
    if (scope.includeViews) {
      section.views = [];
      for (const v of await adapter.listViews(schema)) {
        let definition: string | null = null;
        try {
          definition = await catalog.objectDdl("view", v.name, schema);
        } catch {
          definition = null;
        }
        let columns: ExportColumn[] = [];
        if (definition === null) {
          try {
            columns = (await adapter.listColumns(v.name, schema)).map((c) => ({
              name: c.name,
              dataType: c.dataType,
              nullable: c.nullable,
            }));
          } catch {
            columns = [];
          }
        }
        section.views.push({ name: v.name, definition, columns });
      }
    }
    sections.push(section);
  }
  return buildStructureSql(sections, scope.title);
}
