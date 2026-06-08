import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-055 — F-015 My-Objects Anchor-Set Reads under DISABLED (the owner-anchored discovery triplet).
 *
 * Protocol: integration-tests/protocols/IT-055-my-objects-anchor-reads.md
 * Gates: validates F-015 (UC-12 — anonymous caller under DISABLED returns empty, NOT a cross-owner leak).
 *
 * The triplet (DataEntityController.java:284-305): GET /api/dataentities/my (the owned set),
 * /api/dataentities/my/upstream and /api/dataentities/my/downstream (the non-owned-but-reachable
 * one-hop lineage neighbours of the owned set). Each takes only (page, size) — NO owner/user param —
 * and resolves the anchor via the F-011 chokepoint authIdentityProvider.fetchAssociatedOwner()
 * (DataEntityRelationsServiceImpl.java:26 + DataEntityServiceImpl.java:213).
 *
 * GROUND TRUTH (source + live curl against odd-minimal): under auth.type=DISABLED there is no
 * SecurityContext, so fetchAssociatedOwner() emits Mono.empty() at the principal step
 * (AuthIdentityProviderImpl.java:51) — BEFORE listByOwner / the lineage CTE / listByOddrns run.
 * The anchor set is therefore empty, the derived set is empty, and all three endpoints return
 * 200 + [] regardless of what ownership or lineage data exists in the catalog.
 *
 * This is F-015-UC-12 (cross-actor / DISABLED): "anonymous caller under DISABLED -> empty under
 * DISABLED" — the SAFE characterization. The architectural risk F-015 catalogues (REFACTOR-225:
 * owner-scoping enforced at exactly ONE site, no JOIN-side defence-in-depth) means a regression at
 * that single anchor would leak a wrong owner's neighbourhood; the SUCCESS test pins that today the
 * DISABLED path is safely-empty, and the CORNER test pins it stays empty even with owned entities +
 * lineage edges present (so a future regression that makes /my return data under DISABLED goes RED).
 *
 * LSN-029 characterization pins of the SHIPPED DEFAULT. GREEN now; they flip if DISABLED ever
 * resolves an owner (fallback owner-id, mis-ordered WebFilter, a "fix" that defaults the anchor).
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';
const MY = '/api/dataentities/my';
const MY_UP = '/api/dataentities/my/upstream';
const MY_DOWN = '/api/dataentities/my/downstream';

// it055_ namespace. A small owned graph: owned entity <- upstream parent ; owned entity -> downstream child.
const NS = 'it055_';
const SOURCE_ID = 20550;
const OWNED_ID = 20551;
const UP_ID = 20552;
const DOWN_ID = 20553;
const OWNED_ODDRN = `//it055/ds/tables/${NS}owned`;
const UP_ODDRN = `//it055/ds/tables/${NS}upstream`;
const DOWN_ODDRN = `//it055/ds/tables/${NS}downstream`;

async function getJsonArray(path: string): Promise<{ status: number; rows: unknown[] }> {
  const res = await fetch(`${BASE}${path}?page=1&size=100`);
  const txt = await res.text();
  const rows = txt.trim() ? (JSON.parse(txt) as unknown[]) : [];
  return { status: res.status, rows };
}

