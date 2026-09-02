---
id: CTRIB-060
title: "#1840 ST-6 — Query operators: websearch_to_tsquery (quoted phrase / -negation / or), injection-safe"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1840"
parent_epic: 1825
class: "feature — search query language"
status: review-ready   # ROUND-3 REVIEW (session review-ctrib060r3, 2026-09-02): **ACCEPTED**, pr-draft ->
                       # review-ready. Round 3's two commits close the round-2 fix-list and I re-derived both:
                       # EVERY row of the Query-syntax table re-measured on postgres:13.2-alpine (5/5 return
                       # what their cell claims; the removed row reproduces as NO MATCHES), every prose claim
                       # in the section measured or traced to source, the census re-derived (7 classes /
                       # 26+1 sites, no second dialect), G-C15 clean across the WHOLE branch (the only test
                       # removals are 2 javadoc lines). Unit 814/1 at 8008eb8b (mine, XML-parsed, 181 classes,
                       # checkstyle + assemble executed and clean); the one failure is TST-061's springdoc
                       # timeout, 6th reproduction, green on upstream CI at this exact SHA (6/6). Integration
                       # carried and PROVED over the whole 6281a9df..8008eb8b chain: zero non-comment lines in
                       # src/main + UI + spec. Gate 8 = PENDING-RELEASE (1.0.0): branch pushed @ b96800f,
                       # merge-base == train head 9594f96, 0 conflicts, PR #111 open/clean, all 7 descriptions
                       # PyYAML-clean and <=191 chars. -> human GATE 2 (merge) owns the rest.
                       # Editorial audit filed DOC-517 (high) + DOC-518 (medium, on the still-open PR #111) and
                       # extended DOC-433; DOC-510 + DOC-355 re-derived, not re-filed.
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
| Boundary clarity | 0.90 | 0.70 | the 7 consumer classes / 26 call sites are enumerated `file:line`; ST-11/ST-12/D9 exclusions are explicit |
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
| Consumers of changed signatures | `ftsCondition`/`ftsRankField`/`tsQuery` signatures **unchanged**; all 26 call sites across the 7 consumer classes inherit the behaviour by design — that is the point. `getHighlightedResult` builds its own `to_tsquery(?)` and is edited onto the shared expression (R7) |
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
      anchor: "operatorDetectionMatchesPostgresGrammar"
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

## Review (2026-09-01, session: review-ctrib060)

- **Result**: **REJECTED** — `pr-draft` → **`blocked`**. The **code is right and I re-derived it end to end**; what is
  missing is the documentation half of the Definition of Done. Two gates fail, both on the doc side, both
  mechanical: the manual's operator-facing capability was documented on **one** page when the immediately
  preceding slice's own precedent is a **six-page sweep**, and the doc commit is **not on the train** — it is
  unpushed and cut from a base the train has since moved past, with a live conflict that would put back a
  sentence CTRIB-062 deliberately removed.
- **Session boundary**: fresh session; `/implement` was the prior ctrib060 session (odd-team `7f90a7bb`, 19:30).
  Self-review gate satisfied.
- **Cheap precondition (the 2-minute bounce)**: NOT triggered. The DoD records all five gates as RUN at the
  committed SHA with no "NOT RUN"/deferred admission. The runs below are the *confirmation* of gates implement
  already passed, not their first execution.

### Reviewed subject (verified, not assumed)

