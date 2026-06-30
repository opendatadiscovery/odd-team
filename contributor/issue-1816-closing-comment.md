<!-- PASTE-READY comment for github.com/opendatadiscovery/odd-platform/issues/1816 — review PR/merge state before posting. -->

## Recently Viewed — foundation delivered (1.0.0); closing, with the search-integration tracked separately

The core of Recently Viewed is implemented and rides the 1.0.0 release train:

- **Record-on-open** — opening a data entity / term / query example detail page records it via a deliberate
  `POST /api/recently-viewed` (not a side-effect of the existing GET), fire-and-forget, deduped move-to-top.
- **Per-user history** keyed on `(oidc_username, provider)` — every user gets it, including users with no
  Owner; principal-scoped reads (you see only your own). Under `auth.type=DISABLED` it backs a single shared
  "(shared)" bucket, labelled non-possessively.
- **Main-page panel** — a "Recently Viewed" column in the Recommended block (5 most-recent), with the
  open-alert row highlight matching Popular.
- **Recency on every surface** — a dedicated "Recently viewed" column on the Data Entity / Term / Query
  Example lists (pinned so it stays reachable on narrow screens), and an absolute "Viewed {date} UTC±hh:mm"
  on the detail header (relative "x ago" on lists).
- **Per-row remove** + **retention housekeeping** (TTL + newest-N per user, ShedLock-guarded for
  multi-instance safety).
- The list/read API already carries `viewed_after` / `viewed_before`, so a recency **filter** can read this
  foundation directly.
- User docs (Features → Recently Viewed) ride the same release train.

Shipped across #1826, #1827, #1828, #1829, #1830, #1831.

### Intentionally deferred → tracked, not dropped

The original design's standalone Recently Viewed **tab** + facet sidebar are **superseded by the unified,
faceted Search overhaul (#1825)**, which adds a recently-viewed filter reading exactly this foundation. So
rather than maintain a parallel list surface, the panel's "View all" will deep-link into Search with the
recency filter applied. Remaining work:

- **#1825** — unified faceted Asset search, including the recently-viewed filter.
- **#NNNN** — wire the Recommended "Recently Viewed" panel's "View all" into Search filtered to
  recently-viewed (blocked on #1825's filter + its filter-state contract).
- A small follow-up to right-pin the recency column on the Term + Query-Example lists (the Data Entity search
  list already has it).

Closing #1816 as delivered — the recently-viewed history, recording, surfacing, removal and retention are all
in. The search-integration continues under #1825.
