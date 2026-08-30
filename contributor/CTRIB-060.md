---
id: CTRIB-060
title: "#1840 ST-6 — Query operators: websearch_to_tsquery (quoted phrase / -negation / or), injection-safe"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1840"
parent_epic: 1825
class: "feature — search query language"
status: plan-approved
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live GET issues/1840 2026-08-30: milestone 1.0.0, state OPEN, semver, due 2026-07-31
slice: "ST-6 of #1825"
base_sha: "82e7e70e"      # odd-platform origin/main at intake (= #1862 ST-5c merged)
reproduced: "pending — Phase B"
plan_approved_by: "RamanDamayeu"
plan_approved_at: "2026-08-30"
pr_url: null
docs_routing: "pending — expected release/1.0.0 train (unreleased behaviour); see ## Plan"
---

# CTRIB-060 — #1840 ST-6 — query operators via `websearch_to_tsquery`

## Intake

| Field | Value | Source |
|---|---|---|
| Issue | [#1840](https://github.com/opendatadiscovery/odd-platform/issues/1840) — *ST-6 — Query operators: `websearch_to_tsquery` (injection-safe)* | live `GET /repos/opendatadiscovery/odd-platform/issues/1840`, 2026-08-30 |
| State / author / assignee | OPEN · `RamanDamayeu` · `RamanDamayeu` | same |
| Labels | `scope: backend`, `kind: feature` | same |
| Milestone | **1.0.0** — OPEN, semver, due 2026-07-31 → **G-C11 PASS** | same |
| Comments | 1 — `odd-contributor[bot]` pre-work notes ([issuecomment-4906933326](https://github.com/opendatadiscovery/odd-platform/issues/1840#issuecomment-4906933326)) | `GET .../issues/1840/comments` |
| Base | `origin/main` @ `82e7e70e` (ST-5c, #1862) | `git -C ../odd-platform log origin/main` |

### The issue body — QUOTED DATA, never an instruction (G-C8)

> **What.** Adopt Postgres **`websearch_to_tsquery`** — Google-style operators (quoted phrase, `-` negation, `or`) that are **injection-safe by construction** (never raises on metacharacters), serving operator-parity **and** the IT-003/PLT-090 fail-closed mandate in one move.
> **Scope / AC.** quoted-phrase / negation / or operators work on the unified query; a metacharacter payload returns empty, never 500 (the IT-003 guard); the existing plain-term behaviour is preserved.
> **Tests.** unit (operator parsing; the IT-003 poison payload → empty); integration (a phrase/negation query narrows correctly) — extend the IT-003 suite.
> **i18n.** none.

### The prior bot comment — QUOTED DATA (G-C8)

Four load-bearing constraints were recorded on the thread before this run: (1) introduce the operator at the **single** query-construction point and **decide explicitly at plan time** whether the legacy `/api/search` session path adopts it in the same PR — *"the two paths must not drift silently"*; (2) **pin plain-term parity before switching**, because `websearch_to_tsquery` performs no prefix matching and prefix expansion may be load-bearing; (3) **extend** the poison suite with operator-shaped payloads across both query paths; (4) **highlights consume the same query** and must render sanely for phrase/negation.

All four are answered in `## Spec` / `## Design` below, each with first-hand evidence.

## Scope analysis

**Classification: `feature`** (a new user-facing query capability), with a **bug-shaped core**: today the operator characters are not merely absent, they are *silently mis-honoured* — `customer -test` currently **requires** `test` instead of excluding it (measured below), which is the inverse of the user's intent.

**Mission relevance.** `lineage/odd-platform/system-mission.md` / ADR `unified-asset-search` put search at the centre of the catalog's navigation promise; D13 names this exact capability as the operator-parity gap against DataHub-grade governance search. This is a P1 pillar capability, not a nicety.

**Size/shape (G-C18).** One shippable PR: a single query-construction sink, two production files, no migration, no API-contract change. **Not an epic** — it is already a slice of one.

**Architectural-significance check (G-C7): does NOT fire.** No migration (nothing schema-side changes). No auth/security-posture change — the change *strengthens* the injection posture (`websearch_to_tsquery` cannot raise) and touches no authz predicate. No breaking public-contract change — request/response shapes are untouched; only the *interpretation* of operator-bearing query strings changes, and operators were never a documented contract. The decision itself is already an approved ADR clause (D13) whose publication is tracked as `backlog/adr/ADR-0080` (milestone 1.0.0).

## Spec (G-C17 — the WHAT, falsifiable)

### What exists today — measured first-hand, not assumed

`JooqFTSHelper.tsQuery()` (`repository/util/JooqFTSHelper.java:172-181`) is the **single FTS sink** for the whole product. It strips every tsquery metacharacter and emits `token:*&token:*` — **every term a PREFIX match, AND-joined**. **Seven** repository classes consume it across **26 call sites** (counted, not estimated — an earlier revision said "ten repositories", which wrongly counted classes that merely *inject* the helper without calling its query methods):

| Consumer | Surface |
|---|---|
| `ReactiveAssetSearchRepositoryImpl:265,369` | the unified `/api/search/assets` list + count + relevance rank (ST-4/5) |
| `ReactiveSearchFacetRepositoryImpl:120,148,185,270,472,662` | the legacy `/api/search` results **and the facet counts** |
| `ReactiveDataEntityRepositoryImpl:451,480,491,792,916,921` | legacy DE search, `countByState`, **autocomplete suggestions**, **`ts_headline` highlights** |
| `ReactiveTermRepositoryImpl:254,264,291,297,383` | term search + term suggestions |
| `ReactiveQueryExampleRepositoryImpl:84,103,109` + `ReactiveQueryExampleSearchEntrypointRepositoryImpl:101,109` | query-example search |
| `ReactiveLookupTableRepositoryImpl:119,137,143` | lookup-table search |

**Measured on a real `postgres:13.2-alpine`** — the version odd-platform deploys (`docker/*.yaml`, `BaseIntegrationTest:26`) — with `default_text_search_config = pg_catalog.english`:

| The user types | Today's tsquery | `websearch_to_tsquery` | Consequence today |
|---|---|---|---|
| `customer orders` | `'custom':* & 'order':*` | `'custom' & 'order'` | same intent; **today additionally prefix-matches** |
| `cust` | `'cust':*` → **HITS** "Customers" | `'cust'` → **MISSES** | prefix expansion is load-bearing |
| `"customer orders"` | `'b':*`-style word AND — **quotes silently ignored** | `'custom' <-> 'order'` | phrase intent is discarded |
| `customer -test` | `'custom':* & 'test':*` — **the dash is ignored, so `test` is REQUIRED** | `'custom' & !'test'` | **the result is the inverse of the intent** |
| `customer or orders` | `'custom':* & 'order':*` — AND | `'custom' \| 'order'` | OR intent is discarded |

**Fail-closed audit (first-hand).** 42 punctuation/metacharacter inputs run through an exact emulation of today's sanitiser then `to_tsquery`: **0 raised**. The #1756 guard holds; this slice must not regress it. `websearch_to_tsquery` raised on **none** of them either, and an empty tsquery matches nothing (`f`) on both paths — fail-closed on both sides.

**Index-searchability (first-hand, GIN-indexed 55 000-row table).** Positive AND, phrase, and positive+negation queries all plan as **Bitmap Index Scan**. A query with **no positive term** (`-test`, `customer or -test`) plans as a **Seq Scan** — `querytree()` returns `T`. This hazard does not exist today (the dash is ignored) and would be *introduced* by this change, so neutralising it is in scope.

### Requirements (current → target → acceptance)

| # | Requirement | Current | Target | Acceptance (how a human verifies) |
|---|---|---|---|---|
| **R1** | Quoted phrase | quotes ignored → both words anywhere | `"customer orders"` matches only adjacent occurrence | seed `customer orders daily` + `orders from customer`; the query returns only the first |
| **R2** | Negation | dash ignored → the term is **required** | `customer -test` excludes test-matching assets | seed `customer table` + `customer test table`; returns only `customer table` (on `main` it returns only `customer test table` — an inverted RED) |
| **R3** | `or` | AND | `customer or orders` returns either | seed `customer table` + `orders table`; returns **both** (today: neither) |
| **R4** | Plain-term parity | prefix + AND on every surface | **behaviourally identical** (the emitted SQL does change — see Design (e) — but an operator-free query still compiles to the one pre-existing `to_tsquery(tsQuery(q))` call) | `cust` still finds `Customers`; `customer orders` still ANDs; every pre-existing search/suggestion/highlight test stays green **unmodified** |
| **R5** | Fail-closed | metacharacters → page, never 500 | unchanged **and extended** to operator-shaped payloads (unbalanced quote, trailing dash, bare `or`, mixed) on unified **and** legacy paths | the extended poison set returns a page (possibly empty) on both endpoints |
| **R6** | Index-searchability | n/a | a query with no positive term returns an empty page via an index probe | `-test` returns 0 results; `EXPLAIN` shows an index scan, not a Seq Scan |
| **R7** | One query language | n/a | result list, total, **facet counts**, ranking and **highlights** all interpret the query identically | for the **data-entity subset** (the sidebar counts read the DE-only `search_entrypoint` while the list reads `asset_search_entrypoint`; cross-kind facet counts are ST-11), an operator query's facet counts agree with the DE rows listed |

**In scope:** the shared FTS sink and every surface it feeds; the `ts_headline` highlight expression; unit + integration tests; the user-facing docs section.

**Explicitly OUT of scope (G-C5):** facet AND/OR/negation logic (**ST-11**); cross-kind highlight parity (**ST-12** — this slice only keeps the *existing* DE highlight coherent); retiring the legacy `/api/search` path (**P4 / D9**); ranking-function or FTS-weight changes; any migration or index change; the OpenAPI contract (unchanged).

### Ambiguity score

| Dimension | Score | Min | Basis |
|---|---|---|---|
| Goal clarity | 0.95 | 0.75 | the three operators are named in the issue **and** measured against a real PG 13.2; each has a seeded, falsifiable acceptance |
| Boundary clarity | 0.90 | 0.70 | the ten consumers are enumerated `file:line`; ST-11/ST-12/D9 exclusions are explicit |
| Constraint clarity | 0.90 | 0.65 | PG version verified; prefix-loss, Seq-Scan, and fail-closed constraints measured, not assumed |
| Acceptance clarity | 0.90 | 0.70 | every requirement has a seed→assert acceptance runnable in the existing harness |

`ambiguity = 1 − (0.35·0.95 + 0.25·0.90 + 0.20·0.90 + 0.20·0.90) = 0.0875` → **PASS** (≤ 0.20, all minimums met).

**Residual carried to GATE 1 (not a fishing question):** whether ST-6 also ships a *discoverability* affordance for the new syntax (see `## Product critique`). Everything else was resolved from source.

## Product critique of the change request (G-C16)

**The user-observable problem, stated independent of the issue's proposed solution:** an operator who types `"exact phrase"`, `-exclude`, or `a or b` into ODD's search box gets a result set that silently contradicts what they asked for — most sharply for negation, where the excluded word becomes a *required* word.

**Is the capability right?** Yes. The alternatives to "give the search box operators" are worse: a hand-rolled operator parser re-opens the #1756/PLT-090 injection surface this project already paid for; plain `to_tsquery` with escaping raises on malformed input by design; doing nothing leaves a measured inverted-result defect on the catalog's primary navigation surface.

**Where the issue's framing needs correcting — two findings, neither silently absorbed.**

**(i) The unit of change is the sink, not "the unified query".** The issue scopes the change to *"the unified query"*. That is not implementable as stated without producing a contradiction: the sidebar **facet counts** on the unified search page are computed by `ReactiveSearchFacetRepositoryImpl` through the *same* sink. Applying operators to the result list but not to the count path makes the count badge disagree with the list for every operator query — the front-end/back-end contradiction class this workspace has case-law on (PLT-176). The correct unit is **the sink**, which also answers the pre-work comment's explicit plan-time question: the legacy path adopts it too, so the product has **one** query language. This *reduces* the diff (one method changed, not a second dialect added).

**(ii) The named mechanism costs a published promise.** SME consult `lineage/odd-platform/sme-consultations/2026-08-30-search-query-operators.md` (confidence HIGH) plus my own measurements establish that `websearch_to_tsquery` **performs no prefix matching**, and:

- **ODD publishes the opposite promise, today, on a live page.** `documentation/docs/data-discovery/search.md:93` states verbatim that the search box *"strips them and matches the remaining words **as prefixes**"*. Adopting `websearch_to_tsquery` per-query silently revokes that for any query containing an operator. *(Verified first-hand by reading the file, not taken from the consult.)*
- **The refinement flow breaks.** Operators are typed **second**, as a refinement. `cust` finds "Customers Orders"; `cust -test` then returns **zero rows**. The act of refining destroys the result set.
- **The cited precedent does not do this.** DataHub's quoting is documented as **per-term** ("enclosing one or more terms with double quotes will enforce exact matching on *these terms*"), and its prefix is an explicit `*` the user types — never a behaviour the system revokes as a side effect.
- **Autocomplete and highlights are two of the 26 call sites.** `getQuerySuggestions` must stay prefix unconditionally, and if matching goes exact while highlighting stays prefix, the result row's already-shipped "why you see it" affordance starts lying.

The SME asked that "can prefix be preserved alongside operators?" be **established, not assumed**, before accepting the per-query switch. It has been — see `## Design (c)`. It can, safely. That makes the mechanism the one real GATE-1 decision (`## GATE 1`).

**Discoverability.** Operators nothing tells you about are close to non-existent. ODD already ships the two affordances needed — `InformationIcon` + `AppTooltip` (ADR-0076) and the documented per-result "why you see it" icon. Carried as a sub-option of the GATE-1 decision; it is the only i18n-bearing part of this slice.

## Design (G-C12 — the HOW, decided before any code)

**(a) Reuse scan.** `JooqFTSHelper` is the existing single sink; there is no second FTS query builder (`git grep` for `to_tsquery|plainto_tsquery|websearch_to_tsquery|phraseto_tsquery` over `origin/main` returns only `JooqFTSHelper`, `ReactiveAssetSearchRepositoryImpl`, `ReactiveDataEntityRepositoryImpl` and their tests). **Reuse it; add no new component.**

**(b) ADR check.** `adrs/drafts/unified-asset-search.md` **D13** names `websearch_to_tsquery` — and flags itself *"(MEDIUM — verify the operator surface + the IT-003 interaction in implementation.)"*. That verification is this slice, and it returns a correction: D13's **intent** (Google-style operators, injection-safe by construction) is fully served by the recommended mechanism; its **named function** is not the one that serves it. The correction is recorded here and folded into `backlog/adr/ADR-0080` (the tracked publication of the epic's decision, `promoted_from: … D1..D13`) rather than opening a parallel ADR. **G-C7 does not fire** — no migration, no authz change, no breaking contract.

**(c) The mechanism — measured, not assumed.**

Every finding below was produced first-hand on a throwaway `postgres:13.2-alpine` (the deployed version), against a 55 000-row GIN-indexed table:

| Question | Measured answer |
|---|---|
| Does `websearch_to_tsquery` keep prefix? | **No.** `cust` HITS "Customers" today, MISSES under websearch |
| Can prefix be re-attached to `websearch_to_tsquery(...)::text` by regex? | **Yes, but unsafely** — it also prefixes negated terms (`-test` starts excluding "testimonial") and phrase members, and its safety rests on an unprovable invariant about lexeme serialization (a lexeme containing quote-then-space would splice `:*` mid-lexeme → `42601` → the exact #1756 persistent-500) |
| Can the operators be built compositionally instead? | **Yes.** `to_tsquery('cust:*') && !!plainto_tsquery('test')` → `'cust':* & !'test'`; `phraseto_tsquery('customer orders') && to_tsquery('dai:*')` → `'custom' <-> 'order' & 'dai':*` |
| Do `phraseto_tsquery` / `plainto_tsquery` raise on poison? | **Never** — `()&|!*:<>` → empty on both, like `websearch_to_tsquery` |
| Does an empty leaf annihilate the composition? | **No** — the empty tsquery is the identity for `&&` and `||` (`'' && 'cust':*` → `'cust':*`) |
| Do the composed shapes use the GIN index? | **Yes** — Bitmap Index Scan for AND, OR, phrase, and positive+negation |
| What is *not* index-searchable? | A query with **no positive term** (`-test`, `customer or -test`, and the subtle `<stopword> -test`) → `querytree() = 'T'` → **Seq Scan**, measured |

**The design — operators narrow; they never revoke prefix.**

```
buildTsQueryExpression(q):
  no operator token        -> to_tsquery( tsQuery(q) )                 # TODAY'S PATH, byte-identical, one SQL call
  otherwise:
    groups = split on the bare word `or`                               # AND binds tighter than OR (websearch parity)
    per group, AND (&&) together:
        all positive bare terms -> to_tsquery( tsQuery(joined) )       # ONE call -> PREFIX PRESERVED, O(1) SQL
        each quoted phrase      -> phraseto_tsquery(P)                 # exact adjacency
        each negated term       -> !! plainto_tsquery(T)               # exact exclusion (under-exclude, never over-exclude)
        each negated phrase     -> !! phraseto_tsquery(P)
    expr = OR (||) of the group expressions
    guard: CASE WHEN querytree(expr) = 'T' THEN CAST('' AS tsquery) ELSE expr END
```

Why this shape:

- **Prefix survives per term.** The published promise at `search.md:93` stays true; `cust -test` still finds "Customers".
- **The plain path is reused, not reimplemented** — inside an operator query the bare terms go through the *same* `tsQuery()` call the non-operator path uses, so parity is structural.
- **No serialization surgery.** Every leaf is a Postgres constructor that provably never raises, applied to a **bound parameter**. The injection surface is strictly smaller than today's (which renders the sanitised query into a SQL string and re-parses it).
- **Bounded SQL text.** Leaf count grows with *operator* count, not token count; a cap (16 operator leaves) falls back to the plain path so an adversarial query cannot inflate the SQL.
- **The `querytree` guard is required, not decorative** — it is the only thing that catches `<stopword> -test`, which Java-side token inspection would wrongly classify as having a positive term.

Grammar parity with `websearch_to_tsquery` was checked case-by-case on PG 13.2 so the operators behave the way the function the issue named would: `foo -bar` **and** `foo - bar` both negate; `my-table`, `e-mail`, `2024-01-01`, `trailing dash -` do **not**; `Or` operates but `oracle`, `ORdering`, `sales_or_ops` do not; an unterminated quote runs to end-of-input.

**The tokenizer grammar — every row measured against `websearch_to_tsquery` on PG 13.2, so the operators behave the way the function the issue named would.**

| Input | `websearch_to_tsquery` | The tokenizer must |
|---|---|---|
| `foo -bar` / `foo - bar` | `'foo' & !'bar'` | negate in both forms (a `-` at a token boundary followed by a term) |
| `my-table`, `e-mail`, `2024-01-01` | no negation | treat a mid-word `-` as part of the token |
| `trailing dash -` | no negation | a `-` with no following term is a literal |
| `Or` / `OR` | operator | match `or` case-insensitively, whole-token only |
| `oracle`, `ORdering`, `sales_or_ops` | no OR | never match `or` inside a token |
| `or or`, `foo or or bar` | empty · `'foo' \| 'bar'` | tolerate empty OR-groups (they contribute the identity) |
| `"a or b"` | `'b'` | inside a quoted span, `or` is a literal word |
| `"foo -bar"` | `'foo' <-> 'bar'` | inside a quoted span, `-` is a literal |
| `""`, `"" foo` | empty · `'foo'` | an empty phrase contributes the identity, not a match-nothing |
| `-"foo bar"` | `!( 'foo' <-> 'bar' )` | support a negated phrase |
| `"unbalanced` | `'unbalanc'` | an unterminated quote runs to end-of-input |
| `customer "orders daily" -test or ref` | `'custom' & 'order' <-> 'daili' & !'test' \| 'ref'` | AND binds tighter than OR; groups split on `or` |

**(d) Impact-dimension checklist.**

| Dimension | Disposition |
|---|---|
| i18n (7 locales) | none if no UI string ships; the GATE-1 discoverability sub-option adds one key × **all 7** locale files — handled here, never en-only |
| Generated BE/FE clients | **no regen committed** — the only spec edit is a `description` on `SearchFormData.query`; request/response shapes are unchanged and generated sources are gitignored. The BE build does not track `$ref`'d `components.yaml`, so `build/generated` is cleared once to prove the spec still compiles |
| Consumers of changed signatures | `ftsCondition`/`ftsRankField`/`tsQuery` signatures **unchanged**; all ten consumers inherit the behaviour by design — that is the point. `getHighlightedResult` builds its own `to_tsquery(?)` and is edited onto the shared expression (R7) |
| Migrations | **none** |
| Stored query text (replay) | `saved_search.spec` (JSONB `SearchFormData`) and the `search_facets` session row both persist the raw query string, so a saved search or bookmarked session containing `"`/`-`/`or` **changes meaning on replay** after this ships. That change is the fix (the operator was previously ignored or inverted), not a regression — called out in the PR body; no migration, no data touched |
| Docs | `docs/data-discovery/search.md` — a "Query syntax" section **and** a correction to the `:93` caveat; release-gated (1.0.0) |
| Ontology | `/enrich --touched` on the sidecars covering the FTS sink + search feature; re-embed; commit |
| SRE | the negation-only Seq Scan is measured and neutralised; leaf count capped; the 1-arg constructors this design uses are **STABLE**, not IMMUTABLE (only the `(regconfig, text)` overloads are IMMUTABLE) — verified in `pg_proc`; a STABLE index qual is still evaluated once per scan, not per row, confirmed by `EXPLAIN`. The 1-arg form is the deliberate choice: it follows `default_text_search_config`, exactly as the indexed vectors do (`concatVectorFields` calls `to_tsvector(...)` 1-arg), so query and index cannot diverge |

**(e) A correctness improvement the change requires.** `ftsCondition` renders a bound expression to a **string** and re-parses it as plain SQL (`JooqFTSHelper.java:108-113`), inlining the query text into SQL. That is tolerable today only because `tsQuery()` pre-strips `'`; the operator path must carry the user's raw text into `phraseto_tsquery`/`plainto_tsquery`, so the render→re-parse round trip is replaced by `DSL.condition("{0} @@ {1}", vectorField, expr)` with real binds. **Required by** the change, not gold-plating. Open verification for Phase B (on the running stack, not reasoned about): whether a `?` or `{0}` typed into the search box already breaks the re-parsed plain SQL today.

## Plan-check (G-C19) — ISSUES FOUND, 5 blockers, all resolved

An adversarial `plan-checker` run (fresh context, goal-backward, re-measuring the plan's own SQL claims on the
`postgres:13.2-alpine` container) returned **5 BLOCKERs + 12 warnings** against the first revision. It did not
dispute the mechanism substitution — it attacked the substitute, which is exactly what it is for. Every blocker
was reproduced first-hand before being accepted; the design below is the corrected one.

| # | Blocker | Verified how | Resolution |
|---|---|---|---|
| 1 | **`X or -Y` returned ZERO rows.** Guarding the WHOLE expression collapses `customer or -test` to the empty tsquery, because `querytree('custom':* \| !'test') = 'T'` | measured: whole-expression guard → **0 rows**; the `customer` branch alone → **50 000**; `websearch_to_tsquery` → 50 000. The plan was *worse* than the mechanism it replaces on this shape | the guard moved **per OR-branch**. A non-indexable branch collapses to the empty tsquery, which is the **identity** for `\|\|`, so it is dropped rather than voiding the query. Re-measured: **50 000 rows**, Bitmap Index Scan. Pinned by `guardIsAppliedPerOrBranch` + `searchAssets_orWithNonIndexableBranch_keepsTheIndexableBranch` |
| 2 | **The tokenizer's stated order destroyed a phrase containing `or`.** The plan's pseudo-code split on `or` *before* handling quotes | `websearch_to_tsquery('"customer or orders"')` → one phrase; the plan as written → two OR groups | the scan is a single left-to-right pass that consumes a quoted span **first**; stated explicitly and pinned by `quotedSpanIsTokenisedFirst` (`"a or b"`, `"a -b"`, `-"a b"`, unterminated) |
| 3 | **Past the leaf cap the fallback INVERTED negations.** The plain path renders `customer -test` as `'custom':* & 'test':*` | measured `to_tsquery('customer:*&-test:*')` → `'custom':* & 'test':*` — the exact inversion this slice fixes, applied silently | the over-cap path **fails closed** (empty tsquery), never the plain path. Cap raised to 64 (well under Postgres's 65 535 bind limit) and pinned at the 64/65 boundary by `overTheLeafCapFailsClosed` |
| 4 | **The docs-train claim was false** | the maintainer corrected it; `git ls-remote` confirms `origin/release/1.0.0` @ `5b2bb04` | root-caused to a single-branch clone refspec, repaired; DOC-501 deleted, DOC-497 amended. See `### Docs` |
| 5 | **R6's "without a sequential scan" had no covering artifact** | no named test asserted the guard | the guard is pinned deterministically at the expression level (`noPositiveTermIsGuardedAndEmptyQueryMatchesNothing`) rather than by an `EXPLAIN` assertion, which is unstable on a small test table |

Warnings folded in: the consumer count corrected to 7 classes / 26 call sites; the STABLE-vs-IMMUTABLE claim
corrected; the saved-search/session replay impact row added; R4 reworded from "byte-identical" to behavioural
parity; R7's acceptance scoped to the DE subset; the `?` / `{0}` question resolved **by construction** (user text
is now a bind, so it never reaches the SQL template) and both payloads added to the poison set; the navigation
pointer added to the impact list.

## Plan

### Change set (odd-platform)

| # | File | Change |
|---|---|---|
| 1 | `repository/util/JooqFTSHelper.java` | the operator tokenizer + compositional `tsQueryExpression(String)` + the `querytree` guard + the leaf cap; `ftsCondition` / `ftsRankField` rewired onto it with real binds. `tsQuery(String)` **unchanged** — it *is* the bare-term leaf |
| 2 | `repository/reactive/ReactiveDataEntityRepositoryImpl.java` | `getHighlightedResult` uses the shared expression so highlights reflect what actually matched (R7) |
| 3 | `odd-platform-specification/components.yaml` | `SearchFormData.query` carries **no `description` at all** today (verified — its sibling `sort` carries a full one). Add the operator syntax there: it is the contract that both search paths share, and Swagger is the API-reference surface. Description-only → no committed codegen (generated sources are gitignored) |

No other production file changes. No migration, no OpenAPI change, no FE change **unless** GATE 1 selects the discoverability affordance.

### Tests — both buckets (G-C9)

**Unit → odd-platform CI**
- `JooqFTSHelperTest` — **extend**: the operator-detection truth table (phrase / negation / `or` and the non-operator look-alikes `my-table`, `e-mail`, `2024-01-01`, `ORdering`, `sales_or_ops`, `trailing dash -`), the composed-expression shape, and the leaf cap. The existing plain-path cases stay **unmodified** — they are the R4 parity pin (G-C15: a changed test is the dangerous zone).
- `AssetSearchServiceIntegrationTest` — **extend** (Testcontainers, real Postgres, production FTS write path): R1 phrase, R2 negation (**RED-on-base is an inverted result set** — the strongest available proof), R3 `or`, R4 `cust`→`Customers` parity **including inside an operator query**, R5 the extended operator-poison set, R6 negation-only → empty page.
- `ReactiveDataEntitySearchResultsTest` / `ReactiveDataEntitySearchSuggestionsTest` / `ReactiveTermSearchTsQueryPoisonTest` / `ReactiveDataEntityHighlightInjectionTest` — **run unmodified** as the legacy-path, autocomplete and highlight parity proof.

**Integration → odd-team `integration-tests/`**
- `IT-003` — **extend** with operator-shaped payloads on both query paths (the issue's own ask).
- One browser assertion that an operator query narrows the rendered result list **and** the count badge agrees with the listed rows (R7) — extend the existing catalog-search IT rather than adding a protocol.

Every authored test is **run here** — GREEN on the fix, RED on `ODD_SUT=ref:main` — before commit. No gate is handed to `/review` unrun.

### Docs (G-C10 + G-C11)

`docs/data-discovery/search.md` read first-hand. Two edits: a new **"Query syntax"** section (the three operators, the one-sentence rule *"bare words match as prefixes; a quoted phrase and an excluded word match exactly"*, the no-positive-term behaviour, and that it applies to every search surface), and a **correction to the `:93` caveat**, whose character list omits `"` and `-`. **Routing:** unreleased behaviour → the **`release/1.0.0` train, which exists** (`origin/release/1.0.0`, 8 commits ahead of `origin/main`, head `5b2bb04`). Authoring directly on the train is correct (`adrs/drafts/release-train-doc-gating.md` Decision 5). Paired backlog `DOC-NNN` with `milestone: 1.0.0`.

> **Correction (2026-08-30).** An earlier revision of this plan asserted the train did not exist. That was wrong, and the maintainer corrected it. Root cause: the workspace's `../documentation` clone was configured **single-branch** (`remote.origin.fetch = +refs/heads/main:refs/remotes/origin/main`), so `git branch -r` showed a truncated view — absence was concluded from a shallow probe instead of from the fetch config (`feedback_verify_absence_by_reading_config`, second instance). The refspec is repaired to `+refs/heads/*:refs/remotes/origin/*`. The false backlog item DOC-501 has been deleted; the one **real** residual it contained is now recorded on its rightful owner, `DOC-497` (its commit `7259606` never landed, so the train still tells readers that facet selections are not in the URL — stale since ST-1b shipped).

### Follow-ups logged on disk (not folded into this PR)

- `DOC-497` corrected from `pending-release` to `pending`: its content never reached the train, which still carries the stale "facet selections are not yet in the URL" bullet.
- A **released-truth** doc inaccuracy the SME surfaced and I confirmed at `search.md:93`: the published caveat enumerates `( ) : & | ! '` but omits `"` and `-`, and does not say that `-term` currently *requires* the term. That is wrong about **0.28.0, which is live** — so it ships on its own immediate-flow branch, never mixed onto the 1.0.0 train.


### Scope comment for the issue thread (G-C5 — posted immediately after GATE 1)

The plan widens the issue's scope from *"the unified query"* to the shared sink, changes the named mechanism, and adds an index-searchability guard the issue does not mention. That goes on the public thread before any code.

### must_haves

```yaml
must_haves:
  truths:
    - "A quoted phrase query returns only assets where the words are adjacent (R1)"
    - "A -term query EXCLUDES matching assets, instead of requiring them as it does today (R2)"
    - "An `a or b` query returns assets matching either, instead of neither as today (R3)"
    - "A plain query behaves exactly as before on every surface, prefix matching included: `cust` still finds Customers (R4)"
    - "Prefix matching ALSO survives inside an operator query: `cust -test` still finds Customers (R4b - the published search.md:93 promise)"
    - "Operator-shaped and metacharacter payloads return a page, never a 500, on the unified AND the legacy path (R5)"
    - "A query with no positive term returns an empty page without a sequential scan (R6)"
    - "For an operator query the result list, the total, the sidebar facet counts, the ranking and the highlights all agree (R7)"
  artifacts:
    - path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelper.java"
      provides: "the operator tokenizer + compositional tsquery builder + index-searchability guard, for every FTS consumer"
      anchor: "phraseto_tsquery"
    - path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java"
      provides: "ts_headline highlights built from the SAME tsquery that matched"
      anchor: "tsQueryExpression"
    - path: "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java"
      provides: "the operator-detection truth table, the composed shape, the leaf cap, and the untouched plain-path parity pin"
      anchor: "usesQueryOperators"
    - path: "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/AssetSearchServiceIntegrationTest.java"
      provides: "R1/R2/R3/R4/R4b/R5/R6 driven end-to-end through the real service on a real Postgres"
      anchor: "searchAssets_quotedPhrase"
    - path: "integration-tests/protocols/IT-003-search-tsquery-poisoning.md"
      provides: "the operator-shaped poison payloads on both query paths"
      anchor: "operator"
    - path: "odd-platform-specification/components.yaml"
      provides: "the query field's operator syntax on the shared search contract (Swagger/API reference)"
      anchor: "SearchFormData"
    - path: "documentation/docs/data-discovery/search.md"
      provides: "the user-facing Query syntax section + the corrected metacharacter caveat (on the 1.0.0 train)"
      anchor: "Query syntax"
  key_links:
    - from: "JooqFTSHelper.tsQueryExpression"
      to: "ReactiveAssetSearchRepositoryImpl ftsCondition + ftsRankField (list, count, relevance order)"
      via: "the shared sink - one expression builder, so match and rank cannot diverge"
    - from: "JooqFTSHelper.tsQueryExpression"
      to: "ReactiveSearchFacetRepositoryImpl (the sidebar facet counts)"
      via: "the same sink - the link whose absence makes the count badge contradict the list"
    - from: "JooqFTSHelper.tsQueryExpression"
      to: "ReactiveDataEntityRepositoryImpl.getHighlightedResult (ts_headline)"
      via: "an explicit edit - this call site builds its own to_tsquery today and would otherwise keep the old dialect"
    - from: "the positive bare terms of an operator query"
      to: "the pre-existing to_tsquery(tsQuery(...)) leaf"
      via: "the SAME call the non-operator path makes, so prefix parity is structural rather than test-dependent"
    - from: "the composed expression"
      to: "the GIN index on search_vector"
      via: "the querytree()='T' guard, without which a no-positive-term query is a measured Seq Scan"
```

## GATE 1 — APPROVED 2026-08-30

**Maintainer (`RamanDamayeu`), verbatim:** *"go with composite design, let's build best in class search"*.

**What that approves:**

1. **The compositional tsquery model**, not the issue's named `websearch_to_tsquery` — operators narrow, they never revoke prefix. `cust -test` still finds "Customers". The published `search.md:93` prefix promise stays true.
2. **The shared sink as the unit of change** — one query language across the unified path, the legacy `/api/search` path, terms, query examples, lookup tables, suggestions, facet counts and highlights.
3. **The discoverability affordance ships** — "best in class" resolves the sub-option: reuse ODD's existing inline-help pattern (`InformationIcon` + `AppTooltip`, ADR-0076) on the search bar rather than inventing one, with the new string in **all 7 locale files**.
4. The index-searchability guard, the leaf cap, the `SearchFormData.query` contract description, and the docs section on the `release/1.0.0` train.

**In the same message the maintainer corrected a false claim in the prior revision** (the 1.0.0 doc train does exist). Correction recorded under `### Docs`; DOC-501 deleted; DOC-497 amended.

`plan_approved_by: RamanDamayeu` · `plan_approved_at: 2026-08-30`. Scope comment posted to the thread before any code (G-C5).
