---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-30
consulted_by: maintainer-direct (via /contribute #1825 design session)
slug: first-class-search-sorting-design
confidence_overall: HIGH
feeds: [adrs/drafts/unified-asset-search.md (rev 3), adrs/drafts/research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md, state/search-overhaul-decomposition.md]
---

# First-class Search — sorting model, SRE envelope, capability bar, sort-control UX

**Headline (HIGH):** Sorting is a property of a *typed column*. Ship the `sort` contract + status-priority/relevance
defaults now (ST-2, closes #1705); attach the per-column-type matrix to the column constructor later (ST-7). Index
sortable columns as **NULLS-aligned btree** (denormalised `status_priority` + a **snapshotted `popularity_score`,
NEVER the live `view_count`**); keyset-paginate stored-column sorts with an `id` tiebreaker, OFFSET-with-depth-cap
for relevance. ODD's per-column-type matrix + status-priority + recipient-scoped param-URL would **exceed** the six
tools checked; the gaps to **close** are DataHub-grade query operators (`websearch_to_tsquery`) + AND/OR/negation facets.

## Load-bearing recommendations
- **Status sort = named semantic orderings, never asc/desc.** Two ship: **Maturity (stable-first = #1705)** [default
  browse] and **Needs-attention (unassigned-first)** [steward hygiene] — NOT reverses of each other.
- **Datetime = 4-way matrix, default DESC NULLS LAST**; UX shows "Newest/Oldest" + one advanced "show unknown first"
  toggle; never the raw matrix.
- **Alphanumeric** = A→Z case-insensitive, **ICU locale** (not `C` byte order); namespace/owner nullable → nulls-last;
  **owner is multi-valued → sort key ambiguous (min vs primary) — code-read needed.**
- **Numeric** = DESC default; ASC = "find dead assets"; **kind-specific column sort segregates a mixed result by kind**
  (DEs first, rest in nulls tail) — state it.
- **No multi-key sort builder** (no tool has one); always append `id` tiebreaker; offer one fixed composite
  status→{popularity|name|updated}.
- **Browse default fork (maintainer's call):** trust-first (#1705) vs market usage-first (Select Star/Amundsen) →
  **recommended hybrid `status_priority → popularity_score DESC`.**
- **Sort control:** global dropdown (~5 canonical sorts, Secoda model) + per-column ▾ type-derived menu (the column-
  constructor attachment, ST-7). Reject header click-cycle as the sole control (can't express status orderings).

## SRE
- Btree default `ASC NULLS LAST`/`DESC NULLS FIRST` → product default `updated_at DESC NULLS LAST` needs an explicit
  index; that index also serves the `ASC NULLS FIRST` steward inversion by backward scan.
- `status_priority smallint` denormalised + indexed (not CASE at scale). **Needs-attention** ≠ its mirror → own CASE-sort.
- **Keyset > OFFSET (~17× deep)**; needs unique `id` tiebreaker; nullable keys complicate the cursor → keyset only the
  indexed common sorts; **relevance (`ts_rank`) isn't seekable → OFFSET + depth cap.**
- Bound arbitrary sorts: `sortable` + `sortable-at-depth` flags; global depth cap (~10k → "refine filters").
- Unified index (D1) is what makes cross-kind sort index-backable (federated would app-merge-sort 4 streams).
- **D5 correction: index a snapshotted/bucketed `popularity_score`, not the live `view_count`** (a known write-
  contention hotspot — denormalising the live counter couples index writes to read volume).
- **Operators:** adopt `websearch_to_tsquery` → DataHub-style operators, injection-safe (serves IT-003). MEDIUM, verify.

## Capability bar (cited; n/m = not in the fetched page)
DataHub leads query operators (AND/OR/NOT/phrase/wildcard/fielded) + facet logic (AND/OR/negation) — ODD's must-match
gap. Amundsen/Select Star = usage-first ranking default. Secoda = cleanest 4-sort menu (Relevance/Popularity/Last-
modified/Date-created). ODD leads on lifecycle-status sort, per-column-type sort, recipient-scoped param-URL.
**Collibra UNVERIFIED — all three doc URLs 404'd; no claim made.**

## Code issues discovered (logged as follow-ups)
1. `status_updated_at` never bumps — `DataEntityMapperImpl.applyStatus` sets status before the prior-status check
   (`concepts.yaml:123-127`). Fix when adding `status_priority`.
2. Code-read needed: `view_count` NULL-vs-0 + the multi-owner sort key — a file-analyser pass before ST-7.

## Citations (first-party; fetched 2026-06-30)
- `docs.opendatadiscovery.org/features/data-discovery` (200) — 7 facets; statuses UNASSIGNED/DRAFT/STABLE/DEPRECATED/DELETED; no sort/popular mentioned.
- `docs.datahub.com/docs/how/search` (200) — AND/OR `|`/NOT `-`/phrase/wildcard/fielded; facet AND/match-any/negation; relevance default; `highlightFields`.
- `docs.atlan.com/product/capabilities/discovery` (200) — filter by source/cert/owner/tags; "save and share filtered views". (how-tos page 404.)
- `github.com/amundsen-io/amundsen` (200) — pagerank/usage-ranked; user sort not mentioned. (amundsen.io TLS error.)
- `docs.selectstar.com` (200) — popularity-ordered default.
- `docs.secoda.co/features/search` (200) — 4 sorts (Relevance/Popularity/Last-modified/Date-created); 90-day popularity; "Search views".
- `productresources.collibra.com/.../co_search*.htm` (404 ×3) — UNVERIFIED.
- `postgresql.org/docs/current/indexes-ordering.html` (200) — btree NULLS defaults + index/ORDER-BY alignment.
- `use-the-index-luke.com/no-offset` (200) — OFFSET deep-page cost; keyset pattern; "cannot navigate to arbitrary pages"; ties not addressed.
- Workspace: ADR rev 3 (D1/D2/D5/D7/D10/D11/D12), PRD-0003, the decomposition, `SAVED-SEARCH-URL-SECURITY.md`, `concepts.yaml:107,123-127,564`, `system-mission.md:80,95`.

_Full reasoning synthesised into `adrs/drafts/research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md`._
