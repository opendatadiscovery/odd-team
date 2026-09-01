## What this changes

Gives ODD's search box three operators — a quoted phrase, `-` exclusion, and `or` — at the **single shared FTS
sink**, so every search surface speaks one query language.

The rule a user can hold: **bare words match as prefixes; a quoted phrase and an excluded word match exactly.**

| You type | Before | After |
|---|---|---|
| `"customer orders"` | quotes dropped — both words anywhere | the words adjacent |
| `customer -test` | the dash dropped — `test` becomes **required** | `test` excluded |
| `customer or orders` | treated as AND — returns neither | returns either |
| `cust ord` | prefix-matched | **unchanged** |
| `cust -test` | `test` required | `test` excluded, `cust` **still prefix-matched** |

## Root cause of the "before" column

`JooqFTSHelper.tsQuery` strips every `tsquery` metacharacter and emits `token:*&token:*`. That is correct and
deliberate — it is the #1756 fix that stopped a metacharacter from raising Postgres `42601` and persisting a
poisoned session. But it also means `"`, `-` and `or` are silently discarded, and the negation case ends up
**inverted**: `customer -test` returns exactly the assets the user was trying to exclude.

## Why not `websearch_to_tsquery`

The issue proposed it, and it is the obvious choice — it never raises on metacharacters, which is precisely the
property this sink needs. Measured on `postgres:13.2-alpine` (the deployed version), it has one disqualifying
cost: **it performs no prefix matching.** Against an index containing "Customers Orders", `cust` matches today
and stops matching under it.

That is not an internal detail. The manual states the search box "matches the remaining words **as prefixes**",
and operators get typed *second*, as a refinement — so `cust` would return results and `cust -test` would return
none. The act of refining would destroy the result set. DataHub, the parity target, applies exact matching
**per quoted term**, never as a mode the system switches on the user's behalf.

Prefix and operators are not mutually exclusive. The query is composed from tsquery primitives instead:

```
bare terms   ->  to_tsquery(tsQuery(...))     -- the EXISTING sanitiser + prefix path, unchanged
"a phrase"   ->  phraseto_tsquery(...)
-word        ->  !! plainto_tsquery(...)
or           ->  ||   (AND binds tighter, matching websearch_to_tsquery's grammar)
```

Every leaf is a Postgres constructor that **cannot raise** on metacharacters, and every user-supplied value is a
**bind** — never rendered into SQL text. An operator-free query still compiles to the one pre-existing
`to_tsquery` call, so plain-term behaviour is preserved structurally rather than by test coverage.

The tokenizer's grammar was checked case-by-case against `websearch_to_tsquery` so the operators behave the way
it would: `foo -bar` and `foo - bar` both negate; `my-table`, `e-mail`, `2024-01-01` and a trailing dash do not;
`Or` operates but `oracle`, `ORdering` and `sales_or_ops` do not; a quoted span wins over everything inside it.

## Index-searchability guard

Negation introduces a hazard that did not exist before: a query with **no positive term** cannot use the GIN
index. Measured, `-test` alone plans as a **Seq Scan** over the whole search index — a cheap denial-of-service on
a public endpoint. Postgres's `querytree()` returns `T` for exactly that shape, so each **OR branch** is guarded
and collapses to the empty tsquery when it is non-indexable.

Per-branch, not per-query: guarding the whole expression makes `customer or -test` return **nothing**, when the
`customer` branch alone is a perfectly good index scan. Measured both ways — 0 rows vs 50 000.

An operator query beyond 64 leaves fails closed rather than falling back to the plain path, because that path
would read every `-x` as a *required* term — the inversion this PR fixes, applied silently.

## Scope

The issue scopes this to "the unified query". The sink is the right unit instead: the sidebar **facet counts**
run through it too, so operators on the result list but not the count path would make the count badge disagree
with the rows it counts. The legacy `/api/search` path, term search, query examples, lookup tables, autocomplete
and the result highlights all adopt the same grammar — one language, not two dialects. This *reduces* the diff
rather than growing it: one method changed, no second dialect added.

Highlights are moved onto the same expression so a row is highlighted on what it actually matched.

**Not in this PR:** facet AND/OR/negation logic (ST-11); cross-kind highlight parity (ST-12); retiring the legacy
`/api/search` path (P4); ranking or FTS-weight changes; any migration or index change.

**One side effect, no data touched:** saved searches and bookmarked sessions persist the raw query string, so one
containing `"`, `-` or `or` changes meaning on replay. That change *is* the fix.

## Discoverability

Operators nobody is told about barely exist. The search box gains the platform's established inline-help
affordance (ADR-0076: `InformationIcon` + `AppTooltip`), translated into all seven locales. The shared
`TooltipBody` moved out of `Activity.styles` next to `AppTooltip` itself, so this is its second consumer rather
than a copy.

`SearchFormData.query` also gains an OpenAPI `description` — it had none.

## Evidence

All measured locally on this branch at `6281a9df` (rebased onto `b5d9f150`, ST-8). Every e2e run carries
`confirmed: the e2e stack is running the SUT image`, with the SUT built from this commit.

**Unit — `:odd-platform-api:build`**

