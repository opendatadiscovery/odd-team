import { Client } from 'pg';

// Ground-truth access to the stack's Postgres. We seed and read view_count directly
// in the DB (never via the API) so the measurement is not perturbed by the very
// GET /api/dataentities/{id} call whose effect we are counting.
//
// Id 2001 is distinct from the API-probe P-001's 1001 to avoid any collision.
export const ENTITY_ID = 2001;
const SOURCE_ID = 2001;

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

// Seed a fresh, renderable data entity with view_count = 0 — the same minimal column
// set the API probe P-001 uses, sufficient for GET /api/dataentities/{id} (which the
// Overview page calls) to return 200 and increment the counter. DO UPDATE resets the
// count to 0 so the spec is re-runnable against an external (ODD_STACK_EXTERNAL) stack.
export async function seedEntity(): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO data_source (id, oddrn, name)
       VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [SOURCE_ID, '//e2e-source-IT-002/db', 'e2e-source-IT-002'],
    );
    await c.query(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, view_count,
          source_created_at, source_updated_at)
       VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET view_count = 0`,
      [ENTITY_ID, '//e2e-source-IT-002/db/tables/it002_table', 'it002_table', SOURCE_ID],
    );
  });
}

export async function readViewCount(): Promise<number> {
  return withClient(async (c) => {
    const r = await c.query('SELECT view_count FROM data_entity WHERE id = $1', [ENTITY_ID]);
    return Number(r.rows[0]?.view_count ?? -1);
  });
}

// IT-014 — F-004 entity description: seed entity 2001 then set (or clear) its internal
// description. internal_description is the user-edited description the Overview renders.
export async function seedEntityDescription(description: string | null): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('UPDATE data_entity SET internal_description = $2 WHERE id = $1', [ENTITY_ID, description]);
  });
}

// ---------------------------------------------------------------------------
// IT-003 — search tsquery poisoning (PLT-090 catalog / PLT-127 dictionary).
//
// The catalog/term search persists the typed query verbatim into the
// `search_facets` session row (no owner binding) and later inlines it into a raw
// `to_tsquery(?)` (JooqFTSHelper.tsQuery, JooqFTSHelper.java:164-168) with NO
// operator escaping. A metacharacter (`(`, `)`, `:`, …) therefore raises Postgres
// 42601 on every later read of that row — a PERSISTENT 500 until the housekeeping
// TTL evicts it. These helpers give the spec ground-truth visibility into what got
// persisted, independent of the UI, so the "persistent" half of the bug is provable
// from the DB and not just inferred from a transient 5xx.
// ---------------------------------------------------------------------------

// The most-recently-touched search session row's stored query (the thing that, when
// it contains a tsquery metacharacter, poisons every subsequent read). Returns null
// if no session has been created yet. `search_facets` columns are id/query_string/
// filters/last_accessed_at — no owner (PLT-090 defect 1), no soft-delete — so
// "most recent by last_accessed_at" is the right key for a single-user e2e run.
// Best-effort: this is EVIDENCE, never the gate, so a schema surprise returns null
// rather than crashing the test (lesson from the deleted_at miss).
export async function latestSearchFacetQuery(): Promise<string | null> {
  try {
    return await withClient(async c => {
      const r = await c.query(
        `SELECT query_string FROM search_facets
         ORDER BY last_accessed_at DESC NULLS LAST
         LIMIT 1`,
      );
      return r.rows[0]?.query_string ?? null;
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IT-007 — attachment LOCAL-storage durability (LSN-001 / F-027 / PLT-086).
// A data entity to attach a file to (distinct id so it never collides with the
// other specs' seeds). Mirrors IT-002's proven minimal renderable-entity shape.
// ---------------------------------------------------------------------------
export const ATTACH_ENTITY_ID = 2007;
const ATTACH_SOURCE_ID = 2007;

export async function seedAttachmentEntity(): Promise<number> {
  await withClient(async c => {
    await c.query(
      `INSERT INTO data_source (id, oddrn, name)
       VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [ATTACH_SOURCE_ID, '//e2e-source-IT-007/db', 'e2e-source-IT-007'],
    );
    await c.query(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, view_count,
          source_created_at, source_updated_at)
       VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [ATTACH_ENTITY_ID, '//e2e-source-IT-007/db/tables/it007_table', 'it007_table', ATTACH_SOURCE_ID],
    );
  });
  return ATTACH_ENTITY_ID;
}

