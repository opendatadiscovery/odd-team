---
id: PLT-261
title: "Query Examples are the only searchable asset kind with no ownership relation, so they cannot be owned, filtered by Owner, or scoped by the My-data filter"
target_repo: odd-platform
issue_type: feature
status: filed
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1872"
github_issue_number: 1872
filed_title: "Query Examples cannot be owned: add a query_example ownership relation (Data Entities and Terms both have one)"
filed_labels: "kind: feature, scope: backend, scope: frontend"
severity: medium   # not a defect - an absent capability that three shipped surfaces have to work around
discovered_during: "/review CTRIB-062 (#1842 ST-8) follow-up - the maintainer asked whether the My-data exclusion caption had a tracked cause"
found_date: "2026-09-01"
filed_date: "2026-09-01"   # filed by the odd-contributor[bot] App on the maintainer's explicit instruction
user_facing_verified: true   # the exclusion is visible in the shipped UI caption; the Owner-facet pass-through read from the shipped predicate
suggested_milestone: ""      # SUGGESTED ONLY -- the maintainer attaches one
---

## Summary

ODD has three searchable asset kinds. Two of them can be owned:

| Asset kind | Ownership relation | Since |
|---|---|---|
| Data Entity | `ownership(data_entity_id, owner_id)` | `V0_0_3__add_ownership.sql:10` |
| Term | `term_ownership(term_id, owner_id)` | `V0_0_35__add_terms.sql:30` |
| **Query Example** | **none** | - |

Query Examples have four tables - `query_example`, `data_entity_to_query_example`,
`query_example_search_entrypoint` (`V0_0_84__create_query_example.sql`) and `query_example_to_term`
(`V0_0_90__added_query_example_to_term_relations.sql`) - and no ownership relation and no owner column. The
API contract agrees: `QueryExample`, `QueryExampleDetails` and `QueryExampleList` carry no owner-shaped field.

This is not a bug report. It is a request for the missing capability, filed because three shipped surfaces now
have to work around its absence.

## Why it matters now

A Query Example is a curated artefact. Someone wrote "this is how you query this dataset" and other people
rely on it. Unlike an ingested Data Entity, a snippet does not come from a source system with its own
provenance - the platform is the only place its authorship can live, and today it does not live anywhere.
There is no way to answer "who maintains this snippet?", "which snippets am I responsible for?", or "this
query is wrong, who do I tell?".

## The three places the absence is already visible

**1. The My-data filter has to exclude them, and says so in the UI.** The new My-data scope
(#1842 / ST-8) resolves ownership per kind: an `ownership` branch for Data Entities and a `term_ownership`
branch for Terms. There is no branch for Query Examples, so they are excluded outright whenever any My-data
scope is active, and the sidebar ships a caption explaining why:

> Query examples have no owner, so they are excluded from My data.

That caption is honest and correct. It is also a standing admission that one third of the unified search
cannot participate in the catalog's main personalisation feature.

**2. The Owner facet silently does not narrow them.** In the unified asset search the shared sidebar facets
are applied to Data Entity rows through a `DATA_ENTITY.ID` semi-join, kind-guarded with pass-through:

```
ASSET_KIND != DATA_ENTITY  OR  DATA_ENTITY.ID IN (facet matches)
```

So selecting an Owner narrows the Data Entities and leaves **every** Query Example in the result untouched.
A user who filters by Owner and sees Query Examples in the list has no way to know those rows were never
filtered.

(The code comment at that condition attributes cross-kind facet application to "ST-11". #1845 (ST-11) is
scoped to facet AND/OR logic, negation and datetime-range facets - cross-kind facet application is not in it,
so that pointer looks stale. Worth correcting whichever way this issue goes.)

**3. RBAC has no per-snippet stewardship either.** The seven `QUERY_EXAMPLE_*` policy permissions are global
rather than per-owner, so even with roles configured there is no notion of "the owner of this snippet".

## Suggested shape

`term_ownership` is the closest precedent and the cheapest template - Terms are, like Query Examples, a
platform-authored asset rather than an ingested one:

1. **Schema:** `query_example_ownership(query_example_id, owner_id)`, mirroring `term_ownership` (hard-delete,
   no `deleted_at`, as `term_ownership` has been since `V0_0_76`).
2. **Contract:** an `owners` field on `QueryExample` / `QueryExampleDetails`, plus the assign/unassign
   endpoints that Terms already have.
3. **Search:** add the Query Example branch to the My-data scope predicate and let the Owner facet reach
   Query Example rows. Both are then ordinary uses of existing machinery rather than new special cases, and
   the UI caption in (1) can simply be deleted.
4. **UI:** an Owners section on the Query Example detail page, matching the Term page.

Steps 1 and 2 are the load-bearing ones; 3 and 4 fall out of them.

## Out of scope / open questions for the maintainer

- Whether ownership should be **inherited** from the linked Data Entity instead of assigned directly. That
  would need no new UI, but a snippet can link to several entities with different owners, and the person who
  wrote the query is not necessarily the person who owns the table - so a direct relation seems the better
  fit. Worth a decision either way.
- Whether an author should be recorded automatically on create (a `created_by`-style actor) in addition to
  the mutable Owner association. ODD already distinguishes the immutable External User from the mutable
  internal Owner elsewhere; the same split may apply here.

## Verification

Everything above was read from `origin/main` at `b5d9f150` on 2026-09-01:

- ownership relations: `git grep -n "CREATE TABLE.*ownership" -- '*/db/migration/*'` returns exactly
  `ownership` (`V0_0_3`) and `term_ownership` (`V0_0_35`).
- Query Example tables: `V0_0_84__create_query_example.sql`, `V0_0_90__added_query_example_to_term_relations.sql`
  - no owner column, no ownership table.
- contract: no owner-shaped field on `QueryExample`, `QueryExampleDetails`, `QueryExampleList` in
  `odd-platform-specification/components.yaml`.
- the My-data per-kind branches and the Owner-facet pass-through: `ReactiveAssetSearchRepositoryImpl`,
  conditions (5) and (6).
- permissions: `SecurityConstants.java` lines 67-73, 113, 189.
