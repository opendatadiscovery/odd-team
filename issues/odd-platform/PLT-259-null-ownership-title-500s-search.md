---
id: PLT-259
title: "An ownership row with a NULL title_id 500s the entire search results page (There's no title with id null found in titleDict)"
target_repo: odd-platform
issue_type: bug
status: draft
github_issue_url: ""
github_issue_number: null
filed_title: "A data entity whose ownership row has no title breaks the whole search results page (500)"
filed_labels: "kind: bug, scope: backend"
severity: high   # one row takes down a whole page for every user, and the column that causes it is nullable
discovered_during: "CTRIB-062 / #1842 ST-8 - an integration fixture created an ownership row without a title"
found_date: "2026-08-31"
user_facing_verified: true   # reproduced end to end against a running platform; see the evidence
suggested_milestone: ""      # SUGGESTED ONLY -- the maintainer attaches one
---

## Summary

`ownership.title_id` is **nullable**, but the mapper that renders a data entity's owners treats a null as an
error. One such row makes the **entire search results page** return `500 SYS001`, not just that row.

This is the same failure shape as the transformer-with-null-details bug (a single malformed row taking down
the whole results page), which is why it is worth closing the same way: degrade the row, do not fail the page.

## Reproduce

```sql
INSERT INTO ownership (data_entity_id, owner_id) VALUES (<any searchable entity>, <any owner>);
-- title_id defaults to NULL
```

Then search for that entity.

**Expected:** the entity appears, with an owner shown and no title (or the owner omitted).
**Actual:** `POST /api/search/assets` returns `500` and the page shows nothing at all.

## Evidence

```
POST /api/search/assets?size=10  {"query":"...","filters":{}}
-> HTTP 500 {"code":"SYS001","message":"Internal Server Error", ...}

java.lang.IllegalArgumentException: There's no title with id null found in titleDict
  at DataEntityDtoMapper.lambda$extractOwnershipRelation$0(DataEntityDtoMapper.java:132)
  at DataEntityDtoMapper.extractOwnershipRelation(DataEntityDtoMapper.java:141)
  at DataEntityDtoMapper.mapDimensionRecord(DataEntityDtoMapper.java:80)
```

Reproduced on a LOGIN_FORM deployment running a 1.0.0-line build. The same mapper backs the data-entity
dimension path, so other list surfaces that resolve owners are likely affected too - not verified.

## User-facing impact

The blast radius is disproportionate to the cause. A single ownership row with no title - a state the schema
permits, since `title_id` has no NOT NULL constraint - makes **search return nothing for everyone**, with a
generic "Internal Server Error" and no indication of which entity is at fault. An operator would see a
catalog-wide outage and have no path from the symptom to the one bad row.

Whether a NULL title is reachable through the UI was not established; it is certainly reachable through direct
database writes and through any ingestion or migration path that writes ownership without a title, which is
enough for a defensive fix.

## Suggested direction (not prescriptive)

Treat a missing title the way the transformer null-details fix treated a missing details DTO: render the
ownership with no title rather than throwing. If a title is genuinely required, add the NOT NULL constraint so
the invalid state cannot be stored in the first place - but do not leave the column nullable and the reader
strict.

## Notes

Found because an integration fixture for an unrelated feature (#1842) inserted `ownership (data_entity_id,
owner_id)` without a title, which the platform's own test helper always sets. Not caused by that change - the
mapper is untouched by it.
