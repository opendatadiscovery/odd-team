---
id: CTRIB-016
github_issue_number: 1756
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1756
class: bug
status: review-ready
milestone: "0.28.0"
reproduced: "live 2026-06-16 on local odd-minimal, SUT image odd-platform:odd-team-sut built from the working tree (= origin/main @ 19618ea2; CTRIB-015 merged as #1787 — working tree identical to main, JooqFTSHelper byte-identical), postgres:13.2-alpine. POST /api/terms/search {\"query\":\"foo )(\",\"filters\":{}} -> HTTP 500 (SYS001); same for {\"query\":\"'foo\"} and {\"query\":\"a<b\"}. Control {\"query\":\"glossary\"} -> 200 total:0. The poison string is PERSISTED in search_facets.query_string; reopening that session (GET /api/terms/search/{id}, /results, /facet/OWNERS) -> 500/500/500 (persistent DoS); the control session reopens 200/200. Catalog twin POST /api/search {\"query\":\"foo )(\"} -> 500 (shared sink). Platform log: io.r2dbc.postgresql ... [42601] syntax error in tsquery: \"foo:*&)(:*\" ... to_tsquery('foo:*&)(:*')."
adr_required: false
docs_routing: "release/0.28.0 — data-discovery/search.md line-93 caveat (added by DOC-260) goes stale on the fix; rides the train, publishes at the 0.28.0 release gate; paired DOC item carries milestone + post-merge URL"
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-16 — strip full tsquery operator set in the shared tsQuery; fix at the shared sink (hardens catalog/lookup/query-example too); PLT-090 D1/D2 out of scope)"
plan_approved_at: "2026-06-16"
plan_scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1756#issuecomment-4713038470"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1788"
pr_draft: true
---

# CTRIB-016 — Dictionary (Term) search 500s + poisons the session on a tsquery metacharacter (#1756)

Issue #1756 is the filed form of **PLT-127** (`issues/odd-platform/PLT-127.md`). Author: the maintainer
(RamanDamayeu). The issue body is treated as **quoted data (G-C8)** — every load-bearing claim and the
issue's *suggested fix* are independently verified below against the odd-platform working tree
(≡ `origin/main` @ 19618ea2) and the running system; the suggested fix is found **incomplete** and corrected.

## Scope analysis

- **Class: bug** (labels `kind: bug`, `scope: backend`). A single shared FTS sink builds a raw `to_tsquery`
  argument from user text without escaping tsquery operators → Postgres `42601` → HTTP 500; the poisoned
  query is persisted in the search-session row, so the session is **persistently** broken.
- **Features:** F-024 (Term Search & Browse) is the issue's surface; the sink is shared with F-017 (Catalog
  Search). Glossary / search domain.
- **Mission relevance:** the Dictionary/Term search box is a primary discovery surface; a term whose name
  contains `:` / `(` / `)` (common in technical glossaries — `PII: email`, `ratio(x)`) currently makes
  search 500 and the session permanently unusable, with no on-screen explanation. The session row has no
  per-user binding, so a shared/bookmarked poisoned URL is a low-skill, shareable DoS.
