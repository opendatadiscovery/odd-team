import { type APIRequestContext, expect } from '@playwright/test';
import { Client } from 'pg';

/**
 * Lookup Tables / Reference Data Management (pillar P-03) e2e helpers.
 *
 * Used by IT-048 (F-059 rename cascade), IT-049 (F-058 listing UI), IT-050 (F-026 RDM).
 * This file is ADDITIVE and imported ONLY by those three specs — it never edits the
 * shared db.ts/ingest.ts (the lead reconciles those). It owns its OWN pg connection (same
 * stable connection string as db.ts) rather than importing db.ts internals, so this lane is
 * fully self-contained and immune to any concurrent reconciliation of db.ts's exports.
 *
 * VERIFIED GROUND TRUTH (live probes against the running stack, 2026-06-07):
 *  - A lookup table is created by the REAL API: POST /api/referencedata/table
 *    {name, namespace_name[, description]} -> 200, returns LookupTable
 *    {table_id, dataset_id, name, namespace:{id,name}, fields:[{id col}], ...}.
 *    The NAMESPACE MUST PRE-EXIST (ReferenceDataServiceImpl.createLookupTable resolves
 *    namespaceRepository.getByName -> Mono.empty() short-circuits silently if absent),
 *    so we seed the namespace row first via the same Postgres the platform uses.
 *  - The physical reference table is a REAL Postgres table in schema lookup_tables_schema,
 *    named  n_{namespaceId}__{name.toLowerCase().replace(' ','_')}
 *    (ReferenceDataServiceImpl.buildTableName:191-194). The catalog-side lookup_tables row
 *    carries name + the physical table_name. Both live in the SAME database in the default
 *    config (customConnectionPool falls back to the primary datasource + ?schema=
 *    lookup_tables_schema — R2DBCConfiguration.java:54-119), so we read the physical table
 *    over the SAME pg connection by schema-qualifying.
 *  - The create flow ALSO populates lookup_tables_search_entrypoint.search_vector, so a new
 *    table is immediately visible via the UI's search-session flow (POST /search ->
 *    GET /search/{id}/results) and via a query-string search. (Verified: has_vec=true.)
 *
 * COLLISION-FREE: lookup table ids are DB-serial (auto-assigned), so we never hardcode them —
 * we read table_id back from the create response. Every created NAME is prefixed it<NNN>_ and
 * every namespace is it<NNN>_-scoped; setup() deletes prior rows by that prefix (idempotent).
 */

export const SCHEMA = 'lookup_tables_schema';

// Same ground-truth Postgres the platform + db.ts use (the stable connection contract). We open
// our own short-lived Client so this lane never depends on db.ts's (concurrently-edited) exports.
const CONN =
  process.env.ODD_DB_URL ??
  'postgresql://odd-platform:odd-platform-password@localhost:15432/odd-platform';

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: CONN });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export interface LookupTable {
  table_id: number;
  dataset_id: number;
  name: string;
  description?: string;
  namespace?: { id: number; name: string };
  fields: Array<{
    field_id: number;
    name: string;
    field_type: string;
    is_primary_key: boolean;
    is_nullable: boolean;
    is_unique: boolean;
    default_value?: string | null;
  }>;
}

