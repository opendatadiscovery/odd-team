---
id: CTRIB-060
title: "#1840 ST-6 — Query operators: websearch_to_tsquery (quoted phrase / -negation / or), injection-safe"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1840"
parent_epic: 1825
class: "feature — search query language"
status: pr-draft   # all five DoD gates RUN at 6281a9df (rebased onto b5d9f150/ST-8). DRAFT PR #1873. -> /review (separate session) -> GATE 2.
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live GET issues/1840 2026-08-30: milestone 1.0.0, state OPEN, semver, due 2026-07-31
slice: "ST-6 of #1825"
base_sha: "82e7e70e"      # odd-platform origin/main at intake (= #1862 ST-5c merged)
reproduced: "the behavioural suite on origin/main @82e7e70e — 6/15 RED, incl. `customer -test` returning the EXCLUDED row (expected 13L but was 14L). See ## Test ledger."
plan_approved_by: "RamanDamayeu"
plan_approved_at: "2026-08-30"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1873"
docs_routing: "AUTHORED on documentation branch docs/CTRIB-060-search-query-operators @ 693a31e, cut from origin/release/1.0.0 @ 5b2bb04. Paired backlog item DOC-502 (milestone 1.0.0). Publishes at the 1.0.0 release gate, NOT at this merge. The sibling released-truth correction is DOC-500 (docs main, immediate flow)."
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


## Test ledger — measured, at the working tree

Every number below was produced on this machine. Gradle runs are serialised: two concurrent builds fail with
`Cannot lock daemon addresses registry` (and OOM'd one daemon into a 772 MB heap dump in the odd-team root —
`.gitignore` now covers `*.hprof`).

### Unit bucket — `scripts/run-platform-tests.sh` (the CI replica)

| Run | Result |
|---|---|
| `:odd-platform-api:compileJava` + `checkstyleMain` | **BUILD SUCCESSFUL** (15m 4s, cold worktree) |
| `--tests "*JooqFTSHelperTest*"` on the fix | **45 tests / 0 failures** (3m 6s) |
| `--tests "*AssetSearchServiceIntegrationTest*"` on the fix | **15 tests / 0 failures** (3m 30s) |
| the same behavioural test on `origin/main` @ `82e7e70e` | **6 RED / 15** — the proof |

**RED→GREEN matrix** (the behavioural test, driven through the real `AssetSearchService` on a real Postgres):

| Case | on `main` | on the fix |
|---|---|---|
| `phrasealpha "customer orders"` | **RED** — 2 rows; the quotes are dropped, so both assets match | 1 row, the adjacent one |
| `negbeta customer -test` | **RED** — returns the asset it was asked to EXCLUDE | 1 row, the kept one |
| `orgamma alphaside or orgamma betaside` | **RED** — `[]`; the parser ANDs the branches | both rows |
| `prefixdelta custom -testfixture` | **RED** — `expected: 13L but was: 14L`, i.e. the inverse row | 1 row, the kept one |
| `-negonlyeta` (no positive term) | **RED** — returns rows (a measured Seq Scan shape) | empty page |
| `guardzeta indexable or -absentword` | **RED** — `[]`; the indexable branch is lost | the indexable branch answers |
| operator-shaped poison (20 payloads) | pass | pass |
| tsquery-metacharacter poison | pass | pass |
| the 7 pre-existing ST-4/ST-5 cases | pass | pass |
| the 13 pre-existing `tsQuery` parity pins | pass | pass |

