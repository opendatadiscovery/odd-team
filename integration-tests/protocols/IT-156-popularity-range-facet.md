---
id: IT-156
title: "Popularity range facet: the slider narrows the rendered list to data entities in the chosen view bands, the distribution reflects the other filters, the range survives the mirror / Clear All / a saved search, and the Popular tile's View all reproduces the tile (#1843)"
gates:
  validates: [F-017]            # the catalog-search promise node; F-017-UC-16 (added in the CTRIB-066 Phase-D ontology step)
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:popularity-range-facet.spec.ts"
plan_ref: "contributor/CTRIB-066.md (ST-9 of #1825 / #1843); ADR adrs/drafts/unified-asset-search.md D5/D8/D10/D11"
status: ready
---

# IT-156 — the Popularity range facet, driven as a user (ST-9 / #1843 / CTRIB-066)

> A protocol is the source of truth — a human can execute every step below WITHOUT tooling.
> The `automation:` spec runs the same steps and writes the same result.

## 0. LANE — `pending-merge` until odd-platform#1843's PR merges

This protocol asserts behaviour that is FALSE on `origin/main @ af5a573b`: there is no Popularity facet, the
`popularity_min` / `popularity_max` params are unknown (dropped on parse, so a deep link lists the whole match set),
there is no `Most popular` sort and the Popular tile has no View all. It sits in `pending-merge` (shared spec repo,
per-stream SUTs — `pillars/tests/pillar.md` "`pending-merge` is not a bucket either") and **graduates to
`feature-complete` + `ui-e2e` at CTRIB-066's GATE-2 close-out**, which cites the first `feature-complete` run-log line
that executed it (the OWNER rule `TST-067` installed).

## 1. What this checks

**A user can narrow the catalog search to data entities in a chosen band of view counts, and everything that carries a
search state carries that range too.** Concretely: (1) moving the slider by keyboard narrows the RENDERED list — the
entities outside the band disappear, the term disappears, and the control says *"Data entities only"*; (2) a deep link
with the range applies it and names the band on the chip; (3) toggling an unrelated sidebar facet does NOT drop the
range (the #1858 mirror-merge class); (4) Clear All removes it; (5) a saved search reapplies it (the LSN-042 class —
the tenth search dimension must round-trip like the other nine); (6) the distribution the bars are drawn from counts
the data entities that match every OTHER filter, and changes when a facet is applied; (7) the home page's Popular tile
links to a search sorted by popularity that reproduces the tile (most viewed first, unviewed entities absent);
(8) the *Never viewed* preset lists only never-viewed data entities; (9) when the other filters leave no data entity
(Asset type = Terms) the control is disabled with its reason rather than a dead slider.

**Operator consequence if it fails:** a steward hunting deprecation candidates ("what does nobody look at?") or an
analyst looking for the go-to table ("what does everybody look at?") gets a list that silently ignores the filter, a
bookmark/saved search that quietly widens on reapply, or a tile link that does not resemble the tile — every one a
"the UI lied" class defect, invisible to a unit test.

## 2. Preparation — build the test stand

Fast tier (read-path/UI mechanics): direct platform-DB seeding is correct — no collector semantics are under test, and
the popularity SNAPSHOT job (`AssetPopularitySnapshotJob`, ST-5c) is its own tested concern.

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED`), API `:18080`, DB `:15432` (or the stream's isolated pair).
- **Seed** (ids `21560`–`21562`, oddrn `//e2e-source-IT-022/db/tables/<id>`, names `it156pop_*`, all matching the
  prefix query `it156pop`): three searchable data entities — `it156pop_never` (0 views), `it156pop_some` (40 views →
  band 5, 31–62), `it156pop_many` (1,000 views → band 9, 511–1,022) — and a term `it156popterm`. **Set BOTH
  `data_entity.view_count` AND the union row's `asset_search_entrypoint.popularity_score =
  asset_popularity_bucket(view_count)`:** the snapshot job runs at startup and every 15 minutes with no initial delay
  and rewrites any row whose bucket differs from `bucket(view_count)`, so a score seeded over `view_count = 0` would be
  reset mid-test; with both set the job is a no-op on these rows.
  ```sql
  UPDATE data_entity SET view_count = 40 WHERE id = 21561;
  UPDATE asset_search_entrypoint SET popularity_score = asset_popularity_bucket(40)
   WHERE asset_kind = 'DATA_ENTITY' AND asset_id = 21561;   -- and likewise 1000 for 21562, 0 for 21560
  ```
- **Auth:** DISABLED — popularity is catalog-wide (no identity), so the control renders identically for every user.

## 3. Readiness check — is the stand ready?

- `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- `SELECT asset_id, popularity_score FROM asset_search_entrypoint WHERE asset_id IN (21560,21561,21562)` → `0 / 5 / 9`.
- `POST /api/search/assets?size=30 {"query":"it156pop","filters":{}}` → 4 items (3 data entities + the term).