/** Ensure a namespace row exists (create requires it). Returns its id. Idempotent. */
export async function ensureNamespace(name: string): Promise<number> {
  return withClient(async (c) => {
    const sel = await c.query('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [name]);
    if (sel.rows[0]) return Number(sel.rows[0].id);
    return Number((await c.query('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [name])).rows[0].id);
  });
}

/**
 * Idempotent cleanup of every lookup table whose name starts with `namePrefix` — drops the
 * physical table + sequences (best-effort) and lets DELETE /table/{id} unwind the catalog +
 * search-entrypoint + DataEntity. Run in setup so a spec is re-runnable against the shared,
 * external (ODD_STACK_EXTERNAL) stack without leaking n_*_ tables into lookup_tables_schema.
 */
export async function cleanupLookupTablesByPrefix(
  request: APIRequestContext,
  namePrefix: string,
): Promise<void> {
  const ids = await withClient(async (c) => {
    const r = await c.query('SELECT id FROM lookup_tables WHERE name LIKE $1', [`${namePrefix}%`]);
    return r.rows.map((row) => Number(row.id));
  });
  for (const id of ids) {
    // The service-orchestrated delete drops the physical table + sequences + catalog row.
    await request.delete(`/api/referencedata/table/${id}`);
  }
}

/** Create a lookup table via the REAL API. Asserts 200 + returns the parsed LookupTable. */
export async function createLookupTable(
  request: APIRequestContext,
  body: { name: string; namespace_name: string; description?: string },
): Promise<LookupTable> {
  const res = await request.post('/api/referencedata/table', {
    headers: { 'content-type': 'application/json' },
    data: body,
  });
  expect(res.status(), `create lookup table "${body.name}" must return 200`).toBe(200);
  return (await res.json()) as LookupTable;
}

/** Add columns to a lookup table via the REAL API (POST .../columns, array body). */
export async function addColumns(
  request: APIRequestContext,
  tableId: number,
  columns: Array<{
    name: string;
    field_type: string;
    is_nullable?: boolean;
    is_unique?: boolean;
    default_value?: string;
  }>,
): Promise<{ status: number; body: LookupTable }> {
  const res = await request.post(`/api/referencedata/table/${tableId}/columns`, {
    headers: { 'content-type': 'application/json' },
    data: columns,
  });
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as LookupTable };
}

/**
 * Add rows via the REAL API (POST .../data, array of {items:[{field_id,value}]}).
 * Returns status + the row list the server echoes back.
 */
export async function addRows(
  request: APIRequestContext,
  tableId: number,
  rows: Array<Array<{ field_id: number; value: string }>>,
): Promise<{ status: number; body: { items?: Array<{ row_id: number; items: Array<{ field_id: number; value: string }> }> } }> {
  const res = await request.post(`/api/referencedata/table/${tableId}/data`, {
    headers: { 'content-type': 'application/json' },
    data: rows.map((items) => ({ items })),
  });
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as never };
}

/** Read the catalog-side row (public.lookup_tables) — the metadata + physical table_name. */
export async function catalogRow(
  tableId: number,
): Promise<{ name: string; table_name: string; namespace_id: number | null; data_entity_id: number | null } | null> {
  return withClient(async (c) => {
    const r = await c.query(
      'SELECT name, table_name, namespace_id, data_entity_id FROM lookup_tables WHERE id = $1',
      [tableId],
    );
    if (!r.rows[0]) return null;
    return {
      name: String(r.rows[0].name),
      table_name: String(r.rows[0].table_name),
      namespace_id: r.rows[0].namespace_id == null ? null : Number(r.rows[0].namespace_id),
      data_entity_id: r.rows[0].data_entity_id == null ? null : Number(r.rows[0].data_entity_id),
    };
  });
}

/** Escape-hatch: run a read query against the ground-truth Postgres and return the rows. */
export async function dbRows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return withClient(async (c) => (await c.query(sql, params)).rows as T[]);
}

/** Does the physical reference table exist in lookup_tables_schema? (ground-truth DDL check). */
export async function physicalTableExists(physicalName: string): Promise<boolean> {
  return withClient(async (c) => {
    const r = await c.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, physicalName],
    );
    return r.rows.length > 0;
  });
}

/** Read all rows out of the PHYSICAL reference table (downstream-BI's SQL-joinable view). */
export async function physicalTableRowCount(physicalName: string): Promise<number> {
  return withClient(async (c) => {
    // physicalName is server-generated (n_{nsId}__{slug}) — schema+table are quoted via format.
    const r = await c.query(`SELECT count(*)::int AS n FROM ${SCHEMA}."${physicalName}"`);
    return Number(r.rows[0].n);
  });
}

/** The physical column names of a reference table (verifies the DDL CREATE/ALTER actually ran). */
export async function physicalColumns(physicalName: string): Promise<string[]> {
  return withClient(async (c) => {
    const r = await c.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [SCHEMA, physicalName],
    );
    return r.rows.map((row) => String(row.column_name));
  });
}

/**
 * Drive the UI's reference-data search flow exactly as LookupTables.tsx does:
 * POST /search {query} -> {search_id} ; GET /search/{id}/results -> the rendered list.
 * Returns the table_id+name+namespace of each result row (and the facet total).
 */
export async function searchLookupTables(
  request: APIRequestContext,
  query: string,
): Promise<{ total: number; items: Array<{ table_id: number; name: string; namespace?: string }> }> {
  const s = await request.post('/api/referencedata/search', {
    headers: { 'content-type': 'application/json' },
    data: { query },
  });
  expect(s.status(), 'create reference-data search session -> 200').toBe(200);
  const session = (await s.json()) as { search_id: string; total: number };
  const r = await request.get(`/api/referencedata/search/${session.search_id}/results?page=1&size=30`);
  expect(r.status(), 'reference-data search results -> 200').toBe(200);
  const body = (await r.json()) as {
    items?: Array<{ table_id: number; name: string; namespace?: { name: string } }>;
  };
  return {
    total: session.total,
    items: (body.items ?? []).map((i) => ({ table_id: i.table_id, name: i.name, namespace: i.namespace?.name })),
  };
}
