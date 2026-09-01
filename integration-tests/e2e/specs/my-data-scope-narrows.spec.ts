import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import {
  upLoginFormStack,
  downLoginFormStack,
  LOGINFORM_BASE_URL,
} from '../helpers/loginform-stack';
import { switchLanguageViaUi } from '../helpers/locale';

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
// The ua.json values for the ST-8 My-data labels, copied verbatim from
// odd-platform-ui/src/locales/translations/ua.json. Pinned as literals on purpose: reading them out of the
// catalogue at runtime would make the test agree with whatever the catalogue says, which is exactly the
// tautology that let the #1751 class ship — the assertion has to carry its own expected value.
const UA = {
  heading: "Мої дані",
  myObjects: "Мої об'єкти",
  upstream: "Верхній рівень моїх даних",
  upstreamDepth: "Глибина верхнього рівня",
};

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
  // Self-diagnosing on purpose: a readiness failure that only says "0" sends the next reader to guess, and the
  // stack is torn down in afterAll before anyone can probe it (the §18 mistake — the evidence was destroyed and
  // then reasoned about). Capture what the page ACTUALLY showed on every attempt, and report it on failure.
  let lastSeen = '(the results header never rendered)';
  try {
    await expect
      .poll(
        async () => {
          await page.goto(`${LOGINFORM_BASE_URL}/search?q=${TERM}`);
          await expect(page.getByTestId('search-results-count')).toBeVisible({ timeout: 30_000 });
          const count = (await page.getByTestId('search-results-count').innerText()).replace(/\s+/g, ' ');
          const rows = (await page.getByTestId('search-result-item').allInnerTexts())
            .map(t => t.split('\n')[0].trim())
            .filter(Boolean);
          lastSeen = `header="${count}" renderedRows=${JSON.stringify(rows)}`;
          return rowOf(page, name).count();
        },
        { timeout: 90_000, intervals: [1_000, 2_000, 5_000, 5_000] },
      )
      .toBeGreaterThan(0);
  } catch {
    // The page-level symptom ("0 results") is the same for at least four different causes, and the stack is
    // torn down in afterAll before anyone can go and look — so read every layer between the seed and the
    // screen HERE, while the evidence still exists, and print the answer instead of a hypothesis.
    //
    // This exists because the failure is INTERMITTENT (~1 whole-suite run in 3, only in suite context) and
    // three plausible root causes were each argued and then disproved from the source alone: a background
    // indexing race (there is none — V0_0_98 syncs asset_search_entrypoint with SYNCHRONOUS AFTER triggers),
    // a NULL-propagating generated column (V0_0_14 wraps every term in coalesce), and a lax health probe
    // letting the seed land before migrations (the body is `{"status":"UP"}`; there are no components to
    // half-match). Reasoning from the source could not settle it. Measurement at the moment of failure can.
    const diag = await diagnoseSearchability(name);
    throw new Error(
      `READINESS: the seeded fixture "${name}" never became searchable on the freshly-booted LOGIN_FORM ` +
        `stack within 90s. This is a readiness failure, NOT a scope failure — the My-data assertions below ` +
        `would be meaningless against a catalog that cannot serve the fixture at all.\n` +
        `  last observed page state: ${lastSeen}\n` +
        `${diag}`,
    );
  }
}

/**
 * Read every layer the fixture must pass through, at the moment it failed to appear, and say which one lost
 * it. Each line answers one question that would otherwise cost a whole re-run to guess at:
 *
 *   flyway      — is this database fully migrated? A seed that lands before V0_0_98 creates its triggers
 *                 would leave asset_search_entrypoint empty forever, and nothing downstream would say so.
 *   data_entity — did the row land at all, and are the three columns the ranked query filters on
 *                 (status / hollow / exclude_from_search) the values the seed intends? The seed relies on
 *                 defaults for all three.
 *   search_ep   — did the legacy DE entrypoint get the row, and does its GENERATED search_vector match?
 *   asset_ep    — did the AFTER trigger propagate it into the unified index the search actually reads?
 *   api         — does the backend itself return it, independent of the SPA?
 *
 * Deliberately best-effort: a diagnostic that throws while diagnosing destroys the evidence it exists to
 * capture, so every probe is individually guarded and reports its own failure inline.
 */
