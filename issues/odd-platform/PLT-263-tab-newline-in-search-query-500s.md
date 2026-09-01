---
id: PLT-263
title: "A tab or newline in the search query still reaches to_tsquery unsplit and 500s the search (42601), and the broken query is persisted in the search session"
target_repo: odd-platform
issue_type: bug
status: draft
github_issue_url: ""
github_issue_number: null
filed_title: "A tab or newline in the search box returns HTTP 500 and poisons the saved search session"
filed_labels: "kind: bug, scope: backend"
severity: high   # persistent 500 on the catalog's primary navigation surface, reachable by an unauthenticated caller under auth.type=DISABLED
discovered_during: "/review CTRIB-060 (#1840 ST-6, query operators) - reviewer's own postgres:13.2-alpine measurement of the shared FTS sink"
found_date: "2026-09-01"
user_facing_verified: true   # reproduced end to end against a running platform built from odd-platform@6281a9df; both query paths, plus the persisted-session re-read
suggested_milestone: ""      # SUGGESTED ONLY -- the maintainer attaches one
---

## Summary

`JooqFTSHelper.tsQuery(String)` is the sanitiser that #1756 added so a metacharacter in the search box can
never raise Postgres `42601` (`syntax error in tsquery`). It strips the tsquery operator set and then splits
the remaining text into terms:

```java
private static final Pattern TSQUERY_SPECIAL_CHARS = Pattern.compile("[!&'()*:<>|\\\\]");
...
return Arrays.stream(TSQUERY_SPECIAL_CHARS.matcher(plainQuery).replaceAll(" ").split(" "))
    .filter(queryPart -> !queryPart.isEmpty())
    .map(queryPart -> queryPart + ":*")
    .collect(Collectors.joining("&"));
```

Both steps only know about the **space** character:

* the strip set does not contain `\t`, `\n`, `\r`, or any other whitespace;
* `split(" ")` is a regex matching one literal space, not `\s+`.

So a query containing a tab or a newline is emitted as a single "term" with the whitespace still inside it, and
`to_tsquery` is handed a string it cannot parse. That is the exact failure #1756 was closed to prevent, still
open for one input class.

## Reproduce

Any query with a tab or newline between two words. Through the API:

```
POST /api/search        {"query": "foo\tbar"}
POST /api/search/assets {"query": "foo\tbar"}
```

The UI reaches it too: the catalog search URL is `/search?q=<query>` and the front end passes `q` through
verbatim (`odd-platform-ui/src/lib/search/searchUrlState.ts` performs no whitespace normalisation), so
`/search?q=foo%09bar` is a shareable link that fails for everyone who opens it.

**Expected:** a page - results, or "No matches found" - the way every other punctuation input behaves today.
**Actual:** HTTP 500.

## Evidence

**On a running platform** (a local stack built from `odd-platform` at the current search line; seeded through
the real ingestion API), a query whose two words are separated by a TAB or a NEWLINE instead of a space:

```
POST /api/search/assets  {"query":"revcust customer"}    -> 200
POST /api/search         {"query":"revcust customer"}    -> 200

POST /api/search/assets  {"query":"revcust\tcustomer"}   -> 500 {"code":"SYS001", ...}
POST /api/search         {"query":"revcust\tcustomer"}   -> 500
POST /api/search/assets  {"query":"revcust\ncustomer"}   -> 500
POST /api/search         {"query":"revcust\ncustomer"}   -> 500
```

Server side:

```
io.r2dbc.postgresql.ExceptionFactory$PostgresqlBadGrammarException:
  [42601] syntax error in tsquery: "revcust	customer:*"
```

**And it is sticky.** The legacy path writes the raw query into the session row *before* the query runs, so the
poison persists and every later read of that session fails again:

```
select id, position(chr(9) in query_string) from search_facets order by id desc;
  c2afa946-...  ->  9      (the raw TAB is in the stored query_string)

GET /api/search/c2afa946-...                       -> 500
GET /api/search/c2afa946-.../results?page=1&size=10 -> 500
GET /api/search/c2afa946-.../facet/OWNERS           -> 500
```

That is the #1756 persistent-500 shape, still reachable  --  and the manual currently tells readers it was fixed
in 0.28.0 (`docs/data-discovery/search.md`, "Known limitations and operator caveats").

At the SQL layer, on `postgres:13.2-alpine` (the deployed version) with
`default_text_search_config = pg_catalog.english`:

```
tsQuery("foo\tbar")              -> "foo\tbar:*"        (the tab survives both the strip and the split)
SELECT to_tsquery(E'foo\tbar:*') -> ERROR:  syntax error in tsquery
SELECT to_tsquery(E'foo\nbar:*') -> ERROR:  syntax error in tsquery
```

For contrast, the same two words separated by a space compile fine (`'foo':* & 'bar':*`).

## User-facing impact

1. **The search page 500s.** The catalog's primary navigation surface returns `500` rather than a page.
2. **The failure is sticky, not transient.** The legacy `/api/search` path persists the raw query in the
   `search_facets` session row before the query runs, so *every later read* of that `/search/{uuid}` session
   fails again until the housekeeping job evicts the row. This is the persistent-500 shape #1756 documented,
   and the published manual tells readers it was fixed in 0.28.0
   (`docs/data-discovery/search.md`, "Known limitations and operator caveats").
3. **It is reachable without authentication under `auth.type=DISABLED`**, which the docs already describe as an
   open posture for the search endpoints - so an anonymous caller can plant poisoned sessions.
4. **A tab is easy to produce by accident**: pasting two cells from a spreadsheet, a table, or a terminal into
   the search box yields tab-separated text.

## Suggested fix

One line, in the method that already owns this responsibility - make the sanitiser whitespace-aware rather
than space-aware:

```java
// strip on any whitespace, and split on any run of whitespace
return Arrays.stream(TSQUERY_SPECIAL_CHARS.matcher(plainQuery).replaceAll(" ").split("\\s+"))
```

(or add `\s` to `TSQUERY_SPECIAL_CHARS`; either closes it). Worth adding the two payloads to the existing
`JooqFTSHelperTest` parity pins and to the `AssetSearchServiceIntegrationTest` poison set, which today covers
punctuation but no non-space whitespace.

## Notes for the maintainer

* This is **pre-existing**, not a regression from #1840 / ST-6.
* ST-6 does change the shape of the bug: inside the new **operator** path the tokenizer splits on
  `Character.isWhitespace` and rejoins bare terms with single spaces, so after ST-6 `foo<TAB>bar "x"`
  is safe while `foo<TAB>bar` still 500s. **Measured on the same running stack**:
  `{"query":"revcust\tcustomer \"customer orders\""}` -> **200** on both endpoints, while
  `{"query":"revcust\tcustomer"}` -> **500**. The inconsistency is worth closing in the same place.
* The fix sits inside `JooqFTSHelper.tsQuery`, a method #1840 / PR #1873 already touches the neighbourhood of -
  so it can be folded into that PR if the maintainer prefers one change over two.
