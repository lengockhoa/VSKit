import { describe, it, expect } from "vitest";
import {
  buildTableStructure,
  buildViewStructure,
  quoteIdentIfNeeded,
  buildDatabaseStructure,
} from "../exportStructure";

describe("exportStructure — pure builder", () => {
  it("1. basic table: columns, NOT NULL, PK constraint", () => {
    const ddl = buildTableStructure("public", "users", [
      { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
      { name: "name", dataType: "character varying(100)", nullable: false },
      { name: "created_at", dataType: "timestamp with time zone", nullable: true },
    ]);
    expect(ddl).toBe(
      [
        "CREATE TABLE public.users (",
        "    id integer NOT NULL,",
        "    name character varying(100) NOT NULL,",
        "    created_at timestamp with time zone,",
        "    CONSTRAINT pk_users PRIMARY KEY (id)",
        ");",
      ].join("\n"),
    );
  });

  it("2. no PK → no CONSTRAINT line; all nullable → no NOT NULL", () => {
    const ddl = buildTableStructure("public", "log", [
      { name: "msg", dataType: "text", nullable: true },
    ]);
    expect(ddl).toBe(
      ["CREATE TABLE public.log (", "    msg text", ");"].join("\n"),
    );
  });

  it("3. compound PK → comma-joined inside constraint", () => {
    const ddl = buildTableStructure("s", "t", [
      { name: "a", dataType: "int", nullable: false, isPrimaryKey: true },
      { name: "b", dataType: "int", nullable: false, isPrimaryKey: true },
    ]);
    expect(ddl).toContain("PRIMARY KEY (a, b)");
  });

  it("4. mixed-case / keyword column names → quoted identifiers", () => {
    const ddl = buildTableStructure("public", "Order", [
      { name: "UserId", dataType: "int", nullable: false },
      { name: "select", dataType: "text", nullable: true },
    ]);
    expect(ddl).toContain('"Order"');
    expect(ddl).toContain('"UserId"');
    expect(ddl).toContain('"select"');
  });

  it("5. quoteIdentIfNeeded: plain lowercase stays bare, else double-quoted", () => {
    expect(quoteIdentIfNeeded("user_id")).toBe("user_id");
    expect(quoteIdentIfNeeded("Order")).toBe('"Order"');
    expect(quoteIdentIfNeeded('we"ird')).toBe('"we""ird"');
  });

  it("6. empty schema/table name rejected by caller guard — builder tolerates empty columns", () => {
    const ddl = buildTableStructure("public", "empty", []);
    expect(ddl).toBe(["CREATE TABLE public.empty (", "", ");"].join("\n"));
  });

  it("7. view structure: header + column list + viewdef note", () => {
    const txt = buildViewStructure("public", "v_users", [
      { name: "id", dataType: "integer", nullable: false },
    ]);
    expect(txt).toContain("-- View structure: public.v_users");
    expect(txt).toContain("-- Output columns (1):");
    expect(txt).toContain("    id integer");
    expect(txt).toContain("pg_get_viewdef");
  });
});

// ---- TASK-001 §Test Cases #1, #3 --------------------------------------------

describe("buildDatabaseStructure — full-DB builder", () => {
  // test #1 — 2 schemas, tables + views → header + DDL blocks
  it("test #1 full DB: 2 schemas with tables + views renders header + per-schema DDL", () => {
    const db = {
      schemas: [{ name: "public" }, { name: "sales" }],
      tables: [
        { schema: "public", name: "users" },
        { schema: "public", name: "orders" },
        { schema: "sales", name: "deals" },
      ],
      views: [{ schema: "public", name: "v_active" }],
      columns: {
        "public.users": [
          { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
          { name: "email", dataType: "text", nullable: false },
        ],
        "public.orders": [
          { name: "id", dataType: "bigint", nullable: false, isPrimaryKey: true },
        ],
        "sales.deals": [
          { name: "id", dataType: "uuid", nullable: false, isPrimaryKey: true },
        ],
        "public.v_active": [
          { name: "id", dataType: "integer", nullable: false },
        ],
      },
    };

    const out = buildDatabaseStructure(db);

    expect(out).toContain("-- Database structure (2 schemas, 3 tables, 1 views)");
    expect(out).toContain("-- Schema: public");
    expect(out).toContain("-- Schema: sales");
    expect(out).toContain("CREATE TABLE public.users (");
    expect(out).toContain("CREATE TABLE public.orders (");
    expect(out).toContain("CREATE TABLE sales.deals (");
    expect(out).toContain("-- View structure: public.v_active");
  });

  // test #3 — empty DB
  it("test #3 empty DB → header line only, no schema/table blocks", () => {
    const out = buildDatabaseStructure({
      schemas: [],
      tables: [],
      views: [],
      columns: {},
    });

    expect(out).toBe("-- Database structure (0 schemas, 0 tables, 0 views)");
  });
});

// ---- Full structure export: keys + indexes --------------------------------
import { buildStructureSql, collectStructureSql } from "../exportStructure";
import type { SchemaStructureRows } from "../../core/ddl/pgStructure";

function fixtureRows(): SchemaStructureRows {
  return {
    tables: [
      { oid: 1, relname: "users", relkind: "r", relpersistence: "p", relispartition: false, partkey: null, parent: null, partbound: null, comment: "User's table" },
      { oid: 2, relname: "orders", relkind: "r", relpersistence: "p", relispartition: false, partkey: null, parent: null, partbound: null, comment: null },
    ],
    columns: [
      { oid: 1, attname: "id", type: "bigint", attnotnull: true, def: null, attidentity: "a", attgenerated: "", attislocal: true, comment: null },
      { oid: 1, attname: "email", type: "text", attnotnull: true, def: null, attidentity: "", attgenerated: "", attislocal: true, comment: "login" },
      { oid: 2, attname: "id", type: "integer", attnotnull: true, def: "nextval('app.orders_id_seq'::regclass)", attidentity: "", attgenerated: "", attislocal: true, comment: null },
      { oid: 2, attname: "user_id", type: "bigint", attnotnull: true, def: null, attidentity: "", attgenerated: "", attislocal: true, comment: null },
    ],
    constraints: [
      { oid: 1, conname: "users_pkey", contype: "p", def: "PRIMARY KEY (id)", ref_display: null, ref_qualified: null },
      { oid: 1, conname: "users_email_key", contype: "u", def: "UNIQUE (email)", ref_display: null, ref_qualified: null },
      { oid: 2, conname: "orders_pkey", contype: "p", def: "PRIMARY KEY (id)", ref_display: null, ref_qualified: null },
      { oid: 2, conname: "orders_user_id_fkey", contype: "f", def: "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE", ref_display: "users", ref_qualified: "app.users" },
    ],
    indexes: [
      { oid: 2, indexname: "orders_user_idx", def: "CREATE INDEX orders_user_idx ON app.orders USING btree (user_id)", comment: null },
    ],
    sequences: [
      { seqname: "orders_id_seq", type: "integer", seqstart: "1", seqincrement: "1", seqmin: "1", seqmax: "2147483647", seqcache: "1", seqcycle: false, owner_table: "orders", owner_column: "id" },
    ],
  };
}

describe("buildStructureSql — keys + indexes", () => {
  it("emits PK/UNIQUE inline, indexes, identity, comments, FKs last with qualified ref", () => {
    const r = buildStructureSql([{ schema: "app", rows: fixtureRows() }], "t");
    const sql = r.sql;
    expect(r.tables).toBe(2);
    expect(r.indexes).toBe(1);
    expect(r.foreignKeys).toBe(1);
    expect(sql).toContain("    id bigint GENERATED ALWAYS AS IDENTITY,");
    expect(sql).toContain("    CONSTRAINT users_pkey PRIMARY KEY (id)");
    expect(sql).toContain("    CONSTRAINT users_email_key UNIQUE (email)");
    expect(sql).toContain("CREATE INDEX orders_user_idx ON app.orders USING btree (user_id);");
    expect(sql).toContain("COMMENT ON TABLE app.users IS 'User''s table';");
    expect(sql).toContain("COMMENT ON COLUMN app.users.email IS 'login';");
    expect(sql).toContain(
      "ALTER TABLE app.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;",
    );
    expect(sql).toContain("ALTER SEQUENCE app.orders_id_seq OWNED BY app.orders.id;");
    // Dependency order: sequence before tables, FKs after every CREATE TABLE.
    expect(sql.indexOf("CREATE SEQUENCE")).toBeLessThan(sql.indexOf("CREATE TABLE"));
    expect(sql.indexOf("FOREIGN KEY")).toBeGreaterThan(sql.lastIndexOf("CREATE TABLE"));
  });

  it("table filter keeps only listed tables and their owned sequences", () => {
    const r = buildStructureSql([{ schema: "app", rows: fixtureRows(), tables: ["users"] }], "t");
    expect(r.tables).toBe(1);
    expect(r.sql).not.toContain("CREATE TABLE app.orders");
    expect(r.sql).not.toContain("orders_id_seq");
    expect(r.foreignKeys).toBe(0);
  });

  it("partitioned parent index drops ON ONLY; partition rendered as PARTITION OF", () => {
    const rows: SchemaStructureRows = {
      tables: [
        { oid: 10, relname: "events", relkind: "p", relpersistence: "p", relispartition: false, partkey: "RANGE (at)", parent: null, partbound: null, comment: null },
        { oid: 11, relname: "events_2026", relkind: "r", relpersistence: "p", relispartition: true, partkey: null, parent: "app.events", partbound: "FOR VALUES FROM ('2026-01-01') TO ('2027-01-01')", comment: null },
      ],
      columns: [
        { oid: 10, attname: "at", type: "date", attnotnull: true, def: null, attidentity: "", attgenerated: "", attislocal: true, comment: null },
        { oid: 11, attname: "at", type: "date", attnotnull: true, def: null, attidentity: "", attgenerated: "", attislocal: false, comment: null },
      ],
      constraints: [],
      indexes: [{ oid: 10, indexname: "events_at_idx", def: "CREATE INDEX events_at_idx ON ONLY app.events USING btree (at)", comment: null }],
      sequences: [],
    };
    const sql = buildStructureSql([{ schema: "app", rows }], "t").sql;
    expect(sql).toContain(") PARTITION BY RANGE (at);");
    expect(sql).toContain("CREATE INDEX events_at_idx ON app.events USING btree (at);");
    expect(sql).toContain(
      "CREATE TABLE app.events_2026 PARTITION OF app.events FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');",
    );
  });

  it("collectStructureSql → null when adapter lacks catalog.schemaStructure", async () => {
    const adapter = { listViews: async () => [] } as never;
    expect(await collectStructureSql(adapter, { schemas: ["app"], includeViews: false, title: "t" })).toBeNull();
  });

  it("collectStructureSql renders view definitions via objectDdl", async () => {
    const adapter = {
      listViews: async () => [{ name: "v", schema: "app" }],
      listColumns: async () => [],
      catalog: {
        schemaStructure: async () => fixtureRows(),
        objectDdl: async () => " SELECT 1;",
      },
    } as never;
    const r = await collectStructureSql(adapter, { schemas: ["app"], includeViews: true, title: "t" });
    expect(r!.sql).toContain("CREATE OR REPLACE VIEW app.v AS\nSELECT 1;");
    expect(r!.views).toBe(1);
  });
});