async function diagnoseSearchability(name: string): Promise<string> {
  const line = async (label: string, fn: () => Promise<string>): Promise<string> => {
    try {
      return `  ${label}: ${await fn()}`;
    } catch (e) {
      return `  ${label}: PROBE FAILED — ${(e as Error).message}`;
    }
  };
  const out: string[] = ['  --- layer probe at the moment of failure (the stack is still up here) ---'];
  out.push(
    await line('flyway', async () => {
      const r = await lfQuery<{ n: string; v: string }>(
        `SELECT count(*)::text AS n, coalesce(max(version), '(none)') AS v
           FROM flyway_schema_history WHERE success`,
      );
      return `${r[0]?.n} migrations applied, max version ${r[0]?.v} (V0_0_98 creates the ASE triggers)`;
    }),
  );
  out.push(
    await line('data_entity', async () => {
      const r = await lfQuery<Record<string, unknown>>(
        `SELECT id, external_name, status, hollow, exclude_from_search
           FROM data_entity WHERE external_name = $1`,
        [name],
      );
      return r.length === 0 ? 'ROW ABSENT — the seed did not reach this database' : JSON.stringify(r[0]);
    }),
  );
  out.push(
    await line('search_entrypoint', async () => {
      const r = await lfQuery<{ n: string; matches: boolean }>(
        `SELECT count(*)::text AS n,
                bool_or(se.search_vector @@ to_tsquery('english', $1 || ':*')) AS matches
           FROM search_entrypoint se
           JOIN data_entity de ON de.id = se.data_entity_id
          WHERE de.external_name = $2`,
        [TERM, name],
      );
      return `${r[0]?.n} row(s), search_vector matches the query token: ${r[0]?.matches}`;
    }),
  );
  out.push(
    await line('asset_search_entrypoint', async () => {
      const r = await lfQuery<{ n: string; matches: boolean }>(
        `SELECT count(*)::text AS n,
                bool_or(ase.search_vector @@ to_tsquery('english', $1 || ':*')) AS matches
           FROM asset_search_entrypoint ase
           JOIN data_entity de ON de.id = ase.asset_id AND ase.asset_kind = 'DATA_ENTITY'
          WHERE de.external_name = $2`,
        [TERM, name],
      );
      return `${r[0]?.n} row(s), search_vector matches: ${r[0]?.matches} `
        + `(0 rows here with a present search_entrypoint row = the AFTER trigger did not fire, i.e. the seed `
        + `predates V0_0_98 on this database)`;
    }),
  );
  out.push(
    await line('api', async () => {
      const r = await fetch(`${LOGINFORM_BASE_URL}/api/search/assets?size=5`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: TERM, filters: {} }),
      });
      const body = await r.text();
      return `POST /api/search/assets -> HTTP ${r.status}, body[0..300]=${body.slice(0, 300)}`;
    }),
  );
  return out.join('\n');
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

    // POSTCONDITION on the seed itself, asserted where the seed happens rather than 90s later at the UI.
    // Everything below assumes these five rows are present in the UNIFIED index (asset_search_entrypoint) —
    // the table the cross-kind search actually reads — and the path from the seed to that table runs through
    // a generated column and an AFTER trigger. If any link in it is broken on this freshly-booted stack, the
    // page-level symptom is an indistinguishable "0 results", so pin it at the source: a failure here names
    // the seed, a failure later names the platform.
    const indexed = await lfQuery<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM asset_search_entrypoint ase
         JOIN data_entity de ON de.id = ase.asset_id AND ase.asset_kind = 'DATA_ENTITY'
        WHERE de.external_name LIKE $1
          AND ase.search_vector @@ to_tsquery('english', $2 || ':*')`,
      [`${TERM}\_%`, TERM],
    );
    expect(
      Number(indexed[0]?.n ?? 0),
      `the ${IDS.length} seeded entities must reach asset_search_entrypoint (via search_entrypoint's ` +
        `generated search_vector and the V0_0_98 AFTER trigger) before any assertion below means anything`,
    ).toBe(IDS.length);

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

  // The i18n guard for the labels ST-8 introduces. It has to live HERE and nowhere else: IT-102 owns this
  // regression class for /search, but it runs on the auth-disabled stack, where the My-data group is HIDDEN
  // by design (spec R7) — so after ST-8 re-pointed IT-102 onto the Asset-type / Data-entity-type controls,
  // the eleven keys this slice adds had no rendered-locale coverage at any level. Catalog key-parity does not
  // substitute: the recurring ODD defect (#1751 / PLT-205) is a label built in a TS object array outside JSX,
  // where the key exists in every locale file and the component simply never calls t() on it. Only driving
  // the page under a non-English locale catches that, and this is the one stack where the group renders.
  test('the My-data labels render TRANSLATED under a non-English locale (#1751 / PLT-205 class)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await openSearch(page, `q=${TERM}`);

    // baseline English — assert first, so a failure after the switch cannot be "it never rendered at all"
    await expect(
      page.getByText('My data', { exact: true }),
      'baseline: the English "My data" group heading must render before switching',
    ).toBeVisible({ timeout: 20_000 });

    await switchLanguageViaUi(page, 'Ukrainian');

    // the group heading, one scope option and one depth label — three different render paths (Typography,
    // the FixedOptionsMultiFilter option list built outside JSX, and the DepthSelect label)
    await expect(
      page.getByText(UA.heading, { exact: true }),
      `after switching to ua the group heading must read ua.json "${UA.heading}"`,
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(UA.myObjects, { exact: true }),
      `the "My Objects" option must read ua.json "${UA.myObjects}" — the outside-JSX option-array class`,
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(UA.upstream, { exact: true }),
      `the lineage option must read ua.json "${UA.upstream}"`,
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(UA.upstreamDepth, { exact: true }),
      `the depth label must read ua.json "${UA.upstreamDepth}"`,
    ).toBeVisible({ timeout: 10_000 });

    // and the English is GONE — presence alone would pass on a page that renders both
    await expect(
      page.getByText('My data', { exact: true }),
      'the raw English "My data" heading must be gone under ua',
    ).toHaveCount(0);
    await expect(
      page.getByText('Upstream of my data', { exact: true }),
      'the raw English lineage option must be gone under ua',
    ).toHaveCount(0);
  });
});
