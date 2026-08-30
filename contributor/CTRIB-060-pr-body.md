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

Both buckets run locally before this PR left draft; the numbers are in the PR checklist below.

## Docs

`Docs: documentation@release/1.0.0 — publishes with the 1.0.0 release.` A new "Query syntax" section on
`docs/data-discovery/search.md` plus a correction to the metacharacter caveat, which until now told readers that
*all* punctuation is a word separator. A separate item corrects the **currently published** page, where the same
caveat omits `"` and `-` and never mentions that `-word` is read as a required word.

Milestone: 1.0.0

Closes #1840