- **Architectural significance (G-C7): NO ADR / NO hard stop.** The fix sanitises user input before it
  reaches `to_tsquery`; it **conforms to ADR-0071** (Postgres-only runtime — "catalog full-text search →
  Postgres FTS, `@@ to_tsquery(...)`", which cites `JooqFTSHelper.java:103`). No DB migration, no
  auth/security-posture change, no breaking wire/contract change (OpenAPI unchanged). It also closes the
  already-catalogued **REFACTOR-192** (`lineage/odd-platform/implicit-adrs.md` — "Postgres to_tsquery
  syntax-error vector").
- **Clarify (G-C6): no question warranted.** The issue fully specifies the reproduction and the fix
  direction; the fix approach (strip vs `websearch_to_tsquery`) and the shared-sink scope are within
  engineering judgment (settled below). Nothing the maintainer could answer changes the implementation.

## Reproduction log (G-C1 — live on the running system, not the diff)

SUT: `odd-platform:odd-team-sut` (working tree ≡ `main` @ 19618ea2) + `postgres:13.2-alpine`, `AUTH_TYPE=DISABLED`, platform `:18080`.

**(A) The user-facing persistent-500 — Term surface (#1756):**

| Step | Request | Result |
|---|---|---|
| control | `POST /api/terms/search {"query":"glossary","filters":{}}` | **200** `{search_id, total:0}` |
| poison | `POST /api/terms/search {"query":"foo )(","filters":{}}` | **500** `SYS001` |
| poison | `POST /api/terms/search {"query":"'foo","filters":{}}` | **500** — *the suggested regex misses `'`* |
| poison | `POST /api/terms/search {"query":"a<b","filters":{}}` | **500** — *the suggested regex misses `<`* |
| persist | `search_facets.query_string` after each | rows hold `foo )(`, `'foo`, `a<b` (verbatim) |
| reopen | `GET /api/terms/search/{poison_id}` · `/results` · `/facet/OWNERS` | **500 · 500 · 500** (persistent) |
| reopen | `GET /api/terms/search/{control_id}` · `/results` | **200 · 200** (`items:[]`) |
| catalog twin | `POST /api/search {"query":"foo )("}` | **500** (shared sink) |

Platform log on the poison: `io.r2dbc.postgresql ... [42601] syntax error in tsquery: "foo:*&)(:*" ... to_tsquery('foo:*&)(:*')` — confirming the query is **inlined** into the SQL (`ftsCondition` renders `field(...).toString()` and re-wraps via `condition(String)`; jOOQ doubles `'` so it is a tsquery *parse* DoS, not SQL injection — matching the issue's "DoS, not XSS" framing).

**(B) Root-cause + complete breaking-set, direct against postgres:13.2** (`docker exec probe-database psql`):

- `to_tsquery('foo:*&)(:*')` → ERROR 42601 ✓ · `to_tsquery('foo:*&:*')` (empty token from double/trailing space) → ERROR ✓ · `to_tsquery('a:b:*')` (colon term) → ERROR ✓.
- **Empty-query safety:** `to_tsquery('')` → empty tsquery (NOTICE, *not* error); `tsvector @@ to_tsquery('')` → `f`. So returning `""` for all-metacharacter input degrades to "No matches found", never a 500.
- **Full dangerous set** (fuzz ascii 33–126 as a token, both infix and leading): infix-dangerous `[!():<]`, leading-dangerous `[&'():<|]` → **union `! & ' ( ) : < |`**. The issue's / PLT-090's suggested regex `[()&|!*:]` **omits `'` and `<`** — verified above to still 500. The fix must strip the **complete tsquery operator set**.

## Root cause

`JooqFTSHelper.tsQuery(String)` (`JooqFTSHelper.java:164-168`) tokenises the user query on a single space,
appends `:*` to each token (prefix match), and joins with `&` (AND) — producing a raw tsquery string that
`ftsCondition` (`:100-105`) and `ftsRankField` (`:154-162`) feed to `to_tsquery`. It escapes **nothing**, so
any tsquery operator the user types (or an empty token from a double/leading/trailing space) raises `42601`.
The Term-search session persists the form/state to a `search_facets` row *before* the FTS read runs
(`TermSearchServiceImpl.search` → `create` → `getFacetsData` → `countByState`), so the poison survives the
500 and every later read of that `searchId` (`getFacets` / `getSearchResults` / `getFilterOptions`) re-runs
`to_tsquery` on it and 500s again until the housekeeping TTL evicts the row.

**`tsQuery` is a shared chokepoint** reached by FIVE surfaces — `ReactiveDataEntityRepositoryImpl` (Catalog /
PLT-090), `ReactiveTermRepositoryImpl` (Term / PLT-127, this issue), `ReactiveLookupTableRepositoryImpl`,
`ReactiveQueryExampleRepositoryImpl`, and the facet aggregators in `ReactiveSearchFacetRepositoryImpl`. One
fix at `tsQuery` closes the tsquery-poisoning DoS on all of them; there is no way to fix the Term surface
alone without either duplicating escaping logic per surface (anti-DRY) or fixing the shared method (correct).

## Design before build (G-C12)

- **(a) Reuse-scan.** Grep for an existing tsquery escaper / sanitiser / `websearch_to_tsquery` /
  `plainto_tsquery` across `odd-platform-api/src/main` → **none**. The fix lands in the single existing
  shared method `tsQuery(String)` that every FTS surface already calls — no new component is introduced, and
  all surfaces are hardened at once. (One-sentence justification for "new" code: there is nothing to reuse;
  the only correct place is the shared sink.)
- **(b) ADR-check.** `data-discovery/search.md` + the published **ADR-0071** (Postgres-only runtime; cites
  `JooqFTSHelper.java:103`) govern this area. The fix **conforms** — it keeps Postgres FTS + `to_tsquery` and
  prefix-match (`:*`) + AND (`&`) semantics, only sanitising the input. No deviation → no new ADR, no G-C7
  stop. Resolves the catalogued REFACTOR-192.
- **(c) Impact-dimension checklist.**
  - **i18n** — none. Backend-only; no new user-facing string. A metachar-only query now yields the
    *existing* "No matches found" empty state (no new copy).
  - **generated clients (BE+FE)** — none. OpenAPI unchanged (same endpoints/shapes).
  - **every consumer** — the change is internal to `tsQuery(String)`; all five repository callers keep their
    signatures and only receive a sanitised string. All call sites guard `StringUtils.isNotEmpty(query)`
    before calling, so the new empty-string return is reached only for all-metachar input (verified safe).
    Behaviour delta is strictly: metachar query `500` → results/empty. Zero change for normal queries
    (no special chars → byte-identical output).
  - **migration** — none.
  - **docs** — `data-discovery/search.md:93` "Avoid the characters `( ) & | ! * :` … HTTP 500" caveat (added
    by DOC-260, `status: done`, live on `main`) goes **stale** on the fix. Routed to the `release/0.28.0`
    train (G-C11) + a paired `pending-release` DOC item; also check the dictionary/glossary page for a twin
    caveat. The live manual keeps the true caveat for the *current* release.
  - **ontology** — the sidecars/reflections describing the no-escape behaviour (F-017 H-007, F-024 H-009,
    any `JooqFTSHelper` node) go stale → `/enrich --touched` + re-embed + commit (G-C10).
  - **tests** — both buckets (below).
- **(d) Product-Owner / SRE lens.** Bug fix, not feature-shaped — no new affordance. Operator value (self-
  evident, no `odd-sme` spawn warranted per "minimal resources, maximum value"): an SRE searching the
  Dictionary for a real term name with a `:`/`(` no longer hits a permanently-broken search; better, the
  metachar is treated as a separator (`user(id)` → `user:* & id:*`), so the term actually becomes findable
  rather than merely "not 500". The empty-state for an all-operator query ("No matches found") is the sane
  default and strictly better than a 500.

## The plan

**The fix (one method, the shared sink):** strip the complete tsquery operator set in `tsQuery(String)`,
preserving the existing tokenise + prefix-match (`:*`) + AND (`&`) semantics; drop empty tokens; null/blank
→ `""` (matches nothing, no 500).

```java
import java.util.regex.Pattern;

// to_tsquery parses its argument as a tsquery expression; any of these reaching it
// unescaped raises Postgres 42601 -> HTTP 500 (and, persisted in the search-session
// row, a persistent 500 until TTL eviction). Empirically (postgres:13.2) the set that
// can raise 42601 in some position is ! & ' ( ) : < | ; strip the full tsquery operator
// set (also * > \) so only word tokens reach to_tsquery. (PLT-127 / PLT-090 / #1756)
private static final Pattern TSQUERY_SPECIAL_CHARS = Pattern.compile("[!&'()*:<>|\\\\]");

public String tsQuery(final String plainQuery) {
    if (plainQuery == null) {
        return "";
    }
    return Arrays.stream(TSQUERY_SPECIAL_CHARS.matcher(plainQuery).replaceAll(" ").split(" "))
        .filter(queryPart -> !queryPart.isEmpty())
        .map(queryPart -> queryPart + ":*")
        .collect(Collectors.joining("&"));
}
```

**Scope EXCLUSIONS (deliberately NOT touched — G-C5):**
- **PLT-090 Defect 1** (search_facets has no owner binding — schema migration) and **Defect 2** (cross-owner
  facet enumeration — security rule) are **out of scope**. They are separate, larger changes (a destructive-
  adjacent migration + an auth-posture change = G-C7 territory) tracked under PLT-090; this PR is the
  tsquery-poisoning fix only.
- The `ftsCondition` `field(...).toString()` + `condition(String)` inline-and-reparse pattern is a latent
  smell but is **not** the bug (jOOQ escapes the quote; it is a tsquery-parse DoS). Not refactored here —
  noted as a possible follow-up, logged on disk if pursued (`playbooks/follow-up-on-disk.md`), not in this PR.
- **PLT-109 / GHSA-rjp9-9vgm-q94c** (the `ts_headline` `String.formatted` SQL-injection) is a different sink,
  out of scope.

**Incidental (NOT scope creep, stated for transparency):** because the fix is at the shared sink, it also
closes the tsquery-poisoning DoS on the Catalog (`/api/search` — PLT-090 D3), Lookup-Table, and
Query-Example surfaces. This is the minimal correct fix, not an added scope. The PR body + the issue scope
comment will say so explicitly.

**Tests — both buckets (G-C9):**
- **Unit (odd-platform CI, `./gradlew build`):**
  1. `JooqFTSHelperTest` (pure, no Spring) — parameterised over the dangerous chars + the documented `foo )(`
     + `'foo` + `a<b` + empty/blank/double-space; asserts the output carries no tsquery operator and the
     all-operator/empty cases return `""`. Pins the contract + gives deterministic branch coverage of the
     changed method (the local 98% patch-coverage gate, G-C13).
  2. A `BaseIntegrationTest` (in-process Testcontainers `postgres:13.2-alpine` — the *unit* bucket) that
     drives the real Term-search repository path (`getQuerySuggestions` / `findByState`) with a poison query
     and asserts **no error + graceful result** via `StepVerifier`. **RED pre-fix** (42601), **GREEN
     post-fix** — the failing condition (the metacharacter) injected explicitly. Mirrors
     `ReactiveTermRepositoryCrossNamespaceLinkTest`.
- **Integration (odd-team, `run-suite.sh`):** **reuse the existing `IT-003`** (`search-tsquery-poisoning.spec.ts`,
  `regresses: [PLT-090, PLT-127]`, currently `known-bugs`/RED-expected). The fix flips both its catalog +
  dictionary cases GREEN; then move IT-003 from the `known-bugs` suite into `feature-complete` (its protocol
  already prescribes this) and update the protocol's `expected_result`/`status`. Optionally strengthen the
  spec with the `'foo` payload (the case the naive fix misses). No new IT authored.

**Docs (G-C10 + G-C11):** revise the now-stale `data-discovery/search.md:93` caveat on the **`release/0.28.0`
train** (sync-first; create from `origin/main` if absent; same-name push) + a paired backlog **DOC item**
(`milestone: 0.28.0`, affected page, expected post-merge URL, status `pending-release`). Check the
dictionary/glossary page for a twin caveat. Never on docs `main` (the bug is real for the current release).

**Ontology (G-C10):** `/enrich --touched` on the `JooqFTSHelper` / F-017 / F-024 nodes + re-embed + commit.

**Definition of Done (the five gates before the PR leaves `draft`):** full unit build green on the branch ·
FULL integration regression on the working-tree SUT (`feature-complete` green incl. the flipped IT-003 +
`multi-stack` green + `known-bugs` still-RED for the rest + `ingestion-e2e` green) · docs read + decided +
routed · ontology re-enriched + committed · Principal sufficiency (G-C13) incl. the local 98% patch-coverage
gate.

## Drafted issue comment (root-cause + scope — posts after GATE 1, before any code; G-C5)

ASCII, self-contained, no workspace-internal IDs. One combined root-cause+scope comment (github-write rate-limit; the scope comment is required because the PR's shared-sink fix is broader than the stated Term surface yet defers PLT-090's other defects).

```text
Root cause and fix plan (odd-team contributor)

Reproduced on a local 0.28.0-candidate stack (odd-minimal, postgres 13.2, auth
DISABLED), working tree = main:

- POST /api/terms/search {"query":"foo )(","filters":{}} -> HTTP 500. Same for
  {"query":"'foo"} and {"query":"a<b"}; control {"query":"glossary"} -> 200.
- The typed query is persisted into the search_facets session row, so reopening
  that session (GET /api/terms/search/{id}, /results, /facet/OWNERS) returns
  500/500/500 again -- a persistent, shareable break, not a one-shot error.
- Server log: [42601] syntax error in tsquery: "foo:*&)(:*" from
  to_tsquery('foo:*&)(:*').

Root cause: JooqFTSHelper.tsQuery(String) tokenises the query, appends ':*',
joins with '&', and feeds the result to to_tsquery(...) with no escaping of
tsquery operators. Any operator the user types (or an empty token from a
double/leading/trailing space) raises Postgres 42601 -> HTTP 500. This is a
denial-of-service via a parse error -- not SQL injection (jOOQ escapes the
string literal) and not XSS.

tsQuery is the single shared sink for catalog search, term/dictionary search,
lookup-table search, query-example search, and the facet aggregators, so one fix
hardens all of them.

Operator-set note: the empirically complete set of characters that can raise
42601 against postgres 13.2 is  ! & ' ( ) : < |  (verified by fuzzing each char
in both leading and infix position). A query starting with an apostrophe, or
containing '<', 500s too -- so the fix strips the full tsquery operator set, not
only ( ) & | ! * : .

Planned fix (bounded to this issue): sanitise inside tsQuery -- strip the full
tsquery operator set, keep the existing prefix-match (':*') and AND ('&')
behaviour, drop empty tokens. A metacharacter then becomes a word separator (so a
real name like user(id) searches user AND id and actually matches), and an
all-operator query returns "No matches found" instead of a 500. Conforms to the
Postgres-FTS design; no schema or API-contract change.

Tests: a unit test on the sanitiser + an in-process Testcontainers DB test that
drives the term-search path with a metacharacter (red before, green after), plus
a browser e2e that drives /termsearch and /search and asserts no 5xx on submit
and on reopen.

Scope of this PR: the tsquery-poisoning 500 only. The broader search-session
hardening -- binding the search_facets session row to an owner, and scoping
cross-owner facet enumeration -- is deliberately out of scope here (a schema
migration + an auth-posture change) and stays tracked separately. This PR will be
opened as a draft; a maintainer reviews and merges.
```

**Posted:** GATE-1-approved root-cause+scope comment → https://github.com/opendatadiscovery/odd-platform/issues/1756#issuecomment-4713038470 (HTTP 201, by `odd-contributor[bot]`).

## Execution ledger (Phase D)

- **Branch:** `contrib/CTRIB-016-tsquery-escape` (from `origin/main` @ 19618ea2). **Fix commit:** `2cb86c29` — `JooqFTSHelper.java` (+ the static `TSQUERY_SPECIAL_CHARS` field, the import) + 2 test files.
- **The fix:** `tsQuery` strips `[!&'()*:<>|\\]` → space, tokenises, drops empty tokens, appends `:*`, AND-joins; null/blank → `""`. Verified end-to-end against postgres 13.2: every input (poison + normal + all-operator) parses cleanly; normal queries byte-identical; `to_tsquery('')` is safe (matches nothing).

### Tests — both buckets (G-C9)
- **Unit `JooqFTSHelperTest`** (pure) — 14-case `@MethodSource` over the full operator set incl. `'`/`<` + null/empty/all-operator + the no-dangerous-operator assertion. **GREEN with fix; RED without** (stash-the-fix proof: every sanitiser case `AssertionFailedError`).
- **Unit/Testcontainers `ReactiveTermSearchTsQueryPoisonTest`** (`BaseIntegrationTest`, postgres:13.2) — drives the real term-search repo path with poison queries (`foo )(`, `'foo`, `a<b`, …) + a metachar-named-term findable case. **GREEN with fix; RED without** (42601 → `onError`). Confirmed in the full build (SQL log shows `to_tsquery('foo:*')`, `to_tsquery('')` as bind params, no 42601).
- **Integration e2e `IT-003`** (`search-tsquery-poisoning.spec.ts`) — REUSED + flipped `known-bugs` → `feature-complete` + `ui-e2e` (suites.yaml) + protocol `expected_result` updated. Both cases **GREEN** in the regression run below (was RED on the 2026-06-10 known-bugs run-log).

### Full regression — working-tree SUT `odd-platform:odd-team-sut` @ 2cb86c29 (G-C2)
- **Unit:** `scripts/run-platform-tests.sh` (full `:odd-platform-api:build` = test + checkstyle + assemble + jacoco) → **BUILD SUCCESSFUL** (6m24s).
- **Integration `feature-complete`:** **295 passed (4.7m), 0 failed** — incl. IT-003 #261 (catalog) + #262 (dictionary, the issue's surface) both ✓.
- **Integration `known-bugs`:** **3 failed (expected-RED)** — IT-004/006/007 still RED, NO surprise GREEN; IT-003 absent (tsquery mentions: 0). Correct.
- **Integration `multi-stack`:** **9 passed (3.6m), 0 failed** (IT-008 MinIO, IT-009 LOGIN_FORM, IT-010 LDAP, IT-011/012 notifications WAL, IT-123 session cookie, IT-124 RBAC policy).
- **Integration `ingestion-e2e`:** **6 passed (1.2m), 0 failed** (IT-128 relationships pipeline: neo4j GRAPH + postgres ERD → collector → platform → UI).
- These last two exercise auth/storage/notifications/collector subsystems with NO shared code path to `tsQuery`; the blast radius (every FTS surface) is fully covered by the green full-unit-build + `feature-complete`. Run regardless to honour the full-regression directive — all green.
- **Post-fix re-drive (running fixed SUT @ 2cb86c29):** the exact pre-fix-500 payloads now return 200 — term-search `foo )(` / `'foo` / `a<b` / `()&|!*:<>` → 200; catalog `/api/search foo )(` → 200; **zero 42601** in the container log. The before→after on the running system is complete.

### Patch coverage (G-C13) — verified LOCALLY
- The CI gate is `Madrapps/jacoco-report` (`min-coverage-changed-files: 98`) reading `jacocoTestReport.xml`. `build.gradle:187` excludes `**/repository/**` from the report (the jOOQ DSL layer — covered by Testcontainers, not unit-coverage-measured). `JooqFTSHelper` (in `repository.util`) is therefore **excluded from the coverage report by design** → the changed-files gate does not measure it and cannot fail CI on it. Confirmed by reading the exclusion list + the report (JooqFTSHelper absent). Sufficiency is met by the tests themselves (unit + Testcontainers + e2e), not the gate.

### Docs (G-C10 + G-C11) — routed to the release train
- Live `data-discovery/search.md:93` "Avoid the characters `( ) & | ! * :` … HTTP 500" caveat (added by DOC-260) made stale by the fix. **Revised** (warning → info: stripped-as-separators, catalog + Dictionary, pre-0.28.0 500 as a historical note) on the documentation **`release/0.28.0`** worktree `/tmp/doc-release-028` @ **53ee9e3** (NOT docs `main` — the bug is real for the current release). Paired backlog **DOC-460** (`pending-release`, milestone 0.28.0, post-merge URL). Maintainer pushes the train at the release gate.

### Ontology (G-C10)
- `ReactiveTermRepositoryImpl` sidecar (the per-node sidecar) — JooqFTSHelper-coupling entry updated to the operator-stripping behaviour + the FIXED note. F-024 reflection **H-009** (the issue's cited evidence) — RESOLVED note (the pending probe was RUN: the throw IS real on the term path; fixed). F-017 reflection **H-007** (catalog twin) — scoped RESOLVED note (tsquery-DoS half fixed; PLT-109 + PLT-090 D1/D2 remain). Graph **re-embedded** (`lineage-extractor graph-build odd-platform` → vectors=8019, `BAAI/bge-small-en-v1.5`); the graph layer is gitignored/ephemeral, so the canonical sidecar/reflection text is what is committed (it rebuilds from those).

### Draft PR (Phase E)
- **PR #1788** (DRAFT): https://github.com/opendatadiscovery/odd-platform/pull/1788 — `Closes #1756`, author `odd-contributor[bot]` (GitHub blocks self-approval → GATE 2 is structural). Body carries the root-cause + change + scope-exclusions + test/running-system evidence + `Milestone: 0.28.0` + the `Docs: documentation@release/0.28.0` note.

### DoD (the five gates) — ALL MET
1. **full unit build green** ✓ (BUILD SUCCESSFUL 6m24s). 2. **full integration regression** ✓ — `feature-complete` 295✓ (IT-003 both cases flipped GREEN) + `known-bugs` 3-expected-RED (IT-003 absent) + `multi-stack` 9✓ + `ingestion-e2e` 6✓, all on the branch-built SUT @ 2cb86c29. 3. **docs** read + revised + routed (release/0.28.0 @ 53ee9e3 + DOC-460) ✓. 4. **ontology** re-enriched (sidecar + F-024 + F-017) + re-embedded ✓. 5. **Principal sufficiency** ✓ — unit (full operator set) + Testcontainers (RED→GREEN) + e2e (browser, no 5xx) tests are enough + meaningful; local patch-coverage gate is N/A by design (`repository/**` excluded from jacoco) and verified so locally; no control lost; the FULL regression proves no existing functionality harmed; not a UI change (no new surface/affordance — the e2e is the user-facing proof, so the G-C12-step-5 screenshot does not apply).

Status: **review-ready** (the contributor cannot self-merge — GATE 2 is the maintainer's `/review` + merge).