// ---------------------------------------------------------------------------
// IT-005 — Top Tags ordering (PLT-026 / F-018 H-001, LSN-019).
//
// `ReactiveTagRepositoryImpl.listMostPopular` paginates by `TAG.ID ASC` BEFORE it
// aggregates usage (ReactiveTagRepositoryImpl.java:147-148): page 1 (size 30) is the
// 30 OLDEST tags by id, and only THEN are those 30 re-ranked by usage. So the
// youngest (highest-id) tags can never reach page 1 — even when they are the most
// used. We seed a catalog where the MOST-USED tags are the YOUNGEST, so a correct
// "most popular" query MUST surface them and the buggy one structurally cannot.
// (The Overview's TopTagsList re-sorts client-side by usedCount, so the only way the
// popular-young tags are missing from the UI is the backend never returning them —
// which is exactly the bug.)
// ---------------------------------------------------------------------------

const IT005_PREFIX = 'it005-';
const TAG_OLD_COUNT = 30; // fills page 1 (size=30) with older, low-use tags
const TAG_POP_COUNT = 5; // youngest + most-used; a correct Top-N MUST include these
const IT005_SOURCE_ID = 2005;

// Seed 30 older low-use tags (lowest ids) + 5 younger high-use tags (highest ids),
// each tag wired to data entities so usage counts diverge: old=1, young=5. Idempotent
// (clears prior `it005-*` tags first) so it is re-runnable against an external stack.
// Returns the names of the youngest, most-popular tags — the ones a correct Top Tags
// MUST show and the buggy ordering drops off page 1.
export async function seedPopularYoungTags(): Promise<string[]> {
  return withClient(async (c) => {
    // idempotent reset (relations first — FK)
    await c.query(
      `DELETE FROM tag_to_data_entity
       WHERE tag_id IN (SELECT id FROM tag WHERE name LIKE $1)`,
      [`${IT005_PREFIX}%`],
    );
    await c.query(`DELETE FROM tag WHERE name LIKE $1`, [`${IT005_PREFIX}%`]);

    // a source + 5 usage-target entities (mirror IT-002's proven minimal entity shape)
    await c.query(
      `INSERT INTO data_source (id, oddrn, name)
       VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [IT005_SOURCE_ID, '//e2e-source-IT-005/db', 'e2e-source-IT-005'],
    );
    const entityIds: number[] = [];
    for (let i = 0; i < TAG_POP_COUNT; i += 1) {
      const id = 20050 + i;
      entityIds.push(id);
      await c.query(
        `INSERT INTO data_entity
           (id, oddrn, external_name, data_source_id, type_id, view_count,
            source_created_at, source_updated_at)
         VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        [id, `//e2e-source-IT-005/db/tables/it005_e${i}`, `it005_e${i}`, IT005_SOURCE_ID],
      );
    }

    // 30 OLD tags first (lowest ids), each used by ONE entity → usedCount = 1
    for (let i = 1; i <= TAG_OLD_COUNT; i += 1) {
      const name = `${IT005_PREFIX}old-${String(i).padStart(3, '0')}`;
      const r = await c.query(
        `INSERT INTO tag (name, important) VALUES ($1, false) RETURNING id`,
        [name],
      );
      await c.query(
        `INSERT INTO tag_to_data_entity (tag_id, data_entity_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [r.rows[0].id, entityIds[0]],
      );
    }

    // 5 POPULAR tags LAST (highest ids = youngest), each used by ALL 5 entities → usedCount = 5
    const popNames: string[] = [];
    for (let i = 1; i <= TAG_POP_COUNT; i += 1) {
      const name = `${IT005_PREFIX}POP-${String(i).padStart(3, '0')}`;
      popNames.push(name);
      const r = await c.query(
        `INSERT INTO tag (name, important) VALUES ($1, false) RETURNING id`,
        [name],
      );
      for (const eid of entityIds) {
        await c.query(
          `INSERT INTO tag_to_data_entity (tag_id, data_entity_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [r.rows[0].id, eid],
        );
      }
    }
    return popNames;
  });
}