| fact | value | how verified |
|---|---|---|
| worktree | `../odd-platform-ctrib060` @ `6281a9df`, **clean**, exactly 1 commit ahead of `origin/main` `b5d9f150` (ST-8 #1871) | `git status` + `git log` |
| diff | 16 files, **+572/−56**; both test files are pure appends (`137/0`, `145/0`) — **no test was changed**, so G-C15's dangerous zone does not fire | `git show --numstat` |
| PR #1873 | head SHA == `6281a9df`, `draft: true`, author `odd-contributor[bot]`, base `main` `b5d9f150`, 16 files +572/−56, `mergeable_state: clean` | GitHub PR API |
| upstream CI at that SHA | **6/6 SUCCESS** — `run_tests`, `Test Results`, `run_playwright_tests/{test,lint,format-check}`, `update_release_draft` | GitHub check-runs API |
| milestone (G-C11) | issue **#1840** OPEN with the **OPEN** milestone `1.0.0` | GitHub issues API |
| scope comment (G-C5) | posted **before** the code commit — [issuecomment-5471090867](https://github.com/opendatadiscovery/odd-platform/issues/1840#issuecomment-5471090867), 2026-08-30 20:31Z; the commit is 23:39 | GitHub comments API |

### What I measured myself, rather than read

The central risk in this change is that its correctness lives in generated SQL, so I did not take the ledger's
Postgres numbers on trust — I re-derived them from the **compiled artefact**.

1. **An independent tokenizer harness.** I put `odd-platform-api/build/classes/java/main` + jOOQ 3.18.4 on a
   classpath and called the real `JooqFTSHelper.tsQueryExpression(...)` over a **48-case** grammar table, then
   evaluated **every generated expression** on a throwaway `postgres:13.2-alpine` beside
   `websearch_to_tsquery` on the same input. Every row matches websearch **modulo the two deliberate
   divergences** (bare terms keep their prefix; a branch with no positive term collapses). Including the
   non-obvious ones: `my-table` / `e-mail` / `2024-01-01` / `foo--bar` / `trailing dash -` take the untouched
   plain path; `oracle` / `ORdering` / `sales_or_ops` do not trigger OR; `"customer or orders"` stays one
   phrase; `-"foo bar"` negates a phrase; `"unbalanced` runs to end-of-input; `-my-table` produces exactly
   websearch's `!( 'my-tabl' & 'tabl' )`; `?` and `{0}` in user text reach `to_tsquery` as data, not as jOOQ
   template markers.
2. **The algebra the design rests on.** `''::tsquery && X == X` and `''::tsquery || X == X` (the empty tsquery
   really is the identity, so dropping a branch is safe); `querytree(!'test') = 'T'`;
   **`querytree('cust':* || !'test') = 'T'` too** — which is the whole reason the guard has to be per-branch.
3. **The index-searchability claim, with the EXPLAIN the plan-check recorded as uncovered.** On a 40 000-row
   GIN-indexed table (`postgres:13.2-alpine`, ANALYZEd):
   - unguarded `-testfixture` → **`Seq Scan`**, 20 000 rows — the hazard is real;
   - guarded `-testfixture` → **`Bitmap Index Scan on sv_gin`**, `Index Cond` = the whole `CASE` expression,
     **0 rows** — the guard neutralises the scan *and* the composed expression is still pushed into the index
     qual rather than degraded to a filter;
   - guarded `customer` AND `-testfixture` → **`Bitmap Index Scan`**;
   - `customer or -absentword`: **per-branch guard → 20 000 rows**, **whole-expression guard → 0 rows.**
     Plan-check Blocker 1's fix is necessary, not decorative. **R6 is fully verified, both halves.**
4. **`ts_headline` on the composed shapes** (the one path with no test coverage): phrase → both words marked;
   negation → only the kept term marked; `or` → the matching branch marked; empty tsquery → the head of the
   text, no error. So R7's highlight half is **functionally correct** — see the fix-list for the missing test.
5. **The consumer census.** Exactly **7 repository classes / 26 `ftsCondition`+`ftsRankField` call sites**
   (`grep` over `repository/reactive/*.java`), plus `getHighlightedResult`'s direct `tsQueryExpression`. The
   navigation pointer's figure is exact. `grep` for `to_tsquery|plainto_tsquery|phraseto_tsquery|websearch_`
   over `src/main` returns only `JooqFTSHelper` — no second dialect anywhere.
6. **The patch-coverage disclosure.** `odd-platform-api/build.gradle:181-188` `jacocoExcludes` really does
   carry `'**/repository/**'`, and `.github/workflows/run-pr-tests.yaml:85` really is
   `min-coverage-changed-files: 98`. Both changed production files live under `repository/`, so the gate is
   genuinely **inert** here. The ledger's refusal to report "100 %" is the honest call.
7. **i18n.** All seven locale catalogues carry **689** keys each — exact parity — and the repo's own
   `src/locales/__tests__/i18n-key-parity.test.ts` guard ran green in CI at this SHA.
8. **PLT-262's premise**, spot-checked: `JooqFTSHelper.java:158-162` does drop `ENTITY_CLASSES` when
   `state.isMyObjects()`, with no comment defending it. The filed issue is accurate.

### Unit bucket — my own full CI-replica run at the reviewed SHA

`ODD_PLATFORM_DIR=../odd-platform-ctrib060 scripts/run-platform-tests.sh` (the no-arg `build` lifecycle:
`test` + `checkstyleMain` + `checkstyleTest` + `assemble`), 27m47s:

**810 tests completed, 1 failed** across 181 test classes — 0 errors, 0 skipped; both checkstyle tasks passed.
**Byte-identical to the implementer's ledger.** (Parsed from that run's JUnit XML — every `<failure>`/`<error>`
across all 181 classes enumerated, exactly one — and cross-checked against gradle's own console tally. The
XML directory was subsequently overwritten by the targeted A/B run below, which is why the numbers are
quoted rather than re-derivable from the tree now; the console tally survives in the run log.)

The single failure is `OpenApiDocsContractTest.platformApiGroupDocumentLoads()` —
`IllegalStateException: Timeout on blocking read for 60000000000 NANOSECONDS`. My own same-conditions A/B, same
SHA, quiet box: the class **alone** → `BUILD SUCCESSFUL in 4m18s`, with
`Init duration for springdoc-openapi is: 23398 ms` — a 23.4-second idle init against a 60-second bound, which a
loaded full build pushes over. Upstream CI's `run_tests` (the same `odd-platform-api:build`) is **GREEN** on
this exact SHA. **Non-attributable, independently reproduced; TST-061's diagnosis corroborated.**

### Acceptance criteria — the `must_haves` truths, one by one

- [x] **R1 quoted phrase** — PASS. `"customer orders"` compiles to `'custom' <-> 'order'`, identical to
  `websearch_to_tsquery` (my measurement); behaviourally pinned by
  `searchAssets_quotedPhrase_matchesOnlyAdjacentWords`, RED on `main` (2 rows, quotes dropped).
- [x] **R2 negation EXCLUDES instead of requiring** — PASS. `customer -test` → `!'test' & 'custom':*`
  (AND is commutative, so the leaf order is immaterial). The RED-on-base proof is the strongest kind
  available: on `main` the query returns *the very asset it was asked to exclude*.
- [x] **R3 `or`** — PASS. `'custom':* | 'order':*`; RED on `main` (`[]`, the branches were ANDed).
- [x] **R4 plain-term parity** — PASS, and **structural rather than test-dependent**: an operator-free query
  takes the identical single `to_tsquery(tsQuery(q))` call. `tsQueryExpression("customer orders")` renders
  exactly `to_tsquery('customer:*&orders:*')`, and all 13 pre-existing `tsQuery` parity pins are untouched.
- [x] **R4b prefix survives inside an operator query** — PASS. `cust -test` → `!'test' && to_tsquery('cust:*')`;
  the bare terms go through the *same* sanitiser call the plain path uses. The published `search.md`
  prefix promise stays true — which is the entire reason the issue's named mechanism was replaced.
- [x] **R5 fail-closed** — PASS **for the scope this item owns**. 20 operator-shaped payloads at service level +
  10 through both UI query paths (IT-003), all returning a page. I re-ran the whole poison set through the real
  compiled builder onto real Postgres: no leaf can raise. **But see PLT-263** — a *pre-existing* input class
  (tab / newline) still reaches `to_tsquery` unsplit and 500s. Not a regression; logged, not folded.
- [x] **R6 no positive term → empty page, no sequential scan** — PASS, and now with the EXPLAIN evidence the
  plan-check recorded as missing (measurement 3 above). Also proved by mutation in the item: disabling the
  guard REDs both guard tests.
- [ ] **R7 list / total / facet counts / ranking / highlights all agree** — **PARTIAL.** The *truth* holds and I
  verified it: one sink means the list predicate, the count predicate, the rank field and `ts_headline` are
  built from the same expression, and I drove `ts_headline` through every composed shape by hand. What is
  missing is the **covering artifact the plan promised**: "one browser assertion that an operator query narrows
  the rendered result list **and** the count badge agrees with the listed rows — extend the existing
  catalog-search IT". `integration-tests/e2e/specs/catalog-search.spec.ts` is **untouched** by this slice, and
  no test anywhere drives an operator query through the facet-count or highlight paths. Same shape as
  plan-check Blocker 5, which was fixed for R6 and not for R7.

### Quality Bar

- **Gate 1 — No duplicates: PASS.** `JooqFTSHelper` is the only FTS builder in the tree (grep above), and the
  change *reuses* it rather than adding a second dialect. On the FE, `TooltipBody` was **moved** out of
  `Activity.styles.ts` next to `AppTooltip` and **re-exported**, so the existing call sites are unchanged and
  `SearchSyntaxHint` is its second consumer, not a copy — exactly the reuse posture LSN-035 asks for.
- **Gate 2 — Aliases: N/A.** No new alias or synonym is introduced; "quoted phrase" / "exclusion" / "operator"
  are ordinary English in the operator's voice, not platform vocabulary needing a `main-concepts.md` row.
- **Gate 3 — Caveats captured: PASS.** The metacharacter caveat is an admonition (`{% hint style="info" %}`),
  correctly *amended* rather than duplicated, and it now tells the reader what `"` and `-` did **before**
  (silently ignored, with `-word` read as *required*). The no-positive-term surprise is called out in the
  section's own "details worth knowing" list. One gap is on the fix-list (the per-OR-branch drop).
- **Gate 4 — Consumer-read: PASS.** Every runtime claim traced to enforcing code: the 7-class/26-site census;
  `getQuerySuggestions` (`:480`) and the facet-count paths (`ReactiveSearchFacetRepositoryImpl:120,148,185,270,472,662`)
  do go through the sink, so the doc's "the same syntax applies to the Dictionary search, query examples,
  lookup tables and the suggestions dropdown" is true; `jacocoExcludes`; `min-coverage-changed-files`;
  the 689-key locale parity; the springdoc timing.
- **Gate 5 — Unset-parameter audit: N/A** (no SDK builder in scope).
- **Gate 6 — Bidirectional code ↔ doc: FAIL.** Forward direction is fine — every claim on `search.md` is true
  (I re-derived each one). The **reverse** direction is where it fails: a user-visible capability shipped with
  coverage on **one** page. The immediately-preceding search slice set the standard one commit earlier —
  CTRIB-062's `e8fa107`, subject *"the sidebar has three kinds of filter, not seven facets — **swept to zero
  residue**"*, touched `Architecture.md` · `Features.md` · `data-discovery.md` · `directory.md` · `search.md` ·
  `vector-stores.md`. This slice touched `search.md` only, and three summary surfaces still describe search as
  plain free text:
  * `docs/Features.md:58-62` — "type a term, narrow by seven aggregated facets … See the dedicated page for all
    three kinds of filter, the per-result icons, and the indexing / ranking technical detail."
  * `docs/data-discovery.md` (pillar landing, Search bullet) — "**Free-text search across entity names**, seven
    aggregated facets …, and the My data scope." (CTRIB-062 updated this bullet for *its* capability.)
  * `docs/Architecture.md:42` — "**Search.** Free-text across one ranked cross-kind list, narrowed by seven
    aggregated facets …"
  Plus a **published** developer page this change makes wrong:
  `docs/developer-guides/architecture-decision-log/ADR-0071-postgres-only-runtime-dependency.md` — `:30` "matched
  with the `@@ to_tsquery(...)` operator" and `:47` "`JooqFTSHelper.java:103` … matched with `? @@ to_tsquery(?)`".
  The `? @@ to_tsquery(?)` literal is **deleted** by this diff (`ftsCondition` is now
  `DSL.condition("{0} @@ {1}", …)` over a composed expression), and the `:103` anchor was already stale.
  Finally, the new `(i)` inline-help affordance now ships on the Catalog Overview's own search bar and
  `catalog-overview.md` § "Main search" does not mention it.
- **Gate 7 — Layout and completeness: PASS.** No `SUMMARY.md` change is needed (no new page); the new
  `## Query syntax` H2 sits before `## Faceted search`, which is the right reading order (you type first, then
  filter); both new anchors resolve against real headings.
- **Gate 8 — Publishing: FAIL** (release-gated item, milestone `1.0.0`). The train exists —
  `origin/release/1.0.0` @ `9594f96` — but **no train commit carries this change**:
  * `git ls-remote --heads origin` on `documentation` returns exactly four refs —
    `contrib/CTRIB-024-docs-runs-history`, `fix/regate-0.29.0-docs-off-main`, `main`, `release/1.0.0` — and
    **none of them is `docs/CTRIB-060-*`**; `git branch -a --contains 693a31e` names only the local worktree
    branch, with no `remotes/` entry. The doc lives on a **local, unpushed** branch, so no train PR can exist
    for it (the `documentation` PR API is not readable unauthenticated, but a PR cannot exist without the
    ref). DOC-502's own
    routing says it is "to be merged into the train the way DOC-495 was (PR #109)" — with nothing pushed, there
    is no PR to make, and the content is reachable only from this machine.
  * The branch is cut from `release/1.0.0` @ `5b2bb04`; the train has since advanced to `9594f96`.
    `git merge-tree 5b2bb04 origin/release/1.0.0 <branch>` returns **exactly one conflict** — the
    `description:` frontmatter — and this slice's side reads *"…plus seven faceted filters"*, the phrasing
    CTRIB-062's `e8fa107` explicitly swept. Resolved carelessly, the merge **reinstates a sentence the train
    already corrected**. (The rest merges cleanly; the retired "Result-class tabs" section is *not* resurrected.)
  * The branch-verifiable sub-checks all **PASS** against `693a31e`: PyYAML parses the frontmatter;
    `description` is **172** chars (under GitBook's 200-char meta cap); no `: ` YAML hazard; 15 tree-relative
    links; the one outbound URL (`FTSConstants.java` on GitHub) returns **200**.
  * Live verification is owed at the 1.0.0 gate. The page as published today
    (`https://docs.opendatadiscovery.org/features/data-discovery/search`, 200) still carries the 0.29.0
    description, as expected for a release-gated change.
- **Gate 9 — Factual claim provenance: PASS.** The contributor pillar uses no `Sources:` footer (the posture
  accepted at `/review CTRIB-059` and `/review CTRIB-062`); provenance is inline in the commit body and the
  ledger, and I re-derived every load-bearing claim rather than trusting it (the eight measurements above).
  Two accuracy slips in the *record* (not the code) are on the fix-list: the ledger still says "the **ten**
  consumers" in two places after correcting the figure to 7 classes / 26 sites elsewhere in the same file, and
  both the ledger and the commit body state "Milestone: 1.0.0" for PR #1873 — the PR carries **no** milestone
  (nor do #1871 / #1862 / #1864; the milestone lives on the issue, which is correct).
- **Gate 10 — Content-type homing: PASS.** Operator-facing syntax on `data-discovery/search.md`; the wire
  contract as a `description` on `SearchFormData.query` in `components.yaml` (Swagger is the API-reference
  surface, and there is no `api-reference/search.md` page to compete with it). Nothing API-reference-shaped
  embedded in a feature page.
- **Gate 11 — Audience isolation: PASS.** Mechanical grep over every `+` line of the doc diff for
  `Cornerstone N` / `Gate N` / `LSN-` / `SHB-` / `DOC-` / `IT-` / `TST-` / `PLT-` / `CTRIB-` / `ST-N` /
  `#18xx` / `feature-flow` / `Quality Bar` / `sidecar` / `playbook` / `retrospective` / `backlog` / `scanner` /
  `lineage/` — and for the implementation names `websearch_to_tsquery` / `JooqFTSHelper` → **zero hits**. The
  operator prose names no workspace-internal artefact and no Java class.

### The live drive — the feature as a user meets it, on the reviewed build

Per `feedback_user_facing_impact_mandatory` I did not stop at the suites. I brought up a stack from the
**reviewed SUT image**, seeded six entities through the **real ingestion API**, and drove the queries:

| I typed | HTTP | total | what came back |
|---|---|---|---|
| `revcust` | 200 | 6 | all six |
| `revcust "customer orders"` | 200 | **1** | only `revcust customer orders daily` — the adjacent one (**R1**) |
| `revcust customer -test` | 200 | **4** | `revcust customer test table` **excluded** (**R2** — the pre-ST-6 build returns exactly the opposite row) |
| `revcust customer or revcust orders` | 200 | 5 | either branch (**R3**) |
| `revcus -test` | 200 | **5** | `revcus` **still prefix-matches** inside an operator query (**R4b** — `websearch_to_tsquery` would return 0 here) |
| `-revcust` | 200 | **0** | an empty page, not a scan and not a 500 (**R6**) |
| `revcust or -absentword` | 200 | 6 | the indexable branch answers; the non-indexable one is dropped (the per-branch guard) |

**And the UI, as pixels rather than as a green test.** On the home hero at 1280×800: the `(i)` sits beside the
box, the box keeps its width (616 px), and hovering renders the hint as a **padded, bordered, shadowed card**,
364×160 px, right edge at **950 px against a 1280 px viewport — no overflow**. The LSN-035 unstyled-row failure
is avoided, and the overflow I suspected from the implementer's cropped screenshot is **not** real — that was
the crop, not the layout.

**The one thing that does NOT return a page** is the finding below: a **tab or newline** between two words.
Measured on this same stack — `{"query":"revcust\tcustomer"}` returns **HTTP 500 `SYS001`** on
`/api/search/assets` **and** on the legacy `/api/search`, with
`PostgresqlBadGrammarException: [42601] syntax error in tsquery: "revcust<TAB>customer:*"` in the log; the raw
tab is then **persisted** in `search_facets.query_string`, and `GET /api/search/{uuid}`, `/results` and
`/facet/OWNERS` each return **500 on every later read**. That is the #1756 sticky-500 the manual says was fixed
in 0.28.0. It is **pre-existing**, and ST-6 makes it inconsistent rather than worse:
`{"query":"revcust\tcustomer \"customer orders\""}` returns **200**, because the operator tokenizer
normalises whitespace and the plain path does not. Filed as **PLT-263**, `user_facing_verified: true`.

### The fix-list — one rework pass, not a queue of tickets

Per the review rule on not over-logging: this item is going back anyway, so everything the rework will touch is
folded here rather than spawned as separate items. Only the one genuinely-separable upstream discovery gets its
own artefact.

**BLOCKERS**

- **B1 — Put the doc on the train, from the train's current head.** Rebase
  `documentation@docs/CTRIB-060-search-query-operators` onto `origin/release/1.0.0` @ `9594f96`. Resolve the one
  `description:` conflict by **keeping the train's** framing ("seven aggregated facets, kind and class filters,
  and the My data scope") and weaving the operators into it — do **not** take this branch's side, which reads
  "plus seven faceted filters" and would undo `e8fa107`. Re-check ≤200 chars + PyYAML after the merge. Then
  **push it** and open the train PR (the way DOC-495 went in as PR #109). Until it is pushed, the 1.0.0 release
  gate has nothing to publish.
- **B2 — Sweep the capability to zero residue**, the way `e8fa107` did for the filter framing, on the same
  rebased branch: `docs/Features.md` § Search and Filtering, `docs/data-discovery.md`'s Search bullet, and
  `docs/Architecture.md:42` each still describe the box as plain free text.
- **B3 — Correct ADR-0071.** `:30` and `:47` assert `@@ to_tsquery(...)` / `? @@ to_tsquery(?)` as the match
  expression; this change deletes that literal. Restate it for the composed expression and refresh the stale
  `JooqFTSHelper.java:103` anchor. Same train branch (the claim only becomes wrong when 1.0.0 ships).

**FOLD INTO THE SAME PASS**

- **F1 — R7's covering artifact.** Author the browser assertion the plan promised: an operator query narrows
  the rendered result list *and* the count badge agrees with the rows listed (extend
  `integration-tests/e2e/specs/catalog-search.spec.ts`). Cheaper alternative if you prefer: one
  `AssetSearchServiceIntegrationTest` case asserting an operator query's DE facet count equals the DE rows
  returned, plus one `getHighlightedResult` case with a phrase/negation query. I verified both paths correct by
  hand — this is coverage, not a defect — but the must_have currently has no artifact behind it.
- **F2 — Two comments the change made imprecise.**
  `ReactiveAssetSearchRepositoryImpl:270-272` ("a metacharacter query is stripped to word tokens by the shared
  injection-safe helper **before it reaches to_tsquery**") no longer describes the phrase/negation leaves; and
  `ReactiveDataEntityHighlightInjectionTest`'s javadoc still says the query is "operator-**stripped** upstream
  by `JooqFTSHelper.tsQuery` (#1788)".
- **F3 — Fill the run-logs.** All four `integration-tests/run-log/2026-09-01-*.md` entries were committed with
  the template placeholders intact (`runner: (fill: …)`, `evidence/notes: <captured values …>`), so the shared
  artefact does not record the 328/12 the ledger claims. The run-log is what the next session reads.
- **F4 — Ledger accuracy.** "the **ten** consumers are enumerated `file:line`" (Ambiguity table) and "all
  **ten** consumers inherit the behaviour" (Design (d)) survive from before the correction to 7 classes /
  26 call sites. And drop "Milestone: 1.0.0" from the PR description of #1873 — the PR has none, and none of
  its siblings do either. And `integration-tests/protocols/IT-003-search-tsquery-poisoning.md`'s
  `expected_result` now reads "GREEN as of CTRIB-016 / #1756 (metacharacters) **and CTRIB-060 / #1840
  (operator shapes)** (ships **0.28.0**)" — the version parenthetical was true of #1756 and is wrong for
  #1840, which ships in **1.0.0**.
- **F4b — one `must_haves` anchor does not resolve.** I ran the contract's own check mechanically:
  `grep -c "$anchor" "$path"` over all seven `must_haves.artifacts` rows returns 2 / 1 / **0** / 1 / 8 /
  11 / 2. The zero is `JooqFTSHelperTest.java` declared with `anchor: "usesQueryOperators"` — that
  identifier exists nowhere in the file; the real names are `operatorDetection` /
  `operatorDetectionMatchesPostgresGrammar` (the string `usesOperators` appears only inside the
  `@ParameterizedTest(name = …)` template). A falsifiable contract that cannot be mechanically checked
  is the one thing G-C19 exists to prevent; point the anchor at a real symbol.
- **F4c — the sidecar's commit label is one base behind.** The `JooqFTSHelper` sidecar records
  `extracted_at_commit`/`enriched_at_commit: 82e7e70e` (the pre-rebase base), while the reviewed commit is
  `6281a9df`. Its **content is fine** — I resolved its citations at the reviewed SHA and `:122`, `:174`,
  `:215` and `:274-285` all land exactly where it says, and `JooqFTSHelper.java` is byte-identical
  between `a256a9a1` and `6281a9df` — so this is a label a future reader would misread as staleness.
- **F5 — Two doc gaps inside the section you are already editing.** (a) The section opens with "The same
  syntax applies **everywhere search does**", but the same page's "Where else search appears" lists the
  Management sub-tabs, whose list-level filters do **not** run through the FTS sink (nor does the
  Relationships list search, which `data-modelling/relationships.md:90` documents as a case-insensitive
  substring match) — narrow the claim to the surfaces you enumerate. (b) The page documents the whole-query
  no-positive-term case but not the **per-branch** one: `customer or -test` silently returns only the
  `customer` matches (measured — 20 000 vs 0 in my EXPLAIN run). One sentence closes it.
- **F6 — `catalog-overview.md` § "Main search"** does not mention the `(i)` query-syntax hint that this slice
  now ships on that very surface.
- **F7 — one line, same branch, free while you are there.**
  `docs/developer-guides/architecture-decision-log/ADR-0079-ingestion-authentication-filter-coverage.md`
  carries a **240-character** `description:` — over GitBook's 200-char meta cap, so its live
  `<meta name="description">` and `og:description` will be silently truncated mid-word. It is train-only
  (publishes at 1.0.0), i.e. still fixable before anyone reads it. (Not its own item: nothing else in the
  backlog covers it and you are editing that directory for B3 anyway.)

**SEPARATE — logged, not folded**

- **`issues/odd-platform/PLT-263-tab-newline-in-search-query-500s.md`** (severity high, `status: draft`). A tab
  or newline in the query still reaches `to_tsquery` unsplit — `tsQuery()` strips only `[!&'()*:<>|\\]` and
  splits on a *literal single space* — so `to_tsquery(E'foo\tbar:*')` raises `42601` → HTTP 500, and the legacy
  path persists the query in the `search_facets` session row, reproducing the #1756 sticky-500 shape the manual
  says was fixed in 0.28.0. Reachable through `POST /api/search` and through a shared `/search?q=foo%09bar`
  link (the FE passes `q` through verbatim), and anonymously under `auth.type=DISABLED`. **Pre-existing — not a
  regression from this change** — but this change makes it *inconsistent*: inside the new operator path the
  tokenizer splits on `Character.isWhitespace`, so `foo<TAB>bar "x"` is safe while `foo<TAB>bar` still 500s.
  It is a one-line fix (`split("\\s+")`) inside the very method this PR owns; fold it into the rework if you
  want it closed in one change rather than two — that is a maintainer call, since it is outside the approved
  plan.
- **`backlog/docs/DOC-514`** (high, `status: pending`). Three links on the **published**
  `developer-guides/build-and-run/custom-collectors.md` are written one directory too high, so GitBook
  renders them as raw `github.com/.../blob/main/...` URLs — I curl'd all three and all three **404**. It is
  released truth on docs `main`, a different page and a different branch from this rework, and nobody else is
  about to touch it — hence its own item rather than the fix-list.

### What I am NOT holding against this item

Worth stating, so the rework does not over-correct:

- **The mechanism substitution is right, and the reasoning is the best I have reviewed in this workspace.**
  Replacing the issue's named `websearch_to_tsquery` with a compositional build was not a preference — it
  preserves a promise the manual makes in print (`search.md`: "matches the remaining words **as prefixes**"),
  and I confirmed the cost first-hand: under `websearch_to_tsquery`, `cust` stops matching "Customers", so
  refining `cust` to `cust -test` would return nothing. The divergence was surfaced at GATE 1 rather than
  absorbed silently, and the public thread carries it.
- **The sink, not the endpoint, is the right unit of change.** The facet counts run through the same helper;
  operators on the list but not the count path would have reproduced the PLT-176 count-badge-contradicts-list
  class. Widening the scope *reduced* the diff.
- **The guard is proved by mutation, not by assertion**, and the OR assertion was hardened (a neighbour seeded
  and asserted absent) after the ontology pass showed a presence-only assertion would pass with the guard
  disabled. That is the standard this workspace asks for and rarely gets.
- **The patch-coverage gate is reported as inert rather than as "100 %".** I checked; it is inert. Saying so is
  the harder and correct call.
- **The FE reuses the platform's inline-help pattern** (ADR-0076 `InformationIcon` + `AppTooltip`) and *moves*
  the shared `TooltipBody` rather than copying it, with the string in all seven locales at exact key parity.
  The screenshots in `contributor/evidence/` show the tooltip rendering as a padded, bordered card — the
  LSN-035 unstyled-row failure avoided.
- **The e2e attribution work was done honestly.** The overnight 20-failure run was not written up as
  "environmental"; it was held as UNRESOLVED until a quiet-box A/B produced a `diff`-empty, test-name-identical
  failing set against a pure-`main` SUT, and the two harness traps hit on the way (the LSN-033 shared-checkout
  rebuild; `run-suite.sh` warning-but-proceeding on a digest mismatch) were self-caught and filed as TST-060.

### Summary lines

- **Outbound URL sweep**: on the changed doc page — 9 unique relative links, all resolving against the tree;
  2 same-page anchors, both resolving against real headings; 1 external URL (`FTSConstants.java` on GitHub)
  **200 via curl**. 0 broken. Tree-wide (the editorial audit, `origin/release/1.0.0`, 137 pages): 5 unresolvable
  relative targets, of which 2 are markdown-escaped underscores (false positives) and **3 are real and live** —
  filed as DOC-514 with the three GitHub-fallback URLs curl'd to 404.
- **Banned-phrase check**: none used. Every verdict line above ends in a citation, a measured number, or an
  explicit "not measured".
- **Regressions**: **none attributable.** My own four-suite run on a SUT **I built** from the reviewed
  commit (`ODD_SUT=ref:6281a9df`, throwaway worktree, image `sha256:a154cc2b`, independent of the
  implementer's): `feature-complete` **328 passed / 12 failed** (33.4m) · `known-bugs` **3 RED — exactly
  the three pins, zero unexpected GREENs** · `multi-stack` **14/0** · `ingestion-e2e` **15/0**. The 12 are
  **fully attributed with zero residue**: TST-059's named eleven (`catalog-search` 48/62 ·
  `entity-class-type-badge-list` 59/77 · `recently-viewed-record-see-loop` 117/213 · `search-url-state` 38 ·
  `search-result-stale-signal` 62 · `search-result-row-click` 45 · `search-class-tab-filter` 149 ·
  `popular-entities-ranking` 62) **plus** `swagger-openapi-discovery:63`, which TST-059 itself names as
  TST-057's order-dependent cold-springdoc instance — the same springdoc slowness as my one unit failure.
  Byte-identical to the implementer's 328/12 and to their pure-`main` A/B. `api:FAIL` is TST-058, the dead
  `lineage/_extractor` rail (hatchling rejects `readme = "../README.md"`), reproduced verbatim.
  **The unit build's own numbers are above.** I filled my four run-log entries by hand rather than leaving
  the harness template — which is the same defect F3 raises against the implementer's.
- **Navigation**: **consistent, and improved.** `navigation/domains/search.md` gains an accurate
  `JooqFTSHelper` entry (I re-counted the "7 repository classes / 26 call sites" figure — it is exact),
  a `ReactiveDataEntityRepositoryImpl` entry naming `getHighlightedResult` + `getQuerySuggestions`, and a
  `MainSearchInput` / `SearchSyntaxHint` UI pointer. No pointer went stale.
- **Upstream issues logged**: `issues/odd-platform/PLT-263-tab-newline-in-search-query-500s.md` (draft, high).
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: `docs/data-discovery/**` read end-to-end (all 17 pages); `docs/data-glossary/**`,
    `docs/data-modelling/**`, `docs/master-data-management/**` and `docs/developer-guides/**` covered by a
    targeted read of every surface whose search behaviour this change alters plus an FTS-claim sweep; plus a
    **tree-wide mechanical sweep of all 137 pages** on `origin/release/1.0.0` for unresolvable relative links,
    duplicate heading/anchor slugs, YAML-parse failures and >200-char descriptions. **Queued for the next
    `/review`**: `docs/active-platform-features/**`, `docs/configuration-and-deployment/**`,
    `docs/integrations/**`, `docs/data-lineage/**`, `docs/data-quality/**`, `docs/use-cases/**` and the root
    pages, read end-to-end rather than swept.
  - **Findings**:
    - **DOC-510 re-derived, not re-filed** (critical, internal contradiction — security posture). My
      duplicate-anchor sweep surfaced two `### Authentication` headings under one H2 on `odd-platform.md`;
      reading both showed them contradicting each other on whether `auth.ingestion.filter.enabled` protects
      the AlertManager webhook (`:641` says yes from 0.29.0 per ADR-0079; `:713`, a `danger` admonition, says
      the flag "has no effect on this endpoint" and the fix has not shipped). I confirmed both are on the
      **live** page and that `metrics-ingestion.md:76` carries a third copy — and only then grepped the
      backlog and found **DOC-510** already owns it, filed by the previous `/review` from a completely
      different entry path (`active-platform-features/**`) and covering **six** pages rather than my three.
      Nothing new to add, so **no item was created** (LSN-009). Recording it because an independent
      re-derivation from a different direction is convergent evidence that DOC-510's `critical` priority is
      right. *(I drafted a DOC-515 before grepping, then deleted it — grep-the-backlog-first is the rule and
      I ran it second.)*
    - **DOC-514** (high, cross-link mismatch / LSN-004 GitHub-fallback shape) — three links on the published
      `developer-guides/build-and-run/custom-collectors.md` are written one directory too high; GitBook
      renders them as raw `github.com/.../blob/main/...` URLs that **all 404** (curl'd). Source:
      `docs/developer-guides/build-and-run/custom-collectors.md:386,465,471`.
    - Three findings that belong to this item's own rework rather than to a new ticket are on the fix-list
      above instead of being logged separately (F5a "everywhere search does", F5b the per-OR-branch drop,
      F6 the `(i)` affordance on `catalog-overview.md`), per the do-not-over-log rule — the implementer is
      editing those exact files in the same pass.
  - **Verified non-findings** (recorded so the next audit does not re-derive them): the three inbound links to
    ambiguous anchors on `odd-platform.md` (`#authentication` ×2, `#known-limitations`) all resolve to their
    *intended* section, because in each case the intended target is the first occurrence; the repeated
    sub-headings on `deployment.md` / `trylocally.md` are parallel-structure siblings with no inbound bare-slug
    links; `business-names.md`'s claim that search matches both the technical and the business name is true
    (`FTSConstants` weights `DATA_ENTITY.INTERNAL_NAME` and `EXTERNAL_NAME` at 'A').

### Notes

- **The reviewer's own resource discipline.** The heavy-e2e flock was acquired by `run-regression.sh
  revctrib060` and released on exit; the stack was torn down. `lineage/**` was **not** written — this review
  ran no `/enrich` and no probe, and `git status --short lineage/` is empty. This review commits exactly the
  verdict, `state/PROGRESS.md`, its own `state/active-streams.yaml` entry, and the three follow-up artefacts
  (PLT-263, DOC-514, DOC-515).
- **A process slip of mine, disclosed rather than hidden.** While reading train content I ran
  `git checkout origin/release/1.0.0 -- .` in `../documentation`, which staged 25 files and added 3 in the
  shared checkout. Fully reverted (`git reset HEAD -- .`, `git checkout -- .`, `git clean -f` on exactly those
  three paths); the tree is verified clean at `0032ef3` on `contrib/CTRIB-026-docs-entity-detail-truncation`.
  The correct read is `git show <ref>:<path>`, which is what the rest of the audit used.
- **One environmental note for the next stream.** The first SUT build died with
  `java.lang.OutOfMemoryError: Java heap space` in `:odd-platform-api:compileJava` ten minutes in, immediately
  after the 28-minute full unit build — the same shape the ledger already records, and it left a **799 MB**
  `java_pid2576983.hprof` in the odd-team root (`.gitignore:248` covers `*.hprof`, so it is untracked, but it
  is still 799 MB on disk). The retry, on a box with the daemon gone, succeeded. Worth folding into TST-060's
  "the flock guards regressions but not resource pressure" framing rather than a new item.
- **On the verdict.** Everything that makes this change *work* is verified and, in several places, verified
  more strictly than the item claims. What is missing is the half of the Definition of Done that the manual
  depends on: the doc exists as one good page on a branch nobody can reach, cut from a base the train has
  moved past, while three summary surfaces and one published ADR still describe the old behaviour. The
  preceding slice's own commit — *"swept to zero residue"* — is the standard, and it is one rebase and four
  small edits away.

## Implement round 2 (2026-09-01, session: ctrib060r2) — the review's fix-list, closed

`/review CTRIB-060` (session `review-ctrib060`) rejected the first push on **Gate 8** and **Gate 6**, both on
the documentation half of the DoD, and left three blockers plus nine fold-ins. This is what each one became.
Same session as the review, which the separate-session rule permits for `/implement` — **the next `/review`
must be fresh**.

### Blockers

| # | What the review found | What was done |
|---|---|---|
| **B1** | The doc lived on a **local, unpushed** branch cut from `release/1.0.0` @ `5b2bb04` while the train had moved to `9594f96`; `git merge-tree` showed one conflict — the page `description:` — whose CTRIB-060 side reinstated the "seven faceted filters" phrasing `e8fa107` had swept | Rebased onto `9594f96`. The conflict was resolved **in favour of the train** — the new description keeps `seven facets, kind and class filters, and My data` and adds the operators, 178 chars. Branch pushed; **documentation PR [#111](https://github.com/opendatadiscovery/documentation/pull/111)** opened against `release/1.0.0`, the way DOC-495 went in as #109 |
| **B2** | The capability was documented on **one** page; the preceding search slice's own commit (`e8fa107`, *"swept to zero residue"*) touched six | `Features.md` § Search and Filtering, `data-discovery.md`'s Search bullet and `Architecture.md:42` now name the prefix rule and the three operators and link `#query-syntax` |
| **B3** | Published `ADR-0071` asserted `? @@ to_tsquery(?)` — a literal this diff deletes — behind a line anchor that had already drifted | `:30` and `:47` restated for the composed tsquery, anchored on the method names (`ftsCondition`, `tsQueryExpression`) rather than a line number, and saying what changed and when |

### Fold-ins

- **F1 — R7's covering artifact.** The promised browser assertion was **not** written into
  `catalog-search.spec.ts`: that spec is one of TST-059's permanently-RED set (it still waits on the endpoint
  ST-4 retired), so a new assertion there would have been born red and proved nothing. Instead, in
  `ReactiveDataEntitySearchResultsTest` — the class that already pins "the count agrees with the listing" for a
  plain query — two cases assert the same agreement for an **operator** query, across **three different
  queries in two repositories**: `findByState` (the list), `countByState` (the total) and
  `getEntityClassFacetForDataEntity` (the sidebar badge). **Both are RED on `origin/main` @ `b5d9f150`** and
  green here, so they are a behavioural pin rather than a tautology.
- **F1b — the highlight half, and a correction to my own assumption.** Two `getHighlightedResult` cases were
  added, then I measured what they actually discriminate and found the answer was *nothing*: `ts_headline`
  marks up every lexeme **mentioned** in the tsquery regardless of structure, so `'custom' <-> 'order'` and
  `'custom':* & 'order':*` produce byte-identical output — and so do `!'test' && 'custom':*` and
  `'custom':* & 'test':*`. A **negated term is highlighted too.** The tests are kept, with a comment stating
  exactly that and pointing at the one construction that does hold the property (a single
  `tsQueryExpression` call in `getHighlightedResult`). The doc sentence that implied an exclusion is
  "reflected in why a row matched" was corrected on the train branch, because it is the kind of line an
  operator checks against the screen on their first operator query.
- **F2** — the unified-search FTS comment (`ReactiveAssetSearchRepositoryImpl`) and the highlight test's
  javadoc now describe the composed expression instead of "stripped to word tokens before it reaches
  `to_tsquery`".
- **F3** — the four `run-log/2026-09-01-*` entries this stream left as the harness template are filled, each
  labelled as *filled retrospectively from the ledger, not re-executed*. The `ctrib062g` / `revctrib0623`
  entries in the same files belong to another stream and were left alone.
- **F4** — "the **ten** consumers" corrected to 7 classes / 26 call sites in both places it survived; the
  IT-003 protocol's `expected_result` no longer claims ST-6 ships in 0.28.0 (it ships in 1.0.0); the PR body's
  free-text `Milestone: 1.0.0` line is gone — the milestone lives on the issue, which is where the gate reads
  it, and no sibling PR carries one.
- **F4b** — the `must_haves` artifact anchor `usesQueryOperators` existed nowhere; it is now
  `operatorDetectionMatchesPostgresGrammar`, and a mechanical `grep -c "$anchor" "$path"` over all seven rows
  returns non-zero for every one.
- **F4c** — the `JooqFTSHelper` sidecar's `extracted_at_commit` / `enriched_at_commit` label moved from the
  pre-rebase base to `6281a9df`. Its content was already correct at that SHA (the review resolved its
  citations there), so this is a label, not a re-enrichment.
- **F5 / F6 / F7** — the "everywhere search does" over-claim is narrowed to the full-text surfaces (with the
  Management sub-tabs and the Relationships list named as the plain-name-filter exceptions); the per-OR-branch
  drop is documented (`customer or -test` returns the customer matches, not "plus everything that is not
  test"); `catalog-overview.md`'s Main search section names the `(i)`; `ADR-0079`'s 240-char description is
  down to 180.

### Not folded, on purpose

**PLT-263** — the tab/newline `42601` → sticky 500 — is **not** in this PR. It is a live defect in the very
method this change owns and a one-line fix, but it is outside the GATE-1-approved plan and changes behaviour
for an input class the plan never covered. The review filed it with an end-to-end reproduction
(`user_facing_verified: true`); folding it is the maintainer's call, not the implementer's.

### Gates re-run

| Gate | Result |
|---|---|
| Unit — full CI replica at the reworked tree | **814 tests / 1 failure** across 181 classes, checkstyle + assemble green (25m10s). 814 = the reviewed 810 + the 4 new cases, and **all four pass**; the two touched classes are clean (`ReactiveDataEntitySearchResultsTest` 11/0, `ReactiveDataEntityHighlightInjectionTest` 5/0). The one failure is `OpenApiDocsContractTest.platformApiGroupDocumentLoads` **again** — the same load-sensitive 60 s springdoc read the review measured passing ALONE in 4m18s with a 23.4 s init, and that upstream CI reports green on this branch head. Non-attributable, and now reproduced a third time (TST-061) |
| Integration | **Carried over, and the carry-over is proved, not assumed**: `git diff` of `odd-platform-api/src/main/java` between the reviewed commit and this one contains **only comment lines** (verified by stripping `+`/`-` and filtering out `//`, `*`, `/*` — nothing remains), so the SUT image is behaviourally identical to the one `/review` built and ran to `feature-complete` 328/12 (zero unattributed) · `known-bugs` 3-RED-expected · `multi-stack` 14/0 · `ingestion-e2e` 15/0 |
| RED proof on the new tests | Both R7 cases **FAIL on `origin/main` @ `b5d9f150`** (`16 tests completed, 2 failed`) and pass here |
| Docs mechanical sweeps | Gate 11 banned-term grep over every changed line: **zero hits**. Every changed page's `description:` parses under PyYAML and is under 200 chars. Every link and anchor on the changed pages resolves; the new `#query-syntax` anchor resolves from all three inbound pages |

**One pre-existing broken anchor found while checking the changed pages and deliberately not fixed here**:
`Architecture.md` links `configuration-and-deployment/odd-platform.md#attachment-storage`, and the live page's
id is `attachment-storage-configuration` (confirmed by fetching it — the short form returns zero hits). That is
**released truth** and belongs on docs `main`, not on a train that publishes at 1.0.0, so it is recorded on
`DOC-514`, which already owns exactly this class for `custom-collectors.md`. A second candidate the same sweep
raised — `Features.md` → `#additional-navigation-links-odd.links` — was checked against the live page and is
**valid** (GitBook keeps the dot); recording it so the next sweep does not re-derive it as a finding.

## Review (2026-09-02, session: review-ctrib060r2) — ROUND 2

- **Result**: **REJECTED** — `pr-draft` → **`blocked`**. Round 2 closed all three blockers and all nine
  fold-ins from the first review, and I re-derived that rather than reading it. What fails is **one table row
  on the page this item authors**: `| -"test fixture" | entities that do not contain that phrase |` is the
  only row in the Query-syntax table that does not work as typed — it returns **No matches found**, and the
  page's own bullet four items below says so. One blocker, one fold-in, two-word fix, on a doc PR that is
  already open.
- **Session boundary**: fresh session. Round 2 (`ctrib060r2`) ran inside the `review-ctrib060` session and
  says so; the separate-session rule binds `/review`, and this is the fresh one it asked for.
- **Cheap precondition (the 2-minute bounce)**: NOT triggered — but I checked its premise rather than
  accepting it. The round-2 gates table records unit **814/1 at the reworked tree** and argues the integration
  bucket carries over because the production delta is comment-only. I verified that argument myself before
  accepting it (below), and then re-ran the unit bucket anyway.

### Reviewed subject (verified, not assumed)

| fact | value | how verified |
|---|---|---|
| worktree | `../odd-platform-ctrib060` @ `cda7d277`, **clean**, 2 commits ahead of `origin/main` `b5d9f150` | `git status -sb` + `git log` |
| PR #1873 | head SHA **== `cda7d277`**, `draft: true`, base `main` `b5d9f150`, 19 files +697/−61 | GitHub PR API (App token) |
| upstream CI at `cda7d277` | **6/6 SUCCESS** — `run_tests`, `Test Results`, `run_playwright_tests/{test,lint,format-check}`, `update_release_draft` | GitHub check-runs API |
| PR #1873 milestone | **none** — F4's "drop the free-text `Milestone: 1.0.0` line" is done; no sibling PR carries one either | PR API `milestone: None`, body grep |
| doc branch | `origin/docs/CTRIB-060-search-query-operators` @ **`b67bfba`** — **pushed**, merge-base with `origin/release/1.0.0` **== `9594f96`** (the train head), `git merge-tree` → **0 conflicts** | `git ls-remote` + `git merge-base` + `git merge-tree` |
| documentation PR #111 | **open**, base `release/1.0.0`, head `b67bfba`, `mergeable_state: clean`, draft | documentation PR API (App token) |
| G-C15 dangerous zone | **does not fire.** Across the whole branch the four test files are `40/2`, `80/0`, `137/0`, `145/0` — and the only `-2` is two javadoc comment lines. **No assertion, matcher or expected value was changed**, nothing skipped, disabled or deleted | `git diff --numstat` + reading the one non-append diff |

### The three blockers — each re-derived, not read

- **B1 — the doc is on the train, from the train's head. CLOSED.** The branch is pushed (it was not, last
  round: `git ls-remote --heads origin` returned four refs and none was `docs/CTRIB-060-*`; it now returns
  five and the fifth is `b67bfba`). Its merge-base with `origin/release/1.0.0` **is** `9594f96`, so it is
  rebased onto the current train head, not the `5b2bb04` it was cut from. `git merge-tree` returns **zero**
  conflict markers, so the `description:` collision is genuinely resolved rather than deferred. And the
  resolution went the way the fix-list asked: the new description keeps the train's `seven facets, kind and
  class filters, and My data` framing (`e8fa107`'s sweep is preserved, the "plus seven faceted filters"
  phrasing is gone) and adds the operators — **178 chars**, under the 200-char GitBook meta cap.
  Train PR **#111** exists against `release/1.0.0`, the way DOC-495 went in as #109.
- **B2 — the capability is swept to zero residue. CLOSED.** All three summary surfaces now carry it, each
  linking `#query-syntax`: `Features.md` § Search and Filtering (*"Words match as prefixes, and three
  operators refine a query that returns too much"*), `data-discovery.md`'s Search bullet (*"Prefix-matched
  free-text search … with a [query syntax](…#query-syntax) for the cases a plain query is too blunt for"*),
  and `Architecture.md:42` (*"Prefix-matched free-text across one ranked cross-kind list — with a small query
  syntax (quoted phrase, `-exclusion`, `or`)"*). That is the six-page precedent `e8fa107` set, applied.
- **B3 — ADR-0071 is corrected, and the correction is true. CLOSED, and I checked the new claims at the
  reviewed SHA rather than the old ones.** `:30` now says the vector is *"matched with the `@@` operator
  against a `tsquery` the platform composes from Postgres's own text-search constructors"* — and
  `JooqFTSHelper.ftsCondition:120` is literally `DSL.condition("{0} @@ {1}", vectorField,
  tsQueryExpression(plainQuery))`. `:47` re-anchors on **method names** instead of the stale `:103` line
  number, and both resolve: `ftsCondition` at `:120`, `tsQueryExpression` at `:197`. Its
  `V0_0_1__init.sql:196` citation lands exactly on `search_vector tsvector GENERATED ALWAYS … STORED`. The
  three named constructors are all present and all reachable: `to_tsquery` (`:330`), `phraseto_tsquery`
  (`:325`), `plainto_tsquery` (`:301`).

### The nine fold-ins — mechanically checked

- **F1 — R7's covering artifact. CLOSED, and the RED proof is mine.** Two cases in
  `ReactiveDataEntitySearchResultsTest` assert that a phrase query and a `-exclusion` query partition **three
  different queries in two repositories** identically — `findByState` (the list), `countByState` (the total),
  `getEntityClassFacetForDataEntity` (the sidebar badge). I dropped the file onto the pure-`origin/main`
  worktree `../odd-platform-ctrib060base` @ `b5d9f150` and ran it: **11 tests completed, 2 failed** — and the
  failures are for exactly the right behavioural reason, not a wiring error:
  - phrase → `["r7phrase customer orders daily", "r7phrase orders shipped from customer"]` where 1 row was
    expected — the quotes are ignored on `main`, so a non-adjacent row matches;
  - negation → `["r7neg customer test table"]` — on `main` the query returns **precisely and only the row it
    was asked to exclude.** That is the inversion this slice exists to fix, demonstrated by the test.
  Both pass here (they are inside my 814 below). A behavioural pin, not a tautology. Base worktree restored
  to clean afterwards.
- **F1b — the highlight half, and the honest correction.** Two `getHighlightedResult` cases were added, then
  the implementer measured what they discriminate and found the answer was *nothing* — `ts_headline` marks
  every lexeme **mentioned** in the tsquery regardless of structure. I re-measured that on a throwaway
  `postgres:13.2-alpine`: `ts_headline('Customers test table', <the composed customer -test tsquery>)` →
  `<b>Customers</b> <b>test</b> table`. **A negated term is highlighted.** The tests are kept with a comment
  saying exactly that, and the manual sentence that implied otherwise was corrected on the train branch —
  *"every word you typed, including an excluded one, so `customer -test` still marks `test`"*. Disclosing a
  test that proves less than its author first thought is the right call and it is the harder one.
  (One naming residue is on the fix-list — F-A.)
- **F2 — comments. CLOSED.** `ReactiveAssetSearchRepositoryImpl:267-274` no longer says "stripped to word
  tokens **before it reaches** `to_tsquery`"; the highlight test's javadoc no longer says
  "operator-**stripped** upstream". Both now describe the composed expression.
- **F3 — run-logs. CLOSED.** All four `2026-09-01-*` ctrib060 entries carry real numbers and are each
  labelled *"filled retrospectively from the ledger, not re-executed here"* — which is the honest form. The
  `revctrib0623` template residue in the same files belongs to another stream and was correctly left alone.
- **F4 — ledger accuracy. CLOSED.** "the **ten** consumers" survives only inside the *first review's own
  fix-list text* (the record of the fix), not as a live claim: the Ambiguity table and Design (d) both read
  7 classes / 26 call sites. I re-counted from source: `grep` over `repository/reactive/*.java` gives
  **exactly 7 classes**, **26** `ftsCondition`+`ftsRankField` sites, **plus 1** direct `tsQueryExpression` in
  `getHighlightedResult` — 27 total, which is the figure the ledger states, split the way it states it.
  `IT-003`'s `expected_result` now reads "(metacharacters, ships 0.28.0) and CTRIB-060 / odd-platform#1840
  (operator shapes, ships **1.0.0**)". And there is no second FTS dialect anywhere: `grep` for
  `to_tsquery|plainto_tsquery|phraseto_tsquery|websearch_` over `src/main` returns only `JooqFTSHelper` plus
  three **comment** lines.
- **F4b — the `must_haves` anchors. CLOSED, checked mechanically the way the contract asks.**
  `grep -c "$anchor" "$path"` over all seven rows now returns **2 / 1 / 1 / 1 / 7 / 11 / 2** — non-zero for
  every one. The dead `usesQueryOperators` is now `operatorDetectionMatchesPostgresGrammar`, which resolves.
- **F4c — the sidecar label. CLOSED and still correct at the new head.** The `JooqFTSHelper` sidecar records
  `extracted_at_commit`/`enriched_at_commit: 6281a9df`; `JooqFTSHelper.java` is byte-identical between
  `6281a9df` and `cda7d277` (the round-2 delta does not touch it), so the label is accurate, not stale.
- **F5 / F6 / F7 — CLOSED.** (a) "everywhere search does" is narrowed to *"every **full-text search**
  surface"* with the Management sub-tabs and the Relationships list named as the plain-name-filter
  exceptions; (b) the per-OR-branch drop is documented — *"`customer or -test` returns the `customer`
  matches, not 'the customer matches plus everything that is not test'"*; (c) `catalog-overview.md` § Main
  search names the `(i)`; (d) `ADR-0079`'s description is **180** chars, down from 240. My tree-wide sweep
  over all 137 pages on `origin/release/1.0.0` still reports that 240 — because it ran on the train **base**,
  which is exactly the point: this branch is what fixes it.

### Unit bucket — my own full CI-replica run at the reviewed SHA

`ODD_PLATFORM_DIR=../odd-platform-ctrib060 scripts/run-platform-tests.sh`, 27m08s:

**814 tests completed, 1 failed** — 0 errors, 0 skipped, across **181 test classes** (parsed from the JUnit
XML myself, every `<failure>`/`<error>` enumerated; XML mtimes `10:21`, i.e. this run, not a stale artefact).
**Byte-identical to the round-2 ledger's 814/1**, and 814 = the previously-reviewed 810 + the 4 new cases,
**all four of which pass**.

The single failure is `OpenApiDocsContractTest.platformApiGroupDocumentLoads()` —
`IllegalStateException: Timeout on blocking read for 60000000000 NANOSECONDS`. Non-attributable, now
reproduced a **fourth** time (TST-061): the first review measured the class passing **alone** in 4m18s with a
23.4-second springdoc init against a 60-second bound, and **upstream CI's `run_tests` is GREEN on this exact
SHA** (`cda7d277`, 6/6).

**Checkstyle — run separately, because my `build` never reached it.** `:test` failed, so gradle stopped
before `check`'s remaining tasks and no checkstyle report exists from that invocation. I ran
`:odd-platform-api:checkstyleMain :odd-platform-api:checkstyleTest` on their own: **BUILD SUCCESSFUL in
3m01s, both tasks executed.** The build script sets `ignoreFailures = false` and `maxWarnings = 0` (and
disables the XML/HTML reports), so a successful run *is* the zero-violation result. `assemble` also ran (jar
written at 09:55, mid-build). Recording the gap and how I closed it rather than inheriting the ledger's
"checkstyle green".

### Integration bucket — carried over, and I verified the carry-over rather than accepting it

The round-2 claim is that the SUT is behaviourally identical to the one `/review CTRIB-060` built and ran, so
the four-suite verdict carries. **I tested that claim, and it holds:**

```
git diff --stat 6281a9df..cda7d277
  ReactiveAssetSearchRepositoryImpl.java   |  8 ++      <- src/main
  ReactiveDataEntityHighlightInjectionTest |  42 ++
  ReactiveDataEntitySearchResultsTest      |  80 ++
```

The whole `src/main` delta is **one comment block** in `ReactiveAssetSearchRepositoryImpl:267-274`. Stripping
the `+`/`-` markers and filtering out `//`, `*`, `/*` lines leaves **nothing**. No FE change, no resource
change, no spec change. The image `/review CTRIB-060` built from `6281a9df`
(`ODD_SUT=ref:6281a9df`, `sha256:a154cc2b`) is therefore the same system, and its result stands:
`feature-complete` **328/12 with zero unattributed** (TST-059's eleven + TST-057's
`swagger-openapi-discovery:63`) · `known-bugs` **3 RED, expected, zero unexpected GREENs** ·
`multi-stack` **14/0** · `ingestion-e2e` **15/0**. I did **not** take the heavy-e2e flock; re-running 50+
minutes of e2e against a provably identical binary would burn the machine for no information.

### Acceptance criteria — the `must_haves` truths

- [x] **R1 quoted phrase** — PASS. `"customer orders"` → `'custom' <-> 'order'`; RED-on-`main` proved by my
      own run (2 rows returned where 1 was expected).
- [x] **R2 negation EXCLUDES** — PASS, with the strongest RED available: on `main` the query returns
      **exactly the row it was asked to exclude** (`["r7neg customer test table"]`), measured by me.
- [x] **R3 `or`** — PASS. `'custom':* | 'order':*`; pinned by `AssetSearchServiceIntegrationTest`.
- [x] **R4 plain-term parity** — PASS, and **structural**: `operatorGroups` returns `null` when
      `QUERY_OPERATORS` does not match, and the caller then takes `prefixTsQuery` — the identical single
      `to_tsquery(tsQuery(q))` call the pre-existing path made. Not test-dependent.
- [x] **R4b prefix survives inside an operator query** — PASS. `appendBareTerms` routes the bare terms of an
      operator query through the **same** `prefixTsQuery` call, so `cust -test` still prefix-matches. I
      confirmed the underlying promise on real Postgres: `to_tsvector('Customers Orders') @@
      to_tsquery('cust:*&ord:*')` → `t`.
- [x] **R5 fail-closed** — PASS for this item's scope. Every leaf is a Postgres constructor that cannot
      raise, every user value is a bind, and past 64 operator leaves the query fails **closed** rather than
      falling back to the plain path (which would read `-x` as *required* — the right call, and commented as
      such). The pre-existing tab/newline `42601` is **PLT-263**, filed, not a regression.
- [x] **R6 no positive term → empty page, no sequential scan** — PASS. Per-**branch** guard
      (`querytree({0}) = 'T' → CAST('' AS tsquery)`), which is the correct granularity; I re-measured the
      algebra it rests on: `querytree((!! phraseto_tsquery('test fixture')))` → **`T`**, and the guarded
      expression against a non-matching document → **`f`**.
- [x] **R7 list / total / facet counts / ranking / highlights all agree** — **PASS, and now with the
      artifact.** This was the one PARTIAL last round. Closed by F1, RED-verified on `main` by me.

### Quality Bar

- **Gate 1 — No duplicates: PASS** via `grep` over `src/main` for
  `to_tsquery|plainto_tsquery|phraseto_tsquery|websearch_` → only `JooqFTSHelper` plus three comment lines.
  No second dialect; the change reuses the single sink.
- **Gate 2 — Aliases: N/A** via read of the changed doc pages — no new platform vocabulary; "quoted phrase" /
  "exclusion" / "operator" are ordinary English in the operator's voice.
- **Gate 3 — Caveats captured: PASS** via read of `search.md` — the metacharacter caveat is an amended
  `{% hint style="info" %}` admonition (not a duplicate), and it now tells the reader what `"` and `-` did
  **before** (silently ignored; `-word` read as *required*). The no-positive-term and per-OR-branch surprises
  are both in the section's "details worth knowing" list.
- **Gate 4 — Consumer-read: PASS** via `grep` census re-derived at `cda7d277` — 7 classes / 26 + 1 sites,
  enumerated above. The doc's surface list (Catalog, Dictionary, query examples, lookup tables, suggestions)
  maps 1:1 onto those classes.
- **Gate 5 — Unset-parameter audit: N/A** — no SDK builder in scope.
- **Gate 6 — Bidirectional code ↔ doc: FAIL.** Reverse direction is now fine (B2 closed it). The **forward**
  direction fails on one claim: `search.md`'s Query-syntax table row
  `| -"test fixture" | entities that do not contain that phrase |` has no code evidence — the code returns
  the opposite. See the fix-list. Every other claim on the page I traced to code or measured on Postgres.
- **Gate 7 — Layout: PASS** via read — no `SUMMARY.md` change is owed (no new page); `## Query syntax` sits
  before `## Faceted search`, which is the right reading order (type first, then filter); `#query-syntax`
  and `#per-result-transparency` both resolve against real headings (`:15` and `:117`), and `#query-syntax`
  resolves from all three new inbound pages.
- **Gate 8 — Publishing: PENDING-RELEASE (1.0.0)** — and this time the train precondition is genuinely met
  (it was the round-1 failure). Branch pushed @ `b67bfba`, cut from the train head `9594f96`, zero merge
  conflicts, PR #111 open against `release/1.0.0`. Branch-verifiable sub-checks against the train commit, all
  **PASS**: PyYAML parses the frontmatter on all 7 changed pages; every `description` is ≤200 chars
  (178 / 173 / 161 / 191 / 178 / 189 / 180); no `: ` YAML hazard; every relative link and anchor on the
  changed pages resolves. Live today: `https://docs.opendatadiscovery.org/features/data-discovery/search`
  → **200**, still carrying the 0.29.0 description and **no** Query-syntax section — exactly right for a
  release-gated change. **Owed at the 1.0.0 gate**: fetch that URL plus `/features/`-prefixed
  `data-discovery/catalog-overview`, `Features`, `data-discovery`, `Architecture`,
  `developer-guides/architecture-decision-log/adr-0071-…` and `…/adr-0079-…`, and confirm the phrases
  *"Query syntax"*, *"bare words as prefixes"*, *"a quoted phrase and an excluded word match exactly"*, and
  the corrected ADR-0071 `@@`-against-a-composed-tsquery sentence render.
- **Gate 9 — Factual claim provenance: PASS.** The contributor pillar uses no `Sources:` footer (the posture
  accepted at `/review CTRIB-059`, `CTRIB-062` and round 1); provenance is inline in the commit bodies, and
  I re-derived every load-bearing claim rather than trusting it — the census, the ADR-0071 citations, the
  `querytree`/`ts_headline`/prefix algebra on a real `postgres:13.2-alpine`, the RED-on-`main` behaviour, the
  CI status, the train topology, and the seven `description` lengths. Both commit bodies carry `Sources:` /
  `EVIDENCE` blocks anyway.
- **Gate 10 — Content-type homing: PASS** — operator-facing syntax on `data-discovery/search.md`; the wire
  contract as a `description` on `SearchFormData.query` in `components.yaml` (Swagger is the API-reference
  surface); the developer-audience restatement on the ADR-log page. Nothing API-reference-shaped embedded in
  a feature page.
- **Gate 11 — Audience isolation: PASS.** Mechanical grep over **every added line** of the doc diff for
  `Cornerstone N` / `Gate N` / `LSN-` / `SHB-` / `DOC-` / `IT-` / `TST-` / `PLT-` / `CTRIB-` / `ST-N` /
  `#18xx` / `feature-flow` / `Quality Bar` / `sidecar` / `playbook` / `retrospective` / `backlog` /
  `scanner` / `lineage/` / `websearch_to_tsquery` / `JooqFTSHelper` → **one hit**, and it is not a leak:
  `JooqFTSHelper` on **ADR-0071's Evidence line**, a developer-guide surface whose established format is
  `file:line` code citations — the line it replaced already read `JooqFTSHelper.java:103`. Classified per
  the Gate 11 Exceptions table. Zero hits on every operator-facing page.

### The fix-list — one rework pass

**BLOCKER**

- **A1 — the one Query-syntax table row that does not work as typed.** On the train branch,
  `docs/data-discovery/search.md`'s operator table ends with:

  > `| -"test fixture" | entities that do **not** contain that phrase |`

  Typed exactly as printed, that query returns **No matches found**. It is the only row in the table with no
  positive term, so the per-branch index-searchability guard collapses it to the empty tsquery. Measured on
  `postgres:13.2-alpine`, not reasoned: `querytree((!! phraseto_tsquery('test fixture')))` → **`T`**, the
  guarded `CASE` → the empty tsquery, and `to_tsvector('a customer table') @@ <guarded>` → **`f`**. The
  tokenizer path confirms it — `-` sets `negated`, the quoted span is consumed as one `phraseLeaf(…, true)`,
  no bare terms are appended, so the single group holds a single negated leaf.

  It also **contradicts the same page four items later**: *"A query with nothing to look for finds nothing.
  `-test` on its own has no positive term, so it returns **No matches found** rather than 'everything except
  test'."* The bullet is right; the table row is wrong. Every other row in the table is a complete, working
  query, and a table exists precisely so the reader does not have to reconcile it against the prose.

  **Fix**: give the row a positive term — `customer -"test fixture"` → *"entities matching `customer` but not
  containing that phrase"* — which is what the row was demonstrating (negation composes with a phrase) and is
  runnable as printed. Then re-read the whole table once against the bullets below it and confirm no other
  row promises results the guard withholds.

  This is release-gated, so it is **not live yet** — which is the entire reason to fix it now rather than
  file it. It publishes at the 1.0.0 gate otherwise, and the operator who tries the last row first concludes
  the operator syntax is broken.

**FOLD INTO THE SAME PASS**

- **F-A — a test whose `@DisplayName` claims more than the test proves, and more than is true.**
  `ReactiveDataEntityHighlightInjectionTest`'s second new case is named
  `getHighlightedResult_negation_marksOnlyTheMatchedTerm` with
  `@DisplayName("an excluded term is not marked up - the row is highlighted on what it matched (#1840)")`.
  The **body's own comment** says the opposite is the general truth, and I measured it: `ts_headline` marks a
  negated lexeme when the document contains one (`<b>Customers</b> <b>test</b> table` for `customer -test`).
  The assertion is correct only because the seeded document happens not to contain `test` — the comment says
  so honestly, but the DisplayName is what lands in the CI report and in a future reader's scan, and it
  states a property this round explicitly established as **false** (and corrected on the manual page in the
  same commit). Rename to what it proves — e.g. *"an operator query reaches ts_headline as a valid composed
  tsquery and returns sane markup"* — so the test and the manual cannot drift apart later.

**NOT ON THE FIX-LIST — stated so the rework does not over-correct**

- **The mechanism substitution remains the right call, and round 2 did not weaken it.** Composing from
  tsquery primitives instead of `websearch_to_tsquery` preserves the printed prefix promise; I re-confirmed
  the cost first-hand (`cust` stops matching `Customers` under websearch).
- **The per-branch guard, and the honesty about what it costs.** Guarding each OR branch rather than the
  whole expression is the correct granularity, and round 2 **documented** the consequence
  (`customer or -test` drops the branch) rather than leaving it for an operator to discover.
- **F1b is the standard this workspace asks for and rarely gets.** The implementer wrote two tests, measured
  what they actually discriminate, found the answer was *nothing*, said so in the code and in the commit
  body, and corrected the manual sentence that had implied otherwise. Only the DisplayName lagged.
- **The patch-coverage gate is still reported as inert rather than as "100 %".** I re-checked:
  `odd-platform-api/build.gradle:181-188` `jacocoExcludes` carries `'**/repository/**'`, and both changed
  production files live under `repository/`. Inert is the truth, and saying so is the harder call.
- **PLT-263 was correctly NOT folded.** A one-line fix inside the very method this PR owns, but outside the
  GATE-1-approved plan and changing behaviour for an input class the plan never covered. Folding it is the
  maintainer's call, not the implementer's, and round 2 was right to say so.

### Summary lines

- **Outbound URL sweep**: on the changed doc pages — every relative link and same-page anchor resolves
  against the tree; `#query-syntax` resolves from all three new inbound pages. Tree-wide over all 137 pages
  on `origin/release/1.0.0`: 0 YAML failures; 1 over-200 `description` (**ADR-0079's 240**, which this branch
  fixes to 180); 4 unresolvable relative targets, of which 1 is a markdown-escaped underscore (false
  positive) and 3 are DOC-514's already-filed `custom-collectors.md` links. Live fetches this run: the
  search page, `main-concepts`, `owners`, `oauth2-oidc`, `microservices`, `active-platform-features` — all
  **200**.
- **Banned-phrase check**: none used. Every verdict line above ends in a citation, a measured value, or an
  explicit statement of what I did not measure.
- **Regressions**: **none attributable.** Unit 814/1 at `cda7d277` (mine), the one failure independently
  reproduced and green on upstream CI at the same SHA. Integration carried from a **provably** identical
  binary (comment-only `src/main` delta, verified by stripping and filtering the diff). Checkstyle 0
  violations (mine, run separately). The two new tests are RED on `origin/main` (mine) — no test was changed,
  weakened, skipped or deleted.
- **Navigation**: **consistent.** `navigation/domains/search.md:11` carries the accurate `JooqFTSHelper`
  entry (7 classes / 26 sites — I re-counted, it is exact) plus the `getHighlightedResult` /
  `getQuerySuggestions` and `MainSearchInput` / `SearchSyntaxHint` pointers. No pointer went stale.
- **Upstream issues logged**: none new this run. **PLT-263** (filed round 1) stands, unfolded by design.
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: the partition round 1 queued, read end-to-end —
    `docs/active-platform-features/**` (6), `docs/data-lineage/**` (2), `docs/data-quality/**` (4),
    `docs/use-cases/**` (5), `docs/configuration-and-deployment/**` (21) and the 15 root pages; plus a
    targeted read of `docs/integrations/**` (14) and a **tree-wide mechanical sweep of all 137 pages** for
    unresolvable links, unresolved anchors, YAML-parse failures and >200-char descriptions.
    **Queued for the next `/review`**: `docs/integrations/**` read end-to-end rather than swept (the
    per-adapter field tables need the `odd-collectors` source to verify, which this session did not have),
    and `docs/data-discovery/**` re-read (round 1 covered it).
  - **Findings**:
    - **DOC-515** (high, parallel-surfaces-with-drift / incomplete-sweep residue) —
      `data-lineage/microservices.md` still tells API callers *"Always pass an explicit `lineage_depth` —
      omitting it returns HTTP 500"*. `#1758` shipped `default: 1` in **0.29.0**, the latest published
      release; **DOC-481** corrected this claim on two pages and its `affected_files` named only those two.
      The third is live on docs `main` and contradicts both siblings, which it links to. Source:
      `docs/data-lineage/microservices.md:52`. Live-verified (200, phrase present).
    - **DOC-516** (high, internal contradiction on a security control / incomplete-sweep residue) —
      `oauth2-oidc.md`'s admin-detection matrix says `exact match` for **Cognito / Google / Azure AD** and
      `exact (principals)` for **GitHub**, while four other rows in the same table say
      `case-insensitive full match`. The code has **no** per-provider divergence: every provider and LDAP go
      through `OperationUtils.containsIgnoreCase` = `element::equalsIgnoreCase`
      (`AbstractOIDCUserHandler:38,50`, `GoogleUserHandler:60`, `GithubUserHandler:59,119`,
      `LDAPSecurityConfiguration:48`). The page contradicts `admin-promotion.md:51` **and its own** GitHub
      admonition three rows below. **DOC-336** fixed one row, **DOC-339** fixed three; four were left. Error
      is in the under-estimating direction — a differently-cased `admin-principals` entry an operator
      believes inert still grants ADMIN. Live-verified.
    - **DOC-514 extended in place** (not a new item — same class, same page-set, same released-truth
      routing, and it is `pending` so nobody is mid-fix): two more live broken anchors.
      `permissions.md:97,100` deep-link `owners.md#3-…` / `#4-…`, but GitHub-book emits `id-3.-…` / `id-4.-…`
      for numeric-leading headings (prefix **and** the dot preserved) — read directly off the live page's
      `<h3 id=…>`. A tree-wide sweep bounds the class at exactly these two links and one page with numbered
      headings, and that bound is now an acceptance criterion on DOC-514.
    - **DOC-510 re-derived, not re-filed** (LSN-009). Reading `metrics-ingestion.md:76` and
      `notifications.md:91` against `notifications.md:9,104` and ADR-0079 surfaced the ingestion-filter
      contradiction from a third entry path; the backlog grep found DOC-510 already owns it across **six**
      pages. Nothing to add — recording the independent re-derivation as convergent evidence that its
      `critical` priority is right.
    - **DOC-509 re-derived, not re-filed** (LSN-009). `active-platform-features.md:15` still describes the
      pre-0.29.0 Alerts view — *"**All / My Objects / Dependents** tabs"* and *"lists **open** alerts only;
      resolved history is read on each entity's own Alerts tab"*. I verified against the spec that
      `AlertViewType` is `ALL / MY_OBJECTS / DOWNSTREAM / UPSTREAM` with **no** `DEPENDENTS`, and that the
      four-tab split shipped in **0.29.0** (`git show 0.28.0:…` → 0 hits for `UPSTREAM`, `0.29.0` → 1), so
      the landing bullet is wrong on docs `main` today while its own child page documents the change. The
      backlog grep found DOC-509 already owns it, `pending`.
  - **Verified non-findings** (recorded so the next audit does not re-derive them): `#terms-and-aliases`
    resolves live from all five inbound links (GitBook slugs `Terms & Aliases` correctly — my slugifier's
    false positive, not a defect); `enable-security/README.md` is **already correct** about ADR-0079's
    whole-namespace coverage and is rightly absent from DOC-510's six-page list; `SUMMARY.md`'s
    `quick\_launch\_…` and `Architecture.md`'s `architecture\_collector.png` are markdown-escaped
    underscores, not broken paths.

### Notes

- **Resource discipline.** The heavy-e2e flock was **not** taken — the integration carry-over is proved, not
  assumed, so re-running it would have cost ~50 minutes of machine for zero information.
  `git status --short lineage/` is **empty**: no `/enrich`, no probe, no ontology drift. The base worktree
  `../odd-platform-ctrib060base` was modified for the RED proof and restored (`git checkout --`, verified
  clean). This review commits exactly the verdict, its `state/active-streams.yaml` entry,
  `state/PROGRESS.md`, and the three follow-up artefacts (DOC-515, DOC-516, DOC-514's extension).
- **A gap in my own first attempt, disclosed.** My `run-platform-tests.sh` invocation never reached
  checkstyle, because `:test` failed and gradle stopped. I noticed the missing report directory rather than
  writing "checkstyle green" from the ledger, and ran both tasks separately. Recording it because the next
  reviewer of a red-test build will hit the same thing.
- **On the verdict.** The engineering here is verified and, in several places, verified more strictly than
  the item claims — the RED-on-`main` proof, the per-branch guard, the honest retraction in F1b, the refusal
  to report an inert coverage gate as 100 %. What sends it back is one row in one table: the last example a
  reader will copy out of the new Query-syntax section does not return anything, and the page says so itself
  four bullets later. It is release-gated, so it is catchable today and unfixable-quietly tomorrow. Two
  words, on a doc PR that is already open.

## Implement round 3 (2026-09-02, session: review-ctrib060r2) — the round-2 review's fix-list, closed

`/review CTRIB-060` round 2 rejected on **Gate 6** — one row in the Query-syntax table that does not work as
typed — with one fold-in. Same session as that review, which the separate-session rule permits for
`/implement`; **the next `/review` must be fresh.** Two commits, and the smaller of the two is the one with
the longer justification.

### A1 (blocker) — the table row that returned nothing

`documentation@docs/CTRIB-060-search-query-operators` **`b96800f`**.

| | |
|---|---|
| was | `` | `-"test fixture"` \| entities that do **not** contain that phrase \| `` |
| is | `` | `customer -"test fixture"` \| entities matching `customer` but **not** containing that phrase \| `` |

The old row was the only one in the table with no positive term, so the per-branch index-searchability guard
collapsed the whole query to the empty tsquery and it returned **No matches found** — while the page's own
bullet four items below said exactly that would happen. The row exists to show that negation composes with a
phrase, which is worth showing; a positive term keeps the lesson and makes the example runnable.

**The re-read the fix-list asked for, done as measurement rather than reasoning.** Every row of the table run
on `postgres:13.2-alpine` (the deployed version) through the same guarded `CASE` the sink emits, against four
seeded documents — `Customers Orders daily`, `Orders shipped from customer`, `Customer test fixture table`,
`Customer table`:

| You type | compiled tsquery | rows returned | matches its cell? |
|---|---|---|---|
| `customer orders` | `'custom':* & 'order':*` | the two Orders rows | yes |
| `"customer orders"` | `'custom' <-> 'order'` | only `Customers Orders daily` — the non-adjacent one correctly excluded | yes |
| `customer -test` | `'custom':*` (after the guard) | 3 rows, the `test` row out | yes |
| `customer or orders` | two guarded branches, OR-joined | all four | yes |
| ~~`-"test fixture"`~~ | `querytree` = **`T`** | **NO MATCHES** | **no — the defect** |
| `customer -"test fixture"` | `'custom':*` | 3 rows, the fixture row out | yes |

So the four other rows do what their cell claims, the replacement does what its cell claims, and **no other row
promises results the guard withholds.** That was the open question the fix-list raised; it is now answered with
evidence rather than left as "looks fine".

Not changed, deliberately: the section still opens "Three operators refine that…" above a five-row table whose
first row uses no operator. That row is the baseline the other four are read against, which is what makes the
table legible — narrowing it would be an over-correction.

### F-A (fold-in) — a test named after the opposite of what is true

`odd-platform` **`8008eb8b`**. `getHighlightedResult_negation_marksOnlyTheMatchedTerm` /
*"an excluded term is not marked up"* → `getHighlightedResult_negation_returnsSaneMarkupForAComposedQuery` /
*"a -exclusion query reaches `ts_headline` as a valid composed tsquery"*.

The old name asserted a property **round 2 had itself measured to be false** — `ts_headline` marks every
lexeme *mentioned* in the tsquery, so a negated term is highlighted when the document contains one, which is
why the manual now says *"every word you typed, including an excluded one"*. The assertion is correct only
because the seeded document carries no `test`: the single marked term is a property of the **document**, not
of the negation. The body comment said so honestly; the `@DisplayName` did not, and the `@DisplayName` is what
lands in the CI report — sitting in direct contradiction with the published page and inviting a future reader
to "fix" the page to match the test. The comment now leads with why the obvious name is wrong, so nobody has
to re-derive it. **No assertion, matcher, seed or expected value changed** — a name and a comment.

### Gates re-run

| Gate | Result |
|---|---|
| Unit — full CI replica at `8008eb8b` | **814 tests / 1 failure / 0 errors / 0 skipped** across **181 classes** (29m06s; parsed from the JUnit XML, mtimes `11:31` = this run). 814 is unchanged from the reviewed `cda7d277` — a rename does not move the count, which is the expected shape. The one failure is `OpenApiDocsContractTest.platformApiGroupDocumentLoads()`'s 60-second springdoc read, now its **fifth** reproduction (TST-061); **upstream CI is 6/6 SUCCESS at this exact SHA** (`Test Results`, `run_tests`, `run_playwright_tests/{test,lint,format-check}`, `update_release_draft`). Non-attributable |
| Checkstyle | Run **standalone**, because the `build` lifecycle stops at the failing `:test` before reaching `check`'s remaining tasks — the same gap the round-2 review disclosed rather than inheriting. `:odd-platform-api:checkstyleMain` + `:checkstyleTest`: **BUILD SUCCESSFUL, 2m28s, both executed**; `build.gradle:151-156` sets `ignoreFailures = false` + `maxWarnings = 0` (and disables the reports), so a successful run **is** the zero-violation result |
| Unit — targeted, before commit | `ReactiveDataEntityHighlightInjectionTest` **5 tests / 0 failures**, with **`checkstyleMain` + `checkstyleTest` green** (BUILD SUCCESSFUL, 4m04s). The renamed case runs under its new DisplayName; `grep` for the old identifier across `../odd-platform` returns nothing but this ledger's own record of the finding |
| Integration | **Carried, and the carry-over is trivially provable this time**: `git diff --stat cda7d277..8008eb8b -- odd-platform-api/src/main odd-platform-ui odd-platform-specification` is **empty**. The delta is one test file. The SUT image is byte-identical to the one `/review CTRIB-060` built and ran to `feature-complete` 328/12 (zero unattributed) · `known-bugs` 3-RED-expected · `multi-stack` 14/0 · `ingestion-e2e` 15/0 |
| G-C15 | Clean. The one test file changed is a rename + comment; nothing weakened, skipped, disabled or deleted |
| Docs mechanical sweeps | On the staged diff: Gate 11 banned-term grep **zero hits**; `description:` **180 bytes** (≤200); PyYAML parses the frontmatter; no `: ` hazard |
| Train topology | `git merge-base origin/release/1.0.0 origin/docs/CTRIB-060-search-query-operators` == `9594f96` == the train head. Still rebased, still zero-conflict |

### Pushed

- odd-platform **PR #1873** head `8008eb8b` (draft, base `main`, 19 files +701/−61).
- documentation **PR #111** head `b96800f` (draft, base `release/1.0.0`).

## Review (2026-09-02, session: review-ctrib060r3) — ROUND 3

- **Result**: **ACCEPTED** — `pr-draft` → **`review-ready`**. Round 3's two commits close the round-2 fix-list
  exactly, and I re-derived both rather than reading them. The blocker's fix is not just applied — I re-measured
  **every row of the operator table** on a real `postgres:13.2-alpine` and each one now returns what its cell
  claims. The human GATE-2 merge owns the rest; Gate 8 is **PENDING-RELEASE (1.0.0)** with the train
  precondition genuinely met (branch pushed, rebased on the train head, PR #111 open and conflict-free).
- **Session boundary**: fresh session. Rounds 2 and 3 of `/implement` both ran inside the `review-ctrib060r2`
  session and both say so; the separate-session rule binds `/review`, and this is the fresh one they asked for.
  I wrote none of this code.
- **Cheap precondition (the 2-minute bounce)**: NOT triggered — and I checked its premise instead of accepting
  it. The round-3 gates table records unit **814/1 at `8008eb8b`**, checkstyle standalone-green, and an
  integration carry-over argued from a test-only delta. I verified the carry-over argument myself (below), then
  re-ran the whole unit bucket anyway.

### Reviewed subject (verified, not assumed)

| fact | value | how verified |
|---|---|---|
| worktree | `../odd-platform-ctrib060` @ **`8008eb8b`**, clean, **3 ahead** of `origin/main` `b5d9f150` | `git status -sb` + `git log` after `git fetch` |
| PR #1873 | head SHA **== `8008eb8b`**, `draft: true`, base `main`, 19 files **+701/−61**, no milestone | GitHub PR API (App token) |
| upstream CI at `8008eb8b` | **6/6 SUCCESS** — `Test Results`, `run_tests`, `run_playwright_tests/{test,lint,format-check}`, `update_release_draft` | check-runs API |
| G-C11 | issue **#1840** OPEN with the **OPEN** milestone `1.0.0` | issues API |
| doc branch | `origin/docs/CTRIB-060-search-query-operators` @ **`b96800f`**, merge-base with `origin/release/1.0.0` **== `9594f96`** (the train head), `git merge-tree` → **0** conflict markers | `git ls-remote` + `merge-base` + `merge-tree` |
| documentation PR #111 | open, base `release/1.0.0`, head `b96800f`, `mergeable_state: clean`, 7 files +37/−10 | documentation PR API |
| round-3 delta | doc: **1 file, 1 line**; code: **1 test file, +9/−5** | `git show --stat` on both |
| G-C15 | **does not fire.** Across the *whole* branch (`b5d9f150..8008eb8b`) the only removals in any test file are **two javadoc comment lines** (the "operator-stripped upstream" phrasing F2 corrected). No assertion, matcher, seed or expected value changed; no `@Disabled`/`@Ignore`/`.skip` added; no test file deleted; 18 `@Test` methods added | `git diff` filtered to `^-` per test file |

### A1 — the round-2 blocker. CLOSED, and I re-measured the whole table rather than the changed row

The fix is the two-word one the fix-list asked for (`-"test fixture"` → `customer -"test fixture"`). The claim
worth checking is the *other* half of the ask — *"re-read the whole table once and confirm no other row promises
results the guard withholds."* I did that as measurement, independently: four documents seeded
(`Customers Orders daily`, `Orders shipped from customer`, `Customer test fixture table`, `Customer table`) on a
throwaway `postgres:13.2-alpine`, each row's tsquery built through the same guarded `CASE` the sink emits.

| The table says you type | Compiled tsquery (measured) | Rows returned | Cell honoured? |
|---|---|---|---|
| `customer orders` | `'custom':* & 'order':*` | the two Orders rows | **yes** |
| `"customer orders"` | `'custom' <-> 'order'` | only `Customers Orders daily` — the non-adjacent row correctly dropped | **yes** |
| `customer -test` | `!'test' & 'custom':*` | 3 rows, the `test` row out | **yes** |
| `customer or orders` | `'custom':* \| 'order':*` | all four | **yes** |
| ~~`-"test fixture"`~~ (removed) | guarded → **empty tsquery** | **NO MATCHES** | **no — reproduced, this was the defect** |
| `customer -"test fixture"` (new) | `!( 'test' <-> 'fixtur' ) & 'custom':*` | 3 rows, the fixture row out | **yes** |

So the defect reproduces exactly as round 2 described, the replacement is runnable as printed, and **no other row
promises results the guard withholds.** Independently derived; it matches the round-3 commit body row for row.

### Every other claim in the section — measured, not read

Gate 6's forward direction is the one that failed last round, so I ran the whole section, not the changed line.

- *"typing `cust ord` already finds an entity called `Customers Orders`"* → `to_tsquery('cust:*&ord:*')` returns
  it. **True.**
- *"`or` binds more loosely than the implied `and` — `a or b -c` means `a`, or (`b` but not `c`)"* →
  `'custom':* | !'test' & 'order':*`; `&` binds tighter than `|` in tsquery. **True.**
- *"A hyphen only excludes at the start of a word"* → the real `QUERY_OPERATORS` regex classifies `my-table`,
  `e-mail`, `2024-01-01` and `trailing dash -` as **plain**. **True.**
- *"`or` only counts as an operator on its own"* → `oracle`, `ordering`, `sales_or_ops` all classify **plain**;
  `Or` / `OR` classify as operators. **True.**
- *"Quotes win over everything inside them"* → the tokenizer consumes a quoted span before any split
  (`operatorGroups`, single left-to-right pass). **True.**
- *"A query with nothing to look for finds nothing"* → `-test` alone guards to the empty tsquery, **0 rows**.
  **True.** And `-` alone, `"` alone and `or` alone all reach an empty tsquery — **no 500 on any of them.**
- *"The same holds for one side of an `or`"* → `customer or -test` → `'custom':*`, the branch dropped, 5 rows.
  **True.**
- *"the result highlights mark … every word you typed, **including an excluded one**"* →
  `ts_headline('Customer test fixture table', <the composed customer -test tsquery>)` →
  `<b>Customer</b> <b>test</b> fixture table`. **True** — and it is the honest version of what F1b retracted.
- *"The same syntax works on every full-text search surface … It does **not** apply to … the Management sub-tabs
  and … the [Relationships] list"* → the positive half is the census below; the **negative** half I checked in
  source rather than trusting: `ReactiveDataEntityRelationshipRepositoryImpl.getRelationships` filters with
  `DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase(inputQuery)` — a substring match, no FTS — and the six
  Management repositories (`Owner`, `Role`, `Policy`, `Tag`, `Namespace`, `Collector`) have **zero**
  `ftsCondition`/`ftsRankField`/`tsQueryExpression` call sites between them. **True.**
- **One claim I could NOT confirm, and it is filed rather than waved through** — see `DOC-518` below.

### The consumer census and the single-dialect property, re-derived at `8008eb8b`

`grep` over `repository/reactive/*.java`: **7 classes** (`SearchFacet` 6, `DataEntity` 6, `Term` 5,
`QueryExample` 3, `LookupTable` 3, `QueryExampleSearchEntrypoint` 2, `AssetSearch` 2), **26**
`ftsCondition`+`ftsRankField` sites **+ 1** direct `tsQueryExpression` in `getHighlightedResult` = **27**, split
exactly the way the ledger and `navigation/domains/search.md:11` state it. `grep` for
`to_tsquery|plainto_tsquery|phraseto_tsquery|websearch_` across `src/main` returns `JooqFTSHelper` **plus three
comment lines** — no second dialect anywhere.

### F-A — the fold-in. CLOSED, and the rename is the honest one

`getHighlightedResult_negation_marksOnlyTheMatchedTerm` / *"an excluded term is not marked up"* →
`getHighlightedResult_negation_returnsSaneMarkupForAComposedQuery` / *"a -exclusion query reaches `ts_headline`
as a valid composed tsquery (#1840)"*. I confirmed three things rather than one: (1) the assertion, seed and
expected value are **byte-identical** — the diff is a name and a comment; (2) the new name is what actually
landed, not just what the source says — the JUnit XML from my own run carries
`name="a -exclusion query reaches ts_headline as a valid composed tsquery (#1840)"`; (3) the old phrase survives
in exactly one place, inside the comment that explains why the obvious name is wrong. That is the right residue.

### Unit bucket — my own full CI-replica run at the reviewed SHA

`ODD_PLATFORM_DIR=../odd-platform-ctrib060 scripts/run-platform-tests.sh`, **29m59s**:

**814 tests completed, 1 failed — 0 errors, 0 skipped, across 181 test classes.** Parsed from the JUnit XML
myself (every `<failure>`/`<error>` enumerated across all 181 files; mtimes `12:28`, i.e. this run), and
cross-checked against gradle's own tally. **Byte-identical to the round-3 ledger.** The four touched classes are
clean: `JooqFTSHelperTest` **45/0**, `AssetSearchServiceIntegrationTest` **15/0**,
`ReactiveDataEntitySearchResultsTest` **11/0**, `ReactiveDataEntityHighlightInjectionTest` **5/0**.

The single failure is `OpenApiDocsContractTest.platformApiGroupDocumentLoads()` —
`IllegalStateException: Timeout on blocking read for 60000000000 NANOSECONDS`. **Sixth** reproduction of
`TST-061`; the first review measured the class passing **alone** in 4m18s with a 23.4-second springdoc init
against a 60-second bound, and **upstream CI's `run_tests` is GREEN on this exact SHA**. Non-attributable.

**Checkstyle ran in this build and passed.** Unlike round 2's run, gradle reached `checkstyleMain`,
`checkstyleTest` **and** `assemble` before `:test` failed — all three appear as executed tasks with no
violations, and `build.gradle:151-156` sets `ignoreFailures = false` + `maxWarnings = 0` (reports disabled), so a
successful run **is** the zero-violation result.

### Integration bucket — carried, and the carry-over is proved over the whole chain, not one hop

The round-3 claim is that the SUT is unchanged since the commit `/review CTRIB-060` built four suites against. I
tested the **whole chain**, `6281a9df..8008eb8b`, not just the last hop:

```
git diff --numstat 6281a9df..8008eb8b
  ReactiveAssetSearchRepositoryImpl.java     5/3   <- the ONLY src/main file
  ReactiveDataEntityHighlightInjectionTest  44/2
  ReactiveDataEntitySearchResultsTest       80/0
```

Stripping the `+`/`-` markers from the `src/main` + `odd-platform-ui` + `odd-platform-specification` diff and
filtering out `//`, `*` and `/*` lines leaves **nothing**. No FE change, no resource change, no spec change. The
image `/review CTRIB-060` built from `6281a9df` (`sha256:a154cc2b`) is therefore the same system, and its result
stands: `feature-complete` **328/12 with zero unattributed** (TST-059's eleven + TST-057's
`swagger-openapi-discovery:63`) · `known-bugs` **3 RED, expected, zero unexpected GREENs** · `multi-stack`
**14/0** · `ingestion-e2e` **15/0**. I did **not** take the heavy-e2e flock — ~50 minutes of e2e against a
provably identical binary buys no information.

### Acceptance criteria — the `must_haves` truths

- [x] **R1 quoted phrase** — PASS. `'custom' <-> 'order'`, measured; the non-adjacent row is correctly dropped.
- [x] **R2 negation EXCLUDES** — PASS. `!'test' & 'custom':*`; the round-2 review's RED-on-`main` proof
      (`main` returns *precisely the row it was asked to exclude*) stands and the pinning tests are green here.
- [x] **R3 `or`** — PASS. `'custom':* | 'order':*`, measured; both branches answer.
- [x] **R4 plain-term parity** — PASS, and structural: `operatorGroups` returns `null` when `QUERY_OPERATORS`
      does not match and the caller takes the identical single `to_tsquery(tsQuery(q))` call. The 13 pre-existing
      parity pins are untouched.
- [x] **R4b prefix survives inside an operator query** — PASS. `appendBareTerms` routes an operator query's bare
      terms through the **same** `prefixTsQuery` call; `cust ord` finds `Customers Orders`, measured.
- [x] **R5 fail-closed** — PASS for this item's scope. Every leaf is a constructor that cannot raise, every user
      value is a bind, over-cap fails closed. I additionally ran `-` alone, `"` alone, `or` alone and `-test`
      alone to an empty tsquery with no error. The pre-existing tab/newline `42601` remains **PLT-263**.
- [x] **R6 no positive term → empty page, no sequential scan** — PASS. Per-**branch** guard; `querytree` of a
      negation-only branch is `T`, the guarded expression matches nothing, and the OR case keeps the indexable
      branch (measured: 5 rows, not 0).
- [x] **R7 list / total / facet counts / ranking / highlights all agree** — PASS. Closed by F1 in round 2 and
      re-verified here: `ReactiveDataEntitySearchResultsTest` 11/0 in my own run, and the two R7 cases were
      RED on `origin/main` by the round-2 reviewer's own run.

### Quality Bar

- **Gate 1 — No duplicates: PASS** via `grep` over `src/main` — one FTS builder, three comment mentions, no
  second dialect; the FE reuses `AppTooltip` + the *moved* shared `TooltipBody` rather than copying it.
- **Gate 2 — Aliases: N/A** via read of the seven changed pages — "quoted phrase", "exclusion", "operator" are
  ordinary English in the operator's voice, not platform vocabulary owed a `main-concepts.md` row.
- **Gate 3 — Caveats captured: PASS** via read of `search.md:157` — the metacharacter caveat is an **amended**
  `{% hint style="info" %}` (not a duplicate) and now states what `"` and `-` did before 1.0.0 (silently
  ignored; `-word` read as *required*). The no-positive-term and per-OR-branch surprises are both in the
  section's own "details worth knowing" list.
- **Gate 4 — Consumer-read: PASS** via the 7-class / 26+1-site census re-derived at `8008eb8b`, plus the
  first-hand source reads behind the page's *negative* surface claim (Relationships = `containsIgnoreCase`;
  six Management repositories = zero FTS sites) and behind ADR-0071's evidence line.
- **Gate 5 — Unset-parameter audit: N/A** — no SDK builder in scope.
- **Gate 6 — Bidirectional code ↔ doc: PASS.** Reverse direction was closed by B2 in round 2 (three summary
  surfaces + the ADR-log page + `catalog-overview.md`, the six-page precedent `e8fa107` set). Forward direction
  — the half that failed round 2 — I re-ran claim by claim above; the row that failed is fixed and every other
  row and bullet measures true. **One qualification, stated rather than buried**: the paragraph's closing
  sentence *"a quoted phrase and an excluded word match the word you actually typed"* is measurably imprecise —
  Postgres stems both sides, so `"customer orders"` also matches `Customer Order singular` and `customer -test`
  also excludes `Customer testing framework`. I did **not** fail the gate on it, and the reasoning is recorded
  in `DOC-518` so the call is auditable: the sentence's operative claim (operators narrow without revoking
  prefix matching) is true and is what the paragraph is about; the imprecision is on a different axis
  (stemming, which the long-released plain path already had and which **no page in the manual** mentions); and
  the error direction is *more* rows matched, never a query that returns nothing — materially unlike the
  round-2 row that returned **No matches found** as printed. It is filed against the still-open PR #111 so it
  can land before publication without a fourth round.
- **Gate 7 — Layout: PASS** via read — no `SUMMARY.md` change owed (7 files modified, 0 added); `## Query
  syntax` (`:15`) sits before `## Faceted search` (`:42`), the right reading order; `#query-syntax` and
  `#per-result-transparency` resolve against real headings (`:15`, `:117`) and `#query-syntax` resolves from
  all three inbound pages.
- **Gate 8 — Publishing: PENDING-RELEASE (1.0.0).** The train precondition is met and I re-derived every part
  of it: branch **pushed** @ `b96800f`; merge-base with `origin/release/1.0.0` **is** the train head `9594f96`;
  `git merge-tree` → **zero** conflict markers; **PR #111 open**, base `release/1.0.0`, `mergeable_state:
  clean`. Branch-verifiable sub-checks against the train commit, all **PASS**: PyYAML parses the frontmatter on
  all 7 changed pages; every `description` ≤200 chars (**178 / 173 / 161 / 191 / 178 / 189 / 180** — ADR-0079's
  240 is down to 180); no `: ` YAML hazard; 0 unresolvable relative links; all 12 outbound URLs on the changed
  pages **200 via curl** (including `FTSConstants.java` on GitHub). Live today:
  `https://docs.opendatadiscovery.org/features/data-discovery/search` → **200**, no Query-syntax section —
  exactly right for a release-gated change. **Owed at the 1.0.0 gate**: that URL plus the `/features/`-prefixed
  `data-discovery/catalog-overview`, `Features`, `data-discovery`, `Architecture`,
  `developer-guides/architecture-decision-log/adr-0071-…` and `…/adr-0079-…`; confirm *"Query syntax"*, *"bare
  words as prefixes"*, the corrected ADR-0071 `@@`-against-a-composed-tsquery sentence, and the fixed
  `customer -"test fixture"` row render. Add `DOC-518`'s corrections to that list if PR #111 picks them up.
- **Gate 9 — Factual claim provenance: PASS.** The contributor pillar uses no `Sources:` footer (the posture
  accepted at `/review CTRIB-059`, `CTRIB-062` and rounds 1-2); provenance is inline in the commit bodies, and
  both round-3 commits carry a `Sources:` block anyway. I re-derived every load-bearing claim rather than
  trusting it: the six table rows and eight prose claims on real Postgres, the census, ADR-0071's four
  citations (`V0_0_1__init.sql:196` = `search_vector tsvector GENERATED ALWAYS`; `ftsCondition:120`;
  `tsQueryExpression:197`; the `SearchServiceImpl` session row), the checkstyle and jacoco config lines, the
  CI status, the train topology, and the seven `description` lengths.
- **Gate 10 — Content-type homing: PASS** — operator-facing syntax on `data-discovery/search.md`; the wire
  contract as a `description` on `SearchFormData.query` in `components.yaml` (Swagger is the API-reference
  surface, and there is no competing `api-reference/search.md`); the developer-audience restatement on the
  ADR-log page. Nothing API-reference-shaped embedded in a feature page.
- **Gate 11 — Audience isolation: PASS.** Mechanical grep over **every added line** of the doc diff for
  `Cornerstone N` / `Gate N` / `LSN-` / `SHB-` / `DOC-` / `IT-` / `TST-` / `PLT-` / `CTRIB-` / `ST-N` /
  `#18xx` / `feature-flow` / `Quality Bar` / `sidecar` / `playbook` / `retrospective` / `backlog` / `scanner` /
  `lineage/` / `websearch_to_tsquery` / `JooqFTSHelper` → **one hit**, and it is not a leak: `JooqFTSHelper` on
  **ADR-0071's Evidence line**, a developer-guide surface whose established format is `file:line` code
  citations (the line it replaced already read `JooqFTSHelper.java:103`). Classified per the Gate 11 Exceptions
  table. **Zero** hits on every operator-facing page.

### Summary lines

- **Outbound URL sweep**: changed pages — 12 unique external URLs, **all 200 via curl**; every relative link and
  same-page anchor resolves; `#query-syntax` resolves from all three inbound pages. Editorial partition
  (`docs/integrations/**`) — **104** real external URLs swept, **all 200**, **0 broken**; 0 unresolvable
  relative targets; exactly one H1 per page across all 14 pages.
- **Banned-phrase check**: none used. Every verdict line above ends in a citation, a measured value, or an
  explicit statement of what I did not measure.
- **Regressions**: **none attributable.** Unit **814/1** at `8008eb8b` (mine, XML-parsed), the one failure
  independently reproduced and green on upstream CI at the same SHA; checkstyle + assemble executed and clean in
  the same build. Integration carried from a **provably** identical binary (the `src/main`+UI+spec delta over
  the whole `6281a9df..8008eb8b` chain contains zero non-comment lines). No test was changed, weakened, skipped,
  disabled or deleted anywhere on the branch.
- **Navigation**: **consistent.** `navigation/domains/search.md:11` carries the accurate `JooqFTSHelper` entry
  (7 classes / 26 sites — I re-counted, it is exact), `:14` the `getHighlightedResult` / `getQuerySuggestions`
  pointers, `:21` the `MainSearchInput` / `SearchSyntaxHint` UI pointer. No pointer went stale.
- **i18n**: all seven locale catalogues at **689 keys** — exact parity — and the new key carries a **real
  translation in every one** (br/ch/es/fr/hy/ua), not an English fallback. Verified by reading the diff, not the
  parity count (`feedback_i18n_done_is_rendered_page_not_catalog_parity`).
- **Upstream issues logged**: none new this run. **PLT-263** (filed round 1) stands, deliberately unfolded —
  outside the GATE-1 plan, and correctly the maintainer's call.
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: the partition round 2 queued — **`docs/integrations/**` read end-to-end** (all 14
    pages, 3 288 lines), with the cross-checks that partition was queued *for*: the documented adapter
    inventories re-derived **bidirectionally** against `../odd-collectors` source (odd-collector **41/41**,
    aws **11/11**, azure **4/4**, gcp **4/4** — **zero drift in either direction**), the SDK `Filter` model,
    the platform-side claims each page makes (`replaceLineagePaths`, the wizard's three code claims, the
    ingestion-filter posture), plus a mechanical `Required`-column audit of every field of all 41 adapters with
    **inheritance resolved**. **Queued for the next `/review`**: `docs/data-glossary/**`,
    `docs/master-data-management/**` and `docs/developer-guides/**` read end-to-end rather than swept.
  - **Findings**:
    - **DOC-517** (high, factual-claim defect / operator-hits-a-cliff) — `odd-collector.md`'s per-adapter
      reference marks **10 required fields as optional**: `database` on nine adapters that inherit
      `DatabasePlugin.database: Optional[str]` (no default ⇒ **required** under the pinned `pydantic 2.7.1`)
      plus `odbc.password`. Omitting the field is a start-up `ValidationError`, and the ClickHouse cell
      additionally invents a fallback ("When unset, the connection's default database is used") that cannot
      happen. The page **already knows the rule** — the Tableau block marks the identical construct `yes` and
      explains why — which is what makes this an oversight on an inherited field rather than a
      misunderstanding. Reproduced against the exact class hierarchy and pinned version; live-verified on
      docs `main`. Source: `docs/integrations/collectors/odd-collector.md:304,335,393,419,476,522,550,578,606,659`.
    - **DOC-518** (medium, imprecise-claim, milestone 1.0.0) — the new Query-syntax section's closing sentence
      claims a quoted phrase and an excluded word "match the word you actually typed"; Postgres stems both, so
      `"customer orders"` matches `Customer Order singular` and `customer -test` excludes
      `Customer testing framework`. **No page in the manual mentions stemming.** Filed against the **still-open
      PR #111** so it lands before publication rather than costing a fourth CTRIB round. Source:
      `docs/data-discovery/search.md:26` (train branch).
    - **DOC-433 extended in place** (not a new item — same page, same class, `pending`, nobody mid-fix): a
      second self-contradiction on `odd-tracing-gateway.md`. `:143` states the resolver rule ("lower-priority
      resolvers run last; the first resolver returning a name wins"); `:154` then says the Docker resolver
      "runs **after** the default resolver **but its result wins** (the chain stops at the first match)" —
      which cannot both hold, since the always-active Default resolver would have answered first. The gateway
      repo is not cloned here, so which clause is wrong is left to the fix; the acceptance criteria now name it,
      and `:163`'s silent K8s row.
    - **DOC-510 re-derived, not re-filed** (LSN-009). `odd-collector-profiler.md:94` tells operators the stats
      endpoint is reachable "regardless of `auth.ingestion.filter.enabled`", which ADR-0079 falsified in
      **0.29.0** — and DOC-510 already names that exact page in its six-file list. This is the **third**
      independent re-derivation of DOC-510, each from a different partition (round 1
      `active-platform-features/**`, round 2 `configuration-and-deployment/**`, round 3 `integrations/**`).
      Convergent evidence that its `critical` priority is right; nothing added.
    - **DOC-355 re-derived, not re-filed** (LSN-009). `integrations/README.md`'s universal "every integration
      authenticates with a collector token" / "every integration registers via `POST /ingestion/datasources`"
      claims, both refuted by `odd-tracing-gateway` on the page's own tables. Already `pending`, medium,
      scoped exactly right.
  - **Verified non-findings** (recorded so the next audit does not re-derive them): `ingestion-filters.md`
    verifies **clean** against `odd_collector_sdk/domain/filter.py` — the empty-`include` → `[".*"]` validator,
    the exclude-first ordering in `is_allowed`, `re.search` (not `fullmatch`) semantics, and all four rows of the
    worked PostgreSQL example (its only gap, the undocumented `ignore_case` key, is folded into DOC-517).
    `kinesis.aws_account_id` and the `blob_storage` `account_key`/`connection_string` pair look like `Required`
    mismatches to a mechanical audit but are **correct** — the doc marks them `**yes**` and `one-of` with the
    inheritance/either-or explained. `postgresql.password` is marked `yes` against a `SecretStr("")` default:
    documenting a password as required is the right operator guidance, leave it. `catalog-overview.md:79`'s
    "**nine** list-shape consumers" over a seven-item enumeration is **DOC-186**'s already-derived figure
    (`status: done`), not a new contradiction. The `# or` / `# Create a token` lines on `odd-airflow-2.md` and
    `odd-cli.md` are shell comments inside fenced code blocks, not stray H1s.

### Notes

- **Resource discipline.** The heavy-e2e flock was **not** taken; the carry-over is proved, not assumed. No
  compose stack was raised. `git status --short lineage/` is **empty** — no `/enrich`, no probe, no ontology
  drift. The only container I started is a throwaway `postgres:13.2-alpine` (`rev060pg`) for the measurements,
  torn down at the verdict. The unit build ran read-only against the implementer's worktree
  (`ODD_PLATFORM_DIR`), leaving only `build/` artefacts. This review commits exactly the verdict, its
  `state/active-streams.yaml` entry, `state/PROGRESS.md`, and the three follow-up artefacts (DOC-517, DOC-518,
  DOC-433's extension).
- **A process note of my own, disclosed.** I registered my `state/active-streams.yaml` entry mid-session rather
  than at intake, which the protocol asks for at the *first* tool call. Nothing collided — I live-reconciled at
  intake (`origin/main` still `b5d9f150`, worktree clean, `docker ps` carrying only an unrelated idle
  prometheus container, flock free, `lineage/**` clean, no co-active stream) — but the entry existed only from
  ~12:30. Recorded rather than backdated.
- **On the verdict.** Three rounds in, the thing worth saying is that each rejection found something real and
  each rework closed it without collateral: round 1's doc-half-of-the-DoD, round 2's one unrunnable table row,
  round 3's test name that asserted a property the same round had disproved. The engineering underneath has
  been verified more strictly than the item claims at every round — the compositional mechanism that keeps a
  printed promise the named function would have revoked, the per-branch guard proved by mutation, the honest
  retraction in F1b, the refusal to report an inert coverage gate as "100 %". What I add this round is that the
  *table itself* is now measured rather than argued: five rows, five compiled tsqueries, five row sets, on the
  version we deploy. The one claim I could not confirm is filed against the open doc PR rather than held over
  the item, and I have written down why so the call can be overruled in a sentence.