The two poison cases pass on **both** builds, and that is stated rather than dressed up: `main` is already
fail-closed for them (the #1756 fix holds), so this slice does not get to claim it fixed them — it inherits the
property and extends the payload set.

**Honest limitation:** the new `JooqFTSHelperTest` cases are white-box — they call `tsQueryExpression`, which
does not exist on `main`, so "RED on base" is not a meaningful claim for them and is not made. The behavioural
suite is the RED evidence.

### The guard is proved by mutation, not by assertion

The plan-check's Blocker 5 was "R6's *without a sequential scan* has no covering artifact". A test that merely
*mentions* the guard is not one, so the guard was **deliberately disabled** and the suite re-run:

| Guard state | `searchAssets_negationOnly_returnsEmptyPage` | `searchAssets_orWithNonIndexableBranch_keepsTheIndexableBranch` |
|---|---|---|
| disabled (mutation probe) | **RED** — "Expecting empty but was: [Asset id: 17 …]" | **RED** |
| restored | green | green |

The OR case only bites because the assertion was **hardened** after the ontology pass raised it (`P-393`): it
originally asserted only that the indexable branch was *present*, which an unfired guard would also satisfy. It
now seeds an unrelated neighbour and asserts it is **absent** — the canary for the query degenerating into
"match almost everything", which is exactly what an unguarded `!absentword` branch does.

### Patch coverage — the CI gate is inert here, and that is stated, not dressed up

CI runs `Madrapps/jacoco-report` with `min-coverage-changed-files: 98` (`.github/workflows/run-pr-tests.yaml:85`).
Computing that aggregate locally against the full build's `jacocoTestReport.xml` returns **zero instrumented
changed lines** — not 100%. Cause: `odd-platform-api/build.gradle:181-188` sets
`jacocoExcludes = [ …, '**/repository/**' ]`, and **both** changed files live under `repository/`
(`repository/util/JooqFTSHelper.java`, `repository/reactive/ReactiveDataEntityRepositoryImpl.java`).

So the gate **cannot fail** on this PR and offers **no** assurance about it. Reporting "coverage 100%" here would
be true-sounding and meaningless. The actual assurance is behavioural: 45 unit cases + 15 service-level cases
driven through the real `AssetSearchService` on a real Postgres, with a 6-case RED proof on `main` and a
mutation probe on the guard.

### Front-end

| Check | Result |
|---|---|
| `tsc --noEmit` (Node 24.13) | **clean** |
| `eslint` on the three changed FE paths | **0 errors** (one prettier warning, auto-fixed, re-verified clean) |


## Ontology refresh + what it surfaced (G-C10)

`JooqFTSHelper` had **no sidecar** despite being the single FTS sink; one was written for it —
`lineage/odd-platform/understanding/odd-platform__java__repository__util__file__JooqFTSHelper.md` (confidence
HIGH). The analyser was pointed at the **CTRIB-060 worktree**, not `../odd-platform`: `/enrich` resolves sources
to `../{repo}`, which here sits on an unrelated branch, so the default path would have described code that is
not this change (the LSN-033 "measured against a fossil" shape, one directory over).

It surfaced three things beyond the sidecar. **Each was verified first-hand before being acted on, and one did
not survive that check** — an agent finding is a lead, not a fact:

| Finding | Verdict after my own read |
|---|---|
| `resultFacetStateConditions` drops the **ENTITY_CLASSES** facet when `state.isMyObjects()` (`JooqFTSHelper.java:157-162`), with no replacement at either caller and no comment defending it | **REAL.** Confirmed in the source. And the combination is user-expressible post-ST-4: the tab strip is now only All / My Objects, with the class narrowing living in the sidebar Asset-type filter, whose own comment says *"a class narrowing is a refinement of All, not of My"* (`SearchResultsTabs.tsx:41-45`). The **unified** ST-4 path is NOT affected — it applies the class refinement independently of my-objects. Filing is **deferred until the e2e stack is up**, so the user-facing half is driven rather than asserted (`feedback_user_facing_impact_mandatory`) |
| `QUERY_EXAMPLE_CONDITIONS` / `LOOKUP_TABLES_CONDITIONS` are `Map.of()`, so "every facet supplied on those surfaces is silently a no-op with a 200" | **NOT A DEFECT — not filed.** `QueryExampleSearchFormData` carries **only** `query` (`components.yaml:3113-3117`); the lookup-table search likewise has no facet-bearing wire contract. No facet *can* be supplied, so the empty maps are correct-by-design placeholders, not a silent drop |
| The published metacharacter caveat omits `* < >` and backslash from the strip set (as well as `"` and `-`) | **REAL** — folds into the existing `DOC-500` rather than a new item |

The analyser also raised (as probe `P-393`) that `JooqFTSHelperTest` asserts the SQL *contains* `querytree`
without asserting what it evaluates to, so a future Postgres change could silently restore the sequential scan
with the suite green. Half of that is already covered — `searchAssets_negationOnly_returnsEmptyPage` is
behavioural and goes RED if the guard stops firing (an unguarded `-negonlyeta` returns rows). The **uncovered**
half is the OR case: `searchAssets_orWithNonIndexableBranch_keepsTheIndexableBranch` asserts only that the
indexable branch is present, so an unfired guard there would still pass. That assertion is hardened below.


## Integration bucket — the e2e verdict, and why it needed an A/B

`run-regression.sh ctrib060` (SUT built from `a256a9a1`, run-log digest confirmed, `confirmed: the e2e stack is
running the SUT image`):

| Suite | Result |
|---|---|
| `feature-complete` | **319 passed / 20 failed** |
| `known-bugs` | 3 RED — its **expected** state (IT-004 / IT-006 / IT-007) |
| `multi-stack` | PASS |
| `ingestion-e2e` | PASS (15/15) |

`api:FAIL` on `feature-complete` is **TST-058**, a tracked pre-existing dead rail — `lineage/_extractor` fails to
build (`hatchling` rejects `readme = "../README.md"`), reproduced verbatim in this run's log. Not this change.

### What the 20 failures are NOT

- **Not a backend regression.** On the same SUT: `POST /api/search` → 200 with facet counts; `GET
  /api/search/{id}/results` → 200; `customer -test` → 200. No 500, no `42601`.
- Every failure is a 60 s `waitForResponse` / `waitForURL` timeout, and the set is heterogeneous — it includes
  `swagger-openapi-discovery`, which has no relationship to search.

### What the box was doing during that run

Two **other** contributor streams were live and had registered in `state/active-streams.yaml` *after* this
stream's intake, so the intake check (correct when taken) had already gone stale:

- `ctrib061` (#1841), `ctrib062` (#1842).
- `ctrib062`'s own entry, timestamped **23:47**, records: *"ctrib060 IS RUNNING — run-regression.sh ctrib060 pid
  248842 … currently in the feature-complete suite … it HOLDS the heavy-e2e flock"*.
- And `ctrib062-odd-platform` + `ctrib062-database` were **created 23:43:11** — a second platform + Postgres
  inside this stream's e2e window. The flock guards the *regression*, not stack *bring-up*, so it never saw them.
- `TST-042` independently records that `feature-complete` carries specs whose waits flake under full-set load.

Logged as **`TST-060`** (the coordination gap), not narrated.

### Two harness traps hit while investigating — both self-caught, both recorded

1. An isolation re-run invoked `run-suite.sh` **without `ODD_PLATFORM_DIR`**, so it rebuilt the SUT from the
   *shared* `../odd-platform` checkout (`c54b9c61+uncommitted`, the old `contrib/CTRIB-026-…` branch) and
   overwrote this stream's image tag — the LSN-033 fossil trap, walked into while checking for it.
2. `run-suite.sh` then reused a leftover "already healthy" stack and printed
   `WARNING: the e2e stack is running image , which does NOT match the SUT digest …` — **and ran anyway**. The
   resulting screenshot showed a pre-ST-4 nine-tab class strip and a `waitForURL(?q=)` timeout that read exactly
   like a regression in this change. It was caught only because the rendered tab strip contradicted the source:
   `SearchResultsTabs.tsx` on `origin/main` renders **two** tabs, not nine.

Both are in `TST-060`'s acceptance criteria (a digest mismatch must abort, not warn).

### The A/B — the only thing that settles attributability

Side A is the run above (my SUT, 20 failures). Side B is the **identical** `feature-complete` suite against a SUT
built from pure `origin/main` @ `82e7e70e` (digest `4e6afc9d…`), flock held. *(One caveat recorded: the suite's
spec list gained `my-data-scope.spec.ts` from a parallel stream between the two runs, so the sets differ by that
one spec.)*

**Side B was INTERRUPTED at 127 of ~339 specs** — it did not produce a final tally. What it did establish, on a
build that contains **no ST-6 code at all**:

| Spec | on pure `origin/main` | in this change's 20 |
|---|---|---|
| `specs/catalog-search.spec.ts` | **FAILED** | yes |
| `specs/entity-class-type-badge-list.spec.ts` | **FAILED** | yes |

So **2 of the 20 are directly proven non-attributable** — they fail without this change present. The remaining 18
were not reached before the interrupt and are **NOT proven either way**.

**Status: the integration gate is UNRESOLVED, and this is not a pass.** The circumstantial case for
"environmental" is strong (the backend answers 200 on all three query shapes on the same SUT; the failures are
uniform 60 s timeouts across a heterogeneous set including `swagger-openapi-discovery`; `TST-042` records these
specs flaking under full-set load; a second stream stood up a platform inside the e2e window) — but
circumstantial is not the bar. **The PR stays `draft` and this CTRIB does not reach `review-ready` until side B
is completed on a quiet box.**

To finish it: `ODD_PLATFORM_DIR=../odd-platform-ctrib060base integration-tests/run-regression.sh ctrib060base
feature-complete`, with no other stream holding a stack, then diff its failing set against the 20 above.


## DoD — all five gates RUN at 6281a9df (rebased onto ST-8)

| # | Gate | Evidence |
|---|---|---|
| 1 | Unit build green on the working tree | **810 tests, 1 failure** — `OpenApiDocsContractTest.platformApiGroupDocumentLoads`, a 60 s blocking read, proven **non-attributable** by a same-conditions A/B: passes ALONE on this branch (3/3) *and* alone on pure `main` (3/3); fails only inside the loaded full build. Logged `TST-061` |
| 2 | FULL integration regression on the working-tree SUT | `feature-complete` **328/12** · `known-bugs` 3 RED (expected) · `multi-stack` 14/0 · `ingestion-e2e` 15/15 (run alone). **A/B against a pure `main` SUT: 328/12 with a `diff`-empty, test-name-identical failing set** → zero e2e regression. `ingestion-e2e`'s in-suite failure (IT-145) likewise passes alone on both sides |
| 3 | Docs read + decided + routed AND authored | `documentation@docs/CTRIB-060-search-query-operators` `693a31e`, cut from `origin/release/1.0.0` `5b2bb04`. Paired `DOC-502`; sibling released-truth fix `DOC-500` |
| 4 | Ontology re-enriched + committed | `JooqFTSHelper` sidecar (schema-validated, 0 warnings); probes `P-392`/`P-393`; navigation pointers added |
| 5 | Principal sufficiency review | 60 tests across both buckets; 6-case RED proof; **guard proved by mutation**; **UI reviewed as a user** — screenshots in `contributor/evidence/` show the `(i)` beside the input and the hover tooltip rendering as a padded, bordered card (the LSN-035 failure avoided). Patch-coverage gate is **inert** here (`jacocoExcludes` has `'**/repository/**'`; both changed production files live there) — stated in the PR rather than reported as "100%" |

**Draft PR: [#1873](https://github.com/opendatadiscovery/odd-platform/pull/1873)** — `draft: true`, bot-authored,
`Closes #1840`, `Milestone: 1.0.0`. The bot cannot merge (G-C4). → `/review` (separate session) → GATE 2.

### What the long e2e investigation actually established

The 20 `feature-complete` failures that blocked this slice overnight were **12 pre-existing failures + 8 caused
by contention**. Three streams shared the box; the heavy-e2e flock serialises regressions but not stack
bring-up, so a second platform came up inside this stream's e2e window. On a quiet box the count fell to 12, and
the A/B showed pure `main` failing the identical 12. Logged as `TST-060` (coordination gap) and `TST-061` (the
load-sensitive OpenAPI contract test).

Two traps were hit and self-caught, both now case-law: a bare `run-suite.sh` rebuilt the SUT from the SHARED
checkout and clobbered this stream's image tag (LSN-033), and `run-suite.sh` **warns but proceeds** when the
running stack's image does not match the SUT — which silently drove a spec run against a build of an old branch.
The tell was a rendered nine-tab class strip contradicting the two-tab source on `origin/main`.

### Follow-ups on disk (none folded into this PR)

`DOC-500` (released-truth caveat gap) · `DOC-502` (the 1.0.0 doc item) · `DOC-497` corrected to `pending` ·
`TST-060` · `TST-061` · `PLT-262` (My Objects silently drops the entity-class filter — code-verified twice
including post-ST-8, with an explicit note that the live repro needs an auth-enabled stack, since the DISABLED
posture short-circuits my-objects to an empty page).

## GATE 1 — APPROVED 2026-08-30

**Maintainer (`RamanDamayeu`), verbatim:** *"go with composite design, let's build best in class search"*.

**What that approves:**

1. **The compositional tsquery model**, not the issue's named `websearch_to_tsquery` — operators narrow, they never revoke prefix. `cust -test` still finds "Customers". The published `search.md:93` prefix promise stays true.
2. **The shared sink as the unit of change** — one query language across the unified path, the legacy `/api/search` path, terms, query examples, lookup tables, suggestions, facet counts and highlights.
3. **The discoverability affordance ships** — "best in class" resolves the sub-option: reuse ODD's existing inline-help pattern (`InformationIcon` + `AppTooltip`, ADR-0076) on the search bar rather than inventing one, with the new string in **all 7 locale files**.
4. The index-searchability guard, the leaf cap, the `SearchFormData.query` contract description, and the docs section on the `release/1.0.0` train.

**In the same message the maintainer corrected a false claim in the prior revision** (the 1.0.0 doc train does exist). Correction recorded under `### Docs`; DOC-501 deleted; DOC-497 amended.

`plan_approved_by: RamanDamayeu` · `plan_approved_at: 2026-08-30`. Scope comment posted to the thread before any code (G-C5).
