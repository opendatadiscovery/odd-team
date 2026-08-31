import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import {
  upLoginFormStack,
  downLoginFormStack,
  LOGINFORM_BASE_URL,
} from '../helpers/loginform-stack';

/**
 * IT-153 — the My-data scopes actually NARROW the rendered result list, for a real signed-in owner
 * (ST-8 of #1825 / #1842, CTRIB-062).
 *
 * Protocol: integration-tests/protocols/IT-153-my-data-scope-narrows.md
 * Gates: validates F-015 (owner-anchored reads) + F-017 (search filter facets).
 *
 * Why its own stack: `auth.type=DISABLED` — the shared odd-minimal stack — has no principal at all, so
 * `fetchAssociatedOwner()` resolves empty and EVERY My-data scope returns an empty page by design. Correct
 * behaviour, and useless as a narrowing test. This runs on LOGIN_FORM with a real user-owner association.
 *
 * The regression it locks: before ST-8 the my-objects predicate was kind-guarded WITH PASS-THROUGH
 * (`ASSET_KIND <> 'DATA_ENTITY' OR data_entity.id IN (owned)`), so "My Objects" returned the caller's data
 * entities PLUS EVERY TERM in the catalog — a filter promising "mine" handing back other people's assets.
 *
 * RED on ref:main: `my_data` is an unknown field there, so no scope applies and every case below returns the
 * unfiltered set.
 *
 * Namespace: ids 21530-21535 · oddrn //e2e-it153/ · names it153mydata_*
 */
const TERM = 'it153mydata';
const MINE_ID = 21530;
const UP1_ID = 21531;
const DOWN1_ID = 21532;
const DOWN2_ID = 21533;
const STRANGER_ID = 21534;
const IDS = [MINE_ID, UP1_ID, DOWN1_ID, DOWN2_ID, STRANGER_ID];

const NAME = (id: number) => `${TERM}_${id}`;
const ODDRN = (id: number) => `//e2e-it153/db/${id}`;
const MY_TERM = `${TERM}_myterm`;
const OTHER_TERM = `${TERM}_otherterm`;

// The LOGIN_FORM stack runs its OWN database on 15434 (odd-minimal is 15432) — the shared db.ts helper points
// at odd-minimal, so this spec opens its own client rather than mutating a shared module's connection.
const LF_DB =
  process.env.ODD_LOGINFORM_DB_URL ??
  'postgresql://odd-platform:odd-platform-password@127.0.0.1:15434/odd-platform';

async function lfQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: LF_DB });
  await client.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    await client.end();
  }
}

