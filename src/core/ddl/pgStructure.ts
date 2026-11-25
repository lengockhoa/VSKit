// src/core/ddl/pgStructure.ts
//
// Bulk, schema-level pg_catalog introspection for "Export Structure".
// Pure SQL constants + row types — NO vscode / pg imports. The PostgresAdapter
// runs each query with params [$1 = schema, $2 = text[] table filter | null]
// and the renderer (src/ui/exportStructure.ts → buildSchemaStructureSql)
// turns the rows into migration-ready DDL: columns (default / identity /
// generated), PK / UNIQUE / CHECK / EXCLUDE / FOREIGN KEY constraints, every
// non-constraint index (any method, partial, expression), sequences,
// partitions and comments.
//
// One query per object kind per schema (not per table) so exporting a schema
// with hundreds of tables stays at 5 round-trips.
//
// Params: tables/columns/constraints/indexes take [$1 = schema,
// $2 = text[] | null]; sequences take [$1 = schema].

/** Table filter shared by every query: `$2` NULL → whole schema. */
const TABLE_FILTER = `($2::text[] IS NULL OR c.relname = ANY($2::text[]))`;

export interface StructureTableRow {
  oid: string | number;
  relname: string;
  /** 'r' ordinary, 'p' partitioned. */
  relkind: string;
  /** 'p' permanent, 'u' unlogged. */
  relpersistence: string;
  relispartition: boolean;
  /** pg_get_partkeydef for partitioned tables (e.g. "RANGE (created_at)"). */
  partkey: string | null;
  /** Qualified parent for partitions ("public.events"). */
  parent: string | null;
  /** pg_get_expr(relpartbound) for partitions ("FOR VALUES FROM (...) TO (...)"). */
  partbound: string | null;
  comment: string | null;
}

export interface StructureColumnRow {
  oid: string | number;
  attname: string;
  type: string;
  attnotnull: boolean;
  /** Default expression, or the generation expression when attgenerated='s'. */
  def: string | null;
  /** '' | 'a' (ALWAYS) | 'd' (BY DEFAULT). */
  attidentity: string;
  /** '' | 's' (STORED). */
  attgenerated: string;
  /** false → inherited (partition child); renderer skips it. */
  attislocal: boolean;
  comment: string | null;
}

export interface StructureConstraintRow {
  oid: string | number;
  conname: string;
  /** 'p' | 'u' | 'f' | 'c' | 'x' */
  contype: string;
  /** pg_get_constraintdef(oid) — e.g. "FOREIGN KEY (a) REFERENCES t(id) ON DELETE CASCADE". */
  def: string;
  /** FK only: confrelid::regclass::text (search_path dependent display form). */
  ref_display: string | null;
  /** FK only: always schema-qualified referenced table. */
  ref_qualified: string | null;
}

export interface StructureIndexRow {
  oid: string | number;
  indexname: string;
  /** pg_get_indexdef — full CREATE [UNIQUE] INDEX … ON schema.table USING … */
  def: string;
  comment: string | null;
}

export interface StructureSequenceRow {
  seqname: string;
  type: string;
  seqstart: string;
  seqincrement: string;
  seqmin: string;
  seqmax: string;
  seqcache: string;
  seqcycle: boolean;
  owner_table: string | null;
  owner_column: string | null;
}

export interface SchemaStructureRows {
  tables: StructureTableRow[];
  columns: StructureColumnRow[];
  constraints: StructureConstraintRow[];
  indexes: StructureIndexRow[];
  sequences: StructureSequenceRow[];
}

export const STRUCTURE_TABLES_SQL = `
  SELECT c.oid::bigint AS oid,
         c.relname,
         c.relkind::text AS relkind,
         c.relpersistence::text AS relpersistence,
         c.relispartition,
         CASE WHEN c.relkind = 'p' THEN pg_get_partkeydef(c.oid) END AS partkey,
         CASE WHEN c.relispartition THEN (
           SELECT quote_ident(pn.nspname) || '.' || quote_ident(pc.relname)
             FROM pg_inherits inh
             JOIN pg_class pc ON pc.oid = inh.inhparent
             JOIN pg_namespace pn ON pn.oid = pc.relnamespace
            WHERE inh.inhrelid = c.oid
            LIMIT 1
         ) END AS parent,
         CASE WHEN c.relispartition THEN pg_get_expr(c.relpartbound, c.oid) END AS partbound,
         obj_description(c.oid, 'pg_class') AS comment
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = $1
     AND c.relkind IN ('r', 'p')
     AND ${TABLE_FILTER}
   ORDER BY c.relispartition, c.relname
`;

