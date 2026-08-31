---
id: IT-153
title: "My-data scopes actually narrow the rendered results for a bound owner, and the home panels deep-link into them"
gates:
  validates: [F-015, F-017]
  enforces: []
  regresses: []
test_class: integration
stack: odd-loginform
automation: "e2e:my-data-scope-narrows.spec.ts"
plan_ref: "contributor/CTRIB-062.md (ST-8 of #1825 / #1842); ADR adrs/drafts/unified-asset-search.md D4/D8"
status: ready
---

# IT-153 — the My-data scopes narrow, for a real signed-in owner

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks

The half of ST-8 that **cannot** be observed on the shared `odd-minimal` stack. `auth.type=DISABLED` has no
principal at all, so `fetchAssociatedOwner()` resolves empty and every My-data scope returns an empty page **by
design** — correct, and useless as a narrowing test. This protocol therefore runs on an **authenticating**
stack (`auth.type=LOGIN_FORM`) with a real user↔owner association, and asserts on the **rendered result list**:

1. **`My Objects` shows what I own and nothing else** — including across kinds. Before ST-8 the predicate was
   kind-guarded *with pass-through*, so "My Objects" returned the caller's data entities **plus every term in
   the catalog**. **Operator consequence if it regresses:** a filter that promises "mine" hands you a screen of
   other people's assets, and you act on it believing they are yours.
2. **`Upstream of my data` shows what my assets depend on; `Downstream of my data` shows what depends on
   them** — the two directions are not interchangeable, and the anchor itself is excluded from both.
3. **Depth is per-direction and independently settable.** At depth 1 a two-hop neighbour is absent; at depth 2
   it appears — and raising the *upstream* depth does not widen the downstream set.
4. **The three catalog-overview panels deep-link into the matching scope**, landing on a pre-filtered search
   rather than a dead end.
5. **The group renders enabled for a bound owner** — the contrasting posture to IT-152's DISABLED arm, which
   asserts the group is absent entirely.

## 2. Preparation — build the test stand

Fast tier (read-path/UI mechanics on an authenticating stack): direct platform-DB seeding is correct — no
collector semantics are under test, and the point is the identity → scope → rendered-list chain.

- **Stack**: `odd-loginform` (`lineage/_extractor/probe-stacks/odd-loginform.docker-compose.yml`), API on
  `:18082`, DB on `:15434`, credentials `admin:admin` (`AUTH_LOGIN_FORM_CREDENTIALS`). Brought up by the spec's
  `upLoginFormStack()`; torn down after.
- **Seed data** (into the LOGIN_FORM stack's own database on `:15434`, ids `21530`-`21535`, oddrn
  `//e2e-it153/`, names `it153mydata_*`):
  - an owner `it153_owner`, and `user_owner_mapping (oidc_username='admin', provider='LOGIN_FORM',
    owner_id=<it153_owner>, deleted_at=NULL)` — the shape `ReactiveUserOwnerMappingRepositoryImpl.getConditions`
    matches, with `provider` = the `auth.type`;
  - five searchable data entities sharing a query token: `mine` (owned), `up1` → `mine` → `down1` → `down2`
    lineage edges, plus `stranger` (owned by nobody, no lineage);
  - a term the owner owns (`term_ownership`) and a term nobody owns — the cross-kind discriminator;
  - `ownership(mine, it153_owner)` only. `up1` / `down1` / `down2` / `stranger` are deliberately unowned, so a
    scope that leaks would be visible immediately.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18082/actuator/health` → `{"status":"UP"}`
- Auth is enforcing: an unauthenticated `GET /api/info` is **not** served (401, or a redirect to `/login`).
- Seed present: `SELECT count(*) FROM data_entity WHERE id BETWEEN 21530 AND 21535;` → `5`
- The association resolves: `SELECT owner_id FROM user_owner_mapping WHERE oidc_username='admin' AND provider='LOGIN_FORM' AND deleted_at IS NULL;` → one row.

## 4. Run protocol — what to run

1. Sign in at `http://localhost:18082` with `admin` / `admin` (the Spring form-login page).
2. Open `/search?q=it153mydata` and confirm every seeded asset is listed (the unfiltered baseline).
3. Apply **My Objects** from the Filters sidebar; read the rendered rows.
4. Replace it with **Upstream of my data**; read the rows. Then **Downstream of my data**; read the rows.
5. With **Downstream** active, set the downstream depth to 2; read the rows.
6. Return to the catalog home page and click **View all** on the *My Objects* panel; read the landing URL and
   the rendered rows.

**Automated rail**: `integration-tests/run-suite.sh multi-stack` (or `run-suite.sh IT-153`).

## 5. What it checks — assertions

- **PASS** when: the baseline lists all seeded assets; `My Objects` lists exactly the owned entity **and the
  owned term**, and neither the unowned term nor `stranger`; `Upstream of my data` lists `up1` and not
  `down1`; `Downstream of my data` lists `down1` and not `up1`, and **not** the owned anchor itself; raising
  the downstream depth to 2 adds `down2` while the upstream set is unchanged; and the panel **View all** lands
  on `/search` carrying the matching `my_data` scope with the results narrowed to it.
- **FAIL** when: any scope returns an asset outside its set (a leak — the pre-ST-8 pass-through regression, or
  a lost predicate); the two directions return the same set (the anchor columns were swapped); the anchor
  appears in its own neighbour set; a depth change does not change the result (the parameter is not wired
  through); or the panel link lands on an unfiltered search.

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Log fields: `date · stack_commit · runner · outcome (PASS|FAIL) · evidence (the rendered row sets per scope) · notes`.

## Cross-references
- Source: `contributor/CTRIB-062.md` (ST-8 spec R1/R2/R3/R6), ADR `adrs/drafts/unified-asset-search.md` D4/D8
- Sibling: **IT-152** — the same feature's claims that need no identity (URL contract, retired tab strip,
  result count, and the DISABLED posture where this group is *hidden* rather than enabled)
- Case-law: `IT-055` / `IT-056` pin the silent-empty behaviour of the owner-anchored surfaces under DISABLED;
  this protocol is the positive counterpart on an authenticating stack.