## 4. Run protocol — what to run

1. Open `/search?q=it156pop`; wait for the results count. The Filters rail shows **Popularity** with *Data entities
   only* under it and a two-handle slider over three stops (the occupied bands 0 / 5 / 9), bars above it.
2. Focus the LEFT thumb and press → once. The URL gains `popularity_min=5`; the chip reads `Popularity: 31+ views`.
   Focus the RIGHT thumb and press ← once. The URL gains `popularity_max=5`; the chip reads `Popularity: 31 – 62 views`.
3. Open `/search?q=it156pop&popularity_min=4` directly (a deep link).
4. With `/search?q=it156pop&popularity_min=4` open, pick **STABLE** in the Statuses facet (type `STABLE`, choose it).
5. Click **Clear All**.
6. With `/search?q=it156pop&popularity_min=5&popularity_max=5`, click **Save current search**, name it `it156-band5`,
   Save. Open `/search?q=it156pop` (unfiltered), then **Saved searches** → `it156-band5`.
7. Open `/search?q=it156pop` and read the facet response (`POST /api/search/assets/facets/popularity`); then pick
   STABLE in Statuses and read the next facet response.
8. Open `/` (the home page); in the **Popular** tile click **View all**.
9. Open `/search?q=it156pop` and click the **Never viewed** preset under the slider.
10. Open `/search?q=it156pop&asset_kinds[]=TERM`.

**Automated rail:** `ODD_STREAM=<id> ODD_PLATFORM_DIR=<worktree> integration-tests/run-suite.sh IT-156`
(the RED half: the same with `ODD_SUT=ref:main`).

## 5. What it checks — assertions

Every case asserts NARROWING with a FOIL, never presence alone: on the unfixed base the params are dropped and the
unfiltered list shows every seeded row, so "the 40-view entity is listed" is green there — "the 0-view entity is
ABSENT" is what goes RED.

| # | PASS when | FAIL when (the regression signature) |
|---|---|---|
| 1 | after step 2: `it156pop_some` listed; `it156pop_never`, `it156pop_many` and the term **absent**; *Data entities only* visible; the URL carries `popularity_min=5&popularity_max=5` | the never-viewed entity or the term is still listed; no control; the params never reach the URL |
| 2 | step 3: chip `Popularity: 15+ views`; `never` **absent**; `some` + `many` present | the deep link lists all three (the param was dropped) |
| 3 | step 4: the URL still carries `popularity_min=4` after the facet reaches it (`statuses[]=`), and `never` is still absent — also 1.5 s later (no late mirror write drops it) | the range vanishes on the facet toggle — the #1858 class |
| 4 | step 5: both params gone; `never` back in the list | the range survives Clear All, or the list stays narrowed |
| 5 | step 6: the 201 body's `spec.popularity` is `{min:5,max:5}`; after reapply the URL carries both params and `never` + `many` are **absent**, `some` present | the stored spec has no `popularity`; the reapplied list is the whole match set |
| 6 | step 7: the first facet response has 21 buckets with `count` 1 at scores 0, 5, 9 and 0 elsewhere (the term is NOT counted in band 0); after the STABLE facet (set on `some`) the response counts 1 at score 5 only | 404 (no endpoint); the term counted; the counts ignore the facet |
| 7 | step 8: the link's href is `/search?popularity_min=1&sort=popularity`; on the landing page `many` is listed ABOVE `some`, `never` is **absent**, the sort menu shows *Most popular*, the chip reads `Popularity: 1+ views` | the tile has no View all; the list is not ordered by views; the never-viewed entity is listed |
| 8 | step 9: the URL carries `popularity_max=0&popularity_min=0`; `never` listed, `some` + `many` **absent** | no preset; the list is not narrowed |
| 9 | step 10: the Popularity control is disabled with *No data entities match your other filters*; no slider | a dead slider over an empty rail |

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-156.md` (or the suite's file).
Log fields: `date · stack_commit · runner · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: `contributor/CTRIB-066.md` §4 (R1–R12), §7 Step 9; ADR `unified-asset-search` D5 (the snapshotted range
  facet), D8 (the tile as a deep-link widget), D10 (URL state), D11 (one canonical spec, two surfaces).
- Siblings: IT-148 (the Favorites filter's narrowing oracle + mirror class), IT-152 (the Statuses-facet toggle idiom),
  IT-155 (the saved-search save → reapply idiom).