export const STRUCTURE_COLUMNS_SQL = `
  SELECT a.attrelid::bigint AS oid,
         a.attname,
         pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
         a.attnotnull,
         pg_get_expr(ad.adbin, ad.adrelid) AS def,
         a.attidentity::text AS attidentity,
         a.attgenerated::text AS attgenerated,
         a.attislocal,
         col_description(a.attrelid, a.attnum) AS comment
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad
      ON ad.adrelid = a.attrelid
     AND ad.adnum = a.attnum
   WHERE n.nspname = $1
     AND c.relkind IN ('r', 'p')
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND ${TABLE_FILTER}
   ORDER BY a.attrelid, a.attnum
`;

export const STRUCTURE_CONSTRAINTS_SQL = `
  SELECT con.conrelid::bigint AS oid,
         con.conname,
         con.contype::text AS contype,
         pg_get_constraintdef(con.oid) AS def,
         CASE WHEN con.contype = 'f' THEN con.confrelid::regclass::text END AS ref_display,
         CASE WHEN con.contype = 'f'
              THEN quote_ident(fn.nspname) || '.' || quote_ident(fc.relname)
         END AS ref_qualified
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_class fc ON fc.oid = con.confrelid
    LEFT JOIN pg_namespace fn ON fn.oid = fc.relnamespace
   WHERE n.nspname = $1
     AND c.relkind IN ('r', 'p')
     AND con.contype IN ('p', 'u', 'f', 'c', 'x')
     AND con.conislocal
     AND ${TABLE_FILTER}
   ORDER BY con.conrelid,
            CASE con.contype
              WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'x' THEN 2
              WHEN 'c' THEN 3 ELSE 4
            END,
            con.conname
`;

/**
 * Indexes NOT backing a PK / UNIQUE / EXCLUDE constraint of the same table
 * (those are emitted as constraints) and NOT auto-attached partition children
 * of a parent partitioned index (the parent index recreates them).
 */
export const STRUCTURE_INDEXES_SQL = `
  SELECT i.indrelid::bigint AS oid,
         ic.relname AS indexname,
         pg_get_indexdef(i.indexrelid) AS def,
         obj_description(i.indexrelid, 'pg_class') AS comment
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = $1
     AND c.relkind IN ('r', 'p')
     AND ${TABLE_FILTER}
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint con
        WHERE con.conindid = i.indexrelid
          AND con.conrelid = i.indrelid
          AND con.contype IN ('p', 'u', 'x')
     )
     AND NOT EXISTS (
       SELECT 1 FROM pg_inherits inh WHERE inh.inhrelid = i.indexrelid
     )
   ORDER BY c.relname, ic.relname
`;

/**
 * Sequences of the schema, minus identity sequences (recreated by
 * GENERATED … AS IDENTITY). Owned-by info lets the renderer emit
 * ALTER SEQUENCE … OWNED BY and filter to the exported tables.
 * Params: [$1 = schema] only — table filtering happens in the renderer via
 * owner_table.
 */
export const STRUCTURE_SEQUENCES_SQL = `
  SELECT c.relname AS seqname,
         pg_catalog.format_type(s.seqtypid, NULL) AS type,
         s.seqstart::text AS seqstart,
         s.seqincrement::text AS seqincrement,
         s.seqmin::text AS seqmin,
         s.seqmax::text AS seqmax,
         s.seqcache::text AS seqcache,
         s.seqcycle,
         oc.relname AS owner_table,
         oa.attname AS owner_column
    FROM pg_sequence s
    JOIN pg_class c ON c.oid = s.seqrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_depend d
      ON d.objid = c.oid
     AND d.classid = 'pg_class'::regclass
     AND d.refclassid = 'pg_class'::regclass
     AND d.deptype IN ('a', 'i')
    LEFT JOIN pg_class oc ON oc.oid = d.refobjid
    LEFT JOIN pg_attribute oa
      ON oa.attrelid = d.refobjid
     AND oa.attnum = d.refobjsubid
   WHERE n.nspname = $1
     AND (d.deptype IS NULL OR d.deptype = 'a')
   ORDER BY c.relname
`;