test.describe('IT-055 F-015 — My-Objects anchor-set reads under DISABLED', () => {
  test('SUCCESS (UC-12): the my-objects triplet (/my, /my/upstream, /my/downstream) is anonymously reachable and returns 200 + [] under DISABLED (no principal -> empty anchor)', async () => {
    for (const path of [MY, MY_UP, MY_DOWN]) {
      const { status, rows } = await getJsonArray(path);
      expect(status, `F-015: GET ${path} is anonymously reachable (200) under DISABLED`).toBe(200);
      expect(
        Array.isArray(rows) && rows.length,
        `F-015-UC-12: GET ${path} returns [] under DISABLED — the anchor resolves to empty at the ` +
          `principal step (fetchAssociatedOwner -> Mono.empty), so the owned/derived set is empty. ` +
          `A non-empty result here would mean the anchor resolved to SOME owner without an authenticated ` +
          `principal (a cross-owner-leak regression at the single REFACTOR-225 scoping site).`,
      ).toBe(0);
    }
  });

  test('CORNER: the triplet stays empty under DISABLED EVEN WITH an owned entity + a real upstream/downstream lineage edge in the catalog (anchor short-circuit precedes the lineage CTE)', async () => {
    // Seed three real DATA_SET entities and two lineage edges: up -> owned -> down.
    await dbQuery(`INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [
      SOURCE_ID,
      '//it055/ds',
      `${NS}ds`,
    ]);
    for (const [id, oddrn, name] of [
      [OWNED_ID, OWNED_ODDRN, `${NS}owned`],
      [UP_ID, UP_ODDRN, `${NS}upstream`],
      [DOWN_ID, DOWN_ODDRN, `${NS}downstream`],
    ] as const) {
      await dbQuery(
        `INSERT INTO data_entity
           (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
            source_created_at, source_updated_at)
         VALUES ($1, $2, $3, $4, 1, '{1}'::int[], 0, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET oddrn = EXCLUDED.oddrn, entity_class_ids = '{1}'::int[]`,
        [id, oddrn, name, SOURCE_ID],
      );
    }
    // ownership of the OWNED entity (so a working resolver would have a non-empty anchor).
    const ownerSel = await dbQuery<{ id: number }>(`SELECT id FROM owner WHERE name = $1 LIMIT 1`, [`${NS}owner`]);
    const ownerId =
      ownerSel[0]?.id ??
      (await dbQuery<{ id: number }>(`INSERT INTO owner (name) VALUES ($1) RETURNING id`, [`${NS}owner`]))[0].id;
    const titleSel = await dbQuery<{ id: number }>(`SELECT id FROM title WHERE name = $1 LIMIT 1`, [`${NS}title`]);
    const titleId =
      titleSel[0]?.id ??
      (await dbQuery<{ id: number }>(`INSERT INTO title (name) VALUES ($1) RETURNING id`, [`${NS}title`]))[0].id;
    await dbQuery(`DELETE FROM ownership WHERE data_entity_id = $1`, [OWNED_ID]);
    await dbQuery(`INSERT INTO ownership (data_entity_id, owner_id, title_id) VALUES ($1, $2, $3)`, [
      OWNED_ID,
      ownerId,
      titleId,
    ]);
    // lineage edges: upstream -> owned, owned -> downstream (schema per helpers/db.ts seedEntityLineage).
    await dbQuery(`DELETE FROM lineage WHERE child_oddrn = $1 OR parent_oddrn = $1`, [OWNED_ODDRN]);
    await dbQuery(
      `INSERT INTO lineage (parent_oddrn, child_oddrn, establisher_oddrn, is_deleted) VALUES ($1, $2, $1, false)`,
      [UP_ODDRN, OWNED_ODDRN],
    );
    await dbQuery(
      `INSERT INTO lineage (parent_oddrn, child_oddrn, establisher_oddrn, is_deleted) VALUES ($1, $2, $1, false)`,
      [OWNED_ODDRN, DOWN_ODDRN],
    );

    // Confirm the graph is real (so [] cannot be blamed on missing data).
    const edges = await dbQuery<{ n: number }>(
      `SELECT count(*)::int AS n FROM lineage WHERE parent_oddrn IN ($1,$2) AND (is_deleted IS NULL OR is_deleted=false)`,
      [UP_ODDRN, OWNED_ODDRN],
    );
    expect(edges[0].n, 'precondition: 2 live lineage edges around the owned entity').toBe(2);

    // All three still empty — the anchor short-circuit at the empty principal precedes listByOwner
    // AND the lineage CTE AND listByOddrns.
    for (const path of [MY, MY_UP, MY_DOWN]) {
      const { status, rows } = await getJsonArray(path);
      expect(status, `${path} reachable (200)`).toBe(200);
      expect(
        Array.isArray(rows) && rows.length,
        `F-015: GET ${path} STILL returns [] under DISABLED despite a seeded owned entity with live ` +
          `upstream + downstream lineage edges. The anchor never resolves (no principal), so neither the ` +
          `owned set nor its lineage neighbourhood is reachable anonymously. A non-empty result is the ` +
          `cross-owner-leak regression REFACTOR-225 warns about.`,
      ).toBe(0);
    }

    // cleanup (idempotent).
    await dbQuery(`DELETE FROM lineage WHERE child_oddrn = $1 OR parent_oddrn = $1`, [OWNED_ODDRN]);
    await dbQuery(`DELETE FROM ownership WHERE data_entity_id = $1`, [OWNED_ID]);
    await dbQuery(`DELETE FROM data_entity WHERE id = ANY($1::bigint[])`, [[OWNED_ID, UP_ID, DOWN_ID]]);
    await dbQuery(`DELETE FROM data_source WHERE id = $1`, [SOURCE_ID]);
    await dbQuery(`DELETE FROM owner WHERE name = $1`, [`${NS}owner`]);
    await dbQuery(`DELETE FROM title WHERE name = $1`, [`${NS}title`]);
  });
});