| | |
|---|---|
| full build | **810 tests, 1 failure** |
| the 1 failure | `OpenApiDocsContractTest.platformApiGroupDocumentLoads` — a 60s blocking read. Proven **not** attributable: it passes **alone** on this branch (3/3) *and* alone on pure `main` (3/3); it only fails inside the loaded full build. Logged upstream-side as a wait-strategy issue |
| `JooqFTSHelperTest` | 45/45 — including all 13 pre-existing `tsQuery` parity cases, **unmodified** |
| `AssetSearchServiceIntegrationTest` | 15/15 |

**The RED proof** — the same behavioural suite against `main`, 6 failures:

| query | on `main` | on this branch |
|---|---|---|
| `phrasealpha "customer orders"` | 2 rows — quotes dropped | 1, the adjacent one |
| `negbeta customer -test` | returns the asset it was asked to **exclude** | the kept one |
| `orgamma alphaside or orgamma betaside` | `[]` — branches ANDed | both |
| `prefixdelta custom -testfixture` | `expected: 13L but was: 14L` — the inverse row | the kept one |
| `-negonlyeta` | rows | empty page |
| `guardzeta indexable or -absentword` | `[]` — indexable branch lost | that branch answers |

**The guard is proved by mutation, not assertion.** Disabling the `querytree` guard turns both guard tests RED;
restoring it turns them green. The OR case only bites because it also asserts an unrelated neighbour is
*absent* — a presence-only assertion would pass with the guard removed.

**Integration — four suites, then an A/B against a pure `main` SUT on the same quiet box:**

| Suite | this branch | pure `main` `b5d9f150` |
|---|---|---|
| `feature-complete` | 328 passed / 12 failed | **328 passed / 12 failed — identical failing set, test-name for test-name** |
| `known-bugs` | 3 RED (its expected pins) | — |
| `multi-stack` | 14 passed | — |
| `ingestion-e2e` (run alone) | 15/15 | 15/15 |

`diff` of the two `feature-complete` failure lists is empty, so this change introduces **no** e2e regression.
The 12 are pre-existing on `main` and unrelated to it. (`api:FAIL` on that suite is a known-dead probe rail —
the extractor fails to build — not this change.)

**Front-end:** `tsc --noEmit` and `eslint` clean. The rendered search bar and the hint tooltip were reviewed as
a user, not just asserted: the `(i)` sits beside the input, and hovering renders the syntax help as a padded,
bordered card rather than an unstyled row.

**One thing worth stating plainly:** CI's `min-coverage-changed-files: 98` is **inert** for this PR.
`jacocoExcludes` carries `'**/repository/**'` and both changed production files live under `repository/`, so
the gate has zero instrumented changed lines to measure — it cannot fail here and offers no assurance about it.
The assurance is behavioural: 60 tests across the two buckets, a 6-case RED proof, and a mutation probe.

## Docs

`Docs: documentation@release/1.0.0 — publishes with the 1.0.0 release.` Documentation PR
[opendatadiscovery/documentation#111](https://github.com/opendatadiscovery/documentation/pull/111), based on the
`release/1.0.0` train: a new "Query syntax" section on `docs/data-discovery/search.md`, a correction to the
metacharacter caveat (which until now told readers that *all* punctuation is a word separator), the same
capability swept through the three pages that summarise search (`Features.md`, `data-discovery.md`,
`Architecture.md`), and a correction to `ADR-0071`, whose Evidence line asserted a `? @@ to_tsquery(?)` literal
this change deletes. A separate item corrects the **currently published** page, where the same caveat omits `"`
and `-` and never mentions that `-word` is read as a required word.

## Review round 2 — what changed after the first review

A separate-session review rejected the first push on the documentation half of the Definition of Done: the doc
existed as one good page on a branch that had never been pushed, cut from a train head that had since moved, and
three summary surfaces plus a published ADR still described the search box as plain free text. The code passed
that review — the reviewer re-derived the grammar against a compiled build and supplied the GIN-index `EXPLAIN`
the plan-check had recorded as missing. This push closes the review's list:

- the doc branch is rebased onto the current train and pushed (PR #111 above), with the one conflict — the page
  description — resolved in favour of the train's framing rather than reinstating a phrase a merged commit had
  already corrected;
- the capability is swept to zero residue across the summary surfaces, matching the shape the preceding search
  slice used;
- **`ReactiveDataEntitySearchResultsTest`** gains the covering artifact the plan promised for "the list, the
  total and the sidebar facet all agree": two cases assert that a quoted-phrase query and a `-exclusion` query
  partition `findByState`, `countByState` and `getEntityClassFacetForDataEntity` identically. Both are **RED on
  `main`** and green here — a count badge that disagrees with the rows it counts is exactly what the shared sink
  exists to prevent;
- **`ReactiveDataEntityHighlightInjectionTest`** gains two operator cases on `getHighlightedResult`. They are
  documented for what they actually pin: `ts_headline` marks up every lexeme *mentioned* in the tsquery — a
  negated one included — so it cannot discriminate the old dialect from the new, and the shared-expression
  property is held by construction rather than asserted. The doc sentence that implied otherwise was corrected;
- two comments the change had made imprecise (the unified-search FTS note, the highlight test's javadoc) now
  describe the composed expression.

The production delta in this round is **comment-only**, so the four-suite regression's verdict carries over
unchanged; the unit build was re-run in full.

Closes #1840