async function seedEntity(id: number): Promise<void> {
  await lfQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, NULL, 1, '{1}', 0, NOW(), NOW())   -- data_source_id is nullable (V0_0_1__init.sql:72)
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name`,
    [id, ODDRN(id), NAME(id)],
  );
  await lfQuery('DELETE FROM search_entrypoint WHERE data_entity_id = $1', [id]);
  await lfQuery(
    `INSERT INTO search_entrypoint (data_entity_id, data_entity_vector)
     VALUES ($1, to_tsvector('english', $2))`,
    [id, NAME(id)],
  );
}

async function seedTerm(name: string, ownerId: number | null): Promise<number> {
  // NB: `namespace.name` carries NO unique constraint (V0_0_1__init.sql:13), so ON CONFLICT (name) would
  // raise "no unique or exclusion constraint matching the ON CONFLICT specification". SELECT-then-INSERT,
  // the same shape db.ts uses for `tag` for the same reason.
  const existing = await lfQuery<{ id: number }>('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [
    `it153_ns_${name}`,
  ]);
  const ns =
    existing.length > 0
      ? existing
      : await lfQuery<{ id: number }>('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [
          `it153_ns_${name}`,
        ]);
  const term = await lfQuery<{ id: number }>(
    `INSERT INTO term (name, definition, namespace_id, created_at, updated_at)
     VALUES ($1, 'IT-153 fixture', $2, NOW(), NOW()) RETURNING id`,
    [name, ns[0].id],
  );
  const termId = Number(term[0].id);
  await lfQuery(
    `INSERT INTO term_search_entrypoint (term_id, term_vector)
     VALUES ($1, to_tsvector('english', $2))
     ON CONFLICT (term_id) DO UPDATE SET term_vector = EXCLUDED.term_vector`,
    [termId, name],
  );
  if (ownerId != null) {
    // same title requirement as `ownership` above — resolve (or create) it here so the helper is standalone
    const t = await lfQuery<{ id: number }>(`SELECT id FROM title WHERE name = 'it153_title' LIMIT 1`);
    const titleId =
      t.length > 0
        ? Number(t[0].id)
        : Number(
            (await lfQuery<{ id: number }>(`INSERT INTO title (name) VALUES ('it153_title') RETURNING id`))[0]
              .id,
          );
    await lfQuery('INSERT INTO term_ownership (term_id, owner_id, title_id) VALUES ($1, $2, $3)', [
      termId,
      ownerId,
      titleId,
    ]);
  }
  return termId;
}

/** Sign in through the real Spring form-login page — this test is about a REAL principal, not a mocked one. */
async function signIn(page: Page): Promise<void> {
  await page.goto(`${LOGINFORM_BASE_URL}/login`);
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill('admin');
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

const rowOf = (page: Page, name: string) =>
  page.getByTestId('search-result-item').filter({ hasText: name });

/** Open /search on the LOGIN_FORM stack with an explicit URL state, and wait for it to settle. */
async function openSearch(page: Page, query: string): Promise<void> {
  await page.goto(`${LOGINFORM_BASE_URL}/search?${query}`);
  await expect(
    page.getByTestId('search-results-count'),
    'the search settled (the results header renders once the asset search resolves)',
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * READINESS GATE — the step this spec was missing (`integration-tests/TEMPLATE.md`: seed -> READINESS -> run
 * -> assert).
 *
 * WHY IT IS NEEDED, measured not guessed: in the ctrib062 full regression this spec was 4/4 green in isolation
 * but its FIRST test failed on the plain baseline assertion (`baseline lists my entity`) while tests 2-4 passed
 * against the same fixture. `openSearch` already waits for the results header, so the search had RESOLVED — it
 * simply did not contain the seeded row yet. The distinguishing factor is that `beforeAll` brings the
 * LOGIN_FORM stack up (a preceding multi-stack spec tears it down), so the first query in the file hits a
 * just-booted platform.
 *
 * Asserting a fixture is visible without first establishing that it IS searchable is the defect; a longer
 * timeout on the assertion would only have hidden it, because the assertion is not the thing that needs to
 * settle. This polls the real user surface until the seed is served, then the assertions run against a known
 * state — and it FAILS LOUDLY if the fixture never becomes searchable, which a bare timeout bump would not.
 */
async function waitUntilSearchable(page: Page, name: string): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.goto(`${LOGINFORM_BASE_URL}/search?q=${TERM}`);
        await expect(page.getByTestId('search-results-count')).toBeVisible({ timeout: 30_000 });
        return rowOf(page, name).count();
      },
      {
        timeout: 90_000,
        intervals: [1_000, 2_000, 5_000, 5_000],
        message:
          `the seeded fixture "${name}" never became searchable on the freshly-booted LOGIN_FORM stack. ` +
          'That is a readiness failure, not a scope failure — the My-data assertions below would be ' +
          'meaningless against a catalog that cannot serve the fixture at all.',
      },
    )
    .toBeGreaterThan(0);
}

test.describe('IT-153 — My-data scopes narrow the rendered results for a bound owner', () => {
  let ownerId: number;

  test.beforeAll(async () => {
    test.setTimeout(300_000); // LOGIN_FORM stack bring-up
    await upLoginFormStack();

    // NB: `owner`'s uniqueness is a PARTIAL index — `owner_name_unique ON owner(name) WHERE deleted_at IS
    // NULL` (V0_0_36 dropped the plain constraint) — and ON CONFLICT cannot target a partial index without
    // repeating its predicate. Same class as the `namespace` case below, so use the same robust shape:
    // SELECT-then-INSERT, which does not care how the uniqueness is expressed.
    const existingOwner = await lfQuery<{ id: number }>(
      `SELECT id FROM owner WHERE name = 'it153_owner' AND deleted_at IS NULL LIMIT 1`,
    );
    const owner =
      existingOwner.length > 0
        ? existingOwner
        : await lfQuery<{ id: number }>(`INSERT INTO owner (name) VALUES ('it153_owner') RETURNING id`);
    ownerId = Number(owner[0].id);

    // The association the whole feature hangs on. provider = the auth.type, matching
    // ReactiveUserOwnerMappingRepositoryImpl.getConditions (oidc_username + provider + deleted_at IS NULL).
    await lfQuery(
      `DELETE FROM user_owner_mapping WHERE oidc_username = 'admin' AND provider = 'LOGIN_FORM'`,
    );
    await lfQuery(
      `INSERT INTO user_owner_mapping (oidc_username, provider, owner_id) VALUES ('admin', 'LOGIN_FORM', $1)`,
      [ownerId],
    );

    for (const id of IDS) await seedEntity(id);
    // up1 -> mine -> down1 -> down2 ; stranger is unconnected and unowned.
    for (const [parent, child] of [
      [UP1_ID, MINE_ID],
      [MINE_ID, DOWN1_ID],
      [DOWN1_ID, DOWN2_ID],
    ]) {
      await lfQuery(
        `INSERT INTO lineage (parent_oddrn, child_oddrn, establisher_oddrn, is_deleted)
         VALUES ($1, $2, $1, false) ON CONFLICT DO NOTHING`,
        [ODDRN(parent), ODDRN(child)],
      );
    }
    // ONLY `mine` is owned — so any other entity appearing under My Objects is a leak, not a fixture artefact.
    // The ownership row MUST carry a title_id: `DataEntityDtoMapper.extractOwnershipRelation` looks the title
    // up in a dict and throws `There's no title with id null found in titleDict` on a NULL, which 500s the
    // whole results page. `title_id` is nullable in the schema, so that is a real robustness gap (filed
    // separately) — but a fixture must not depend on it, and db.ts's own seedEntityOwner always sets one.
    const existingTitle = await lfQuery<{ id: number }>(
      `SELECT id FROM title WHERE name = 'it153_title' LIMIT 1`,
    );
    const title =
      existingTitle.length > 0
        ? existingTitle
        : await lfQuery<{ id: number }>(`INSERT INTO title (name) VALUES ('it153_title') RETURNING id`);
    await lfQuery('INSERT INTO ownership (data_entity_id, owner_id, title_id) VALUES ($1, $2, $3)', [
      MINE_ID,
      ownerId,
      Number(title[0].id),
    ]);
    await seedTerm(MY_TERM, ownerId);
    await seedTerm(OTHER_TERM, null);
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    await downLoginFormStack();
  });

  test('My Objects returns what I own across kinds — and nothing else (the pass-through regression)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signIn(page);

    // Readiness FIRST: this is the file's first query against a stack this file just booted.
    await waitUntilSearchable(page, NAME(MINE_ID));

    // baseline: everything the query matches is listed
    await openSearch(page, `q=${TERM}`);
    await expect(rowOf(page, NAME(MINE_ID)), 'baseline lists my entity').toBeVisible({ timeout: 20_000 });
    await expect(rowOf(page, NAME(STRANGER_ID)), 'baseline lists the unowned entity').toBeVisible();
    await expect(rowOf(page, OTHER_TERM), 'baseline lists the unowned term').toBeVisible();

    await openSearch(page, `q=${TERM}&my_data[]=MY_OBJECTS`);
    await expect(rowOf(page, NAME(MINE_ID)), 'my owned entity is in scope').toBeVisible({ timeout: 20_000 });
    await expect(rowOf(page, MY_TERM), 'and so is the term I own — ownership is per kind').toBeVisible();
    await expect(
      rowOf(page, OTHER_TERM),
      'THE REGRESSION: a term I do not own must NOT pass through a filter labelled "My Objects"',
    ).toHaveCount(0);
    await expect(rowOf(page, NAME(STRANGER_ID)), 'nor an entity I do not own').toHaveCount(0);
  });

  test('the two lineage directions are not interchangeable, and exclude the anchor', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);

    await openSearch(page, `q=${TERM}&my_data[]=UPSTREAM`);
    await expect(rowOf(page, NAME(UP1_ID)), 'upstream of my data = what mine depends ON').toBeVisible({
      timeout: 20_000,
    });
    await expect(rowOf(page, NAME(DOWN1_ID)), 'a downstream entity is NOT upstream').toHaveCount(0);
    await expect(
      rowOf(page, NAME(MINE_ID)),
      'the anchor is excluded from its own neighbour set — "upstream of my data" is not "my data"',
    ).toHaveCount(0);

    await openSearch(page, `q=${TERM}&my_data[]=DOWNSTREAM`);
    await expect(rowOf(page, NAME(DOWN1_ID)), 'downstream of my data = what depends on mine').toBeVisible({
      timeout: 20_000,
    });
    await expect(rowOf(page, NAME(UP1_ID)), 'an upstream entity is NOT downstream').toHaveCount(0);
  });

  test('depth is per-direction: raising downstream to 2 reaches the second hop, upstream is unaffected', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signIn(page);

    await openSearch(page, `q=${TERM}&my_data[]=DOWNSTREAM`);
    await expect(rowOf(page, NAME(DOWN1_ID))).toBeVisible({ timeout: 20_000 });
    await expect(rowOf(page, NAME(DOWN2_ID)), 'the two-hop neighbour is out of reach at depth 1').toHaveCount(0);

    await openSearch(page, `q=${TERM}&my_data[]=DOWNSTREAM&downstream_depth=2`);
    await expect(rowOf(page, NAME(DOWN2_ID)), 'depth 2 reaches the second hop').toBeVisible({
      timeout: 20_000,
    });

    // the OTHER direction's depth must not widen this one
    await openSearch(page, `q=${TERM}&my_data[]=DOWNSTREAM&upstream_depth=3`);
    await expect(
      rowOf(page, NAME(DOWN2_ID)),
      'upstream_depth must not widen the downstream set — the depths are independent',
    ).toHaveCount(0);
  });

  test('the My-data group renders ENABLED for a bound owner (the contrast to IT-152 DISABLED)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await openSearch(page, `q=${TERM}`);

    await expect(
      page.locator('#filter-my_data'),
      'a signed-in, owner-bound user gets the filter — IT-152 asserts its ABSENCE under DISABLED',
    ).toBeVisible({ timeout: 20_000 });
  });
});
