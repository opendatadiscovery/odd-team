---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-27T00:00:00Z
consulted_by: maintainer-direct
consultation_question: Critique the shipped Favorites S3 frontend slice end-to-end as Product Owner + SRE — validate/sharpen/enrich the maintainer's 8 raw feedback points into a clean, prioritized requirements set for an additional slice before opendatadiscovery/odd-platform#1815 can close.
slug: favorites-s3-po-sre-critique
confidence_overall: HIGH
prompt_version: odd-sme/0.1.0
---

# Favorites (S3) PO + SRE critique: from 8 raw notes to a closure requirements set for #1815

## TL;DR

The maintainer's eight notes are almost all **VALID** — S3 shipped a thin vertical slice that under-delivers against the platform's own established patterns and against PRD-0001 §5/§5.6 itself (which already specified the 4 cross-kind facets, the rich row, and the autocomplete facet sidebar). The two notes that need reshaping, not literal adoption, are **#1** (reuse the My-Objects *column component* but render in an **own always-on band outside** the owner-gated Recommended grid — Favorites must show under DISABLED/no-owner where Recommended is hidden) and **#3** (the split belongs in **both** the filter taxonomy *and* the backend contract, but as a flatten-the-UI + add-an-entity-class-refinement, **keeping** the 3-way `AssetKind` as the backend routing discriminator — not collapsing into a flat 9-value enum). The single biggest enrichment the eight notes miss: **every fix must land in the shared foundation components (panel / facet sidebar / row renderer / star-status hydration), not Favorites-only, or Recently-Viewed (PLT-250) re-litigates all eight gaps.** The dominant SRE flag: the 4 facets + full-text the maintainer wants are exactly what the PRD's order-then-semi-join read path handles worst once a facet excludes a kind (Query Examples carry no namespace/datasource; FTS has no tsvector for Query Examples) — tractable only because a curated favorites set is low-cardinality per user.

## Question scope

Archetype: **mixed** (plausibility + implicit-requirements + comparative + workflow), maintainer-direct, post-implementation review of branch `contrib/CTRIB-039-favorites-frontend @ 8c6c4a9d`. The caller supplied verified S3 facts (star placement, panel band, checkbox facet, `asset_types`-only endpoint, 3-kind `AssetKind` with `LOOKUP_TABLE` folded into `DATA_ENTITY`) — treated as anchors, **not re-derived**. In scope: PO verdict on points 1–8 + enrichment + SRE lens + a grouped/prioritized closure set. Out of scope: writing the jOOQ/SQL, the React tree, the OpenAPI diff (named, not authored). Note: PRD-0001 §5.2 Decision #4 is now **resolved** — `LOOKUP_TABLE` folded into `DATA_ENTITY`, so the enum is 3 kinds, matching S3.

## PO lens — per-point verdict (points 1–8)

| # | Raw note | Verdict | Sharpened one-line requirement | Anchor |
|---|---|---|---|---|
| 1 | Panel should match My-Objects form-factor; change Popular's Star icon | **VALID-BUT-RESHAPE** | Reuse the **shared column list component** (form/size/background) but render Favorites in its **own always-on band outside** the owner-gated Recommended grid; reserve **Star = Favorite globally**, give Popular a non-star icon (trending/▲), Recently-Viewed a clock/history icon | `documentation/docs/data-discovery/catalog-overview.md:62` ("all four columns are rendered by a single shared list component"), `:45` (Recommended hidden under DISABLED); PRD §5.5 |
| 2 | "Asset type" checkbox is wrong — use the established multichoice facet | **VALID** | Render every facet via the platform `MultipleFilterItem` autocomplete pattern; add a **"Clear All"**; drop the bespoke fixed checkbox group | `odd-platform-ui/src/components/Search/Filters/Filters.tsx:47-65` (Single/Multiple autocomplete facets + Clear All) |
| 3 | "Data Entity" too broad — split into entity types, combine WITH Terms + Query Examples at one level | **NEEDS-SPLIT (taxonomy + contract)** | **Flatten the UI** to DataEntityClass labels (Datasets, Transformers, Data Consumers, Data Inputs, Quality Tests, Groups, Relationships) **+ Glossary Terms + Query Examples** at one level; **keep `AssetKind` (3-way) as the backend routing discriminator** and add an `entity_class_ids[]` refinement that applies only to the `DATA_ENTITY` semi-join — **not** a flat 9-value `asset_types` enum | `documentation/docs/data-discovery/search.md:35-49` (ODD's own class-as-tabs taxonomy); OpenMetadata "Data Asset Type" + DataHub "Entity Type" flatten classes beside Glossary |
| 4 | Tab rows carry too little info | **VALID** | Reuse the existing **Search/Directory result-row renderer** (name + namespace + asset type + owners + truncated description + created datetime), resolved live via the semi-join — **not** a bespoke `[name][kind][star]` row; render per-kind gracefully (Query Examples have no namespace) | `documentation/docs/data-discovery/search.md:51-57` (per-result info density); PRD §5.4 (no title denormalization → resolve live) |
| 5 | Where are the other facet searches (tags, namespaces…)? | **VALID** | Ship the 4 deferred cross-kind facets — `namespace_ids / datasource_ids / tag_ids / owner_ids` — on the list endpoint + sidebar, with the documented **exclude-a-kind-that-lacks-the-facet** rule | PRD §5.3 (the 4 facets were always specified; deferred at S2); `Filters.tsx:56-65` |
| 6 | Query-Examples LIST rows can't be starred | **VALID** | Put `<FavoriteStar>` on **every** Query-Examples list row, hydrated by a batch favorite-status call (or a client-side favorite-id set) | PRD §9 scope ("star toggle on … query-example rows **and** detail headers"); batch `POST /api/favorites/status` |
| 7 | No full-text search on the Favorites tab | **VALID** | Add a free-text box scoped to the user's favorites (name/description); **MUST** for parity with every other ODD list surface | `documentation/docs/data-discovery/search.md:108-110` (search appears in Query examples / Master Data / Dictionary tabs too); OpenMetadata + DataHub both put FTS on the explore/list surface |
| 8 | "Dictionary" (Terms) LIST rows can't be starred | **VALID** | Same as #6 for Terms list rows | PRD §9 scope; identical mechanism to #6 |

**Point 3 — the careful call (as requested).** ODD's *own* Search already answers this: entity **class** is expressed as the result-class **tab strip** (All / Datasets / Transformers / Data Consumers / Data Inputs / Quality Tests / Groups / Relationships), while **"Type"** (`TABLE`/`JOB`/`DASHBOARD`) is a *class-conditional sidebar facet* — "type values are only meaningful within a class" (`search.md:33,49`). So the maintainer's instinct is correct and ODD-native: flatten by **class** (the tab-strip nouns), reusing those labels verbatim (Gate 1 — no new vocabulary). The split lives in **both** layers: (a) the **UI taxonomy** flattens to ~9 options, each mapping to `(asset_kind [+ entity_class])`; (b) the **backend contract** keeps the 3-way `AssetKind` discriminator (it routes *which table to semi-join*) and gains `entity_class_ids[]` reusing the existing `DataEntityClassDto`, applied only when `DATA_ENTITY` is in scope. Collapsing into a single flat 9-value `asset_types` enum is the wrong contract — it forces the backend to re-map 7 of 9 values back to `DATA_ENTITY` before routing the semi-join. So: **"Data Entity / Term / Query Example" is the right *backend* discriminator but the wrong *user-facing* top level** — flatten the UI, keep the discriminator.

## PO lens — enrichment (requirements the 8 notes miss)

1. **Shared-foundation discipline (architectural MUST).** S3 is PLT-249; PLT-250 (Recently-Viewed) depends on it (PRD §5, Decision #3). Every fix here MUST land in **shared** components — panel, facet sidebar, row renderer, star-status hydration, list endpoint shape — or PLT-250 re-opens all eight gaps. This is the highest-leverage enrichment.
2. **Global icon semantics (MUST).** Note #1 only says "change Popular's icon." The real requirement is a coherent icon system: **Star ⇒ Favorite everywhere**, Popular ⇒ trending/▲, Recently-Viewed ⇒ clock/history. Resolve the collision once, platform-wide.
3. **Empty / loading / error states (MUST).** PRD §5.5 specified empty states ("Star an asset to pin it here", "Assets you open will appear here") and **render-when-empty** to *teach the star*. A PO demands explicit panel + tab empty states, a loading skeleton, and an error+retry state — none are in the eight notes.
4. **Star-status batch hydration is the mechanism behind #6/#8 (MUST).** Stars only render correctly on Query-Examples/Terms/search rows if each list batch-resolves favorite status. Prefer a **client-side favorite-id set** (favorites are low-cardinality, curated → fetch once on load, hydrate stars client-side) over a per-list `POST /api/favorites/status` round-trip; ship one, not both.
5. **A11y on the new surfaces (MUST).** PRD §9 set the bar (`aria-pressed`, filled-vs-outline not colour-alone). Extend it: the new list-row stars and the checkbox→autocomplete facet swap must stay keyboard-reachable with state-reflecting `aria-label`; verify focus is retained on optimistic toggle.
6. **DISABLED shared-bucket UX (SHOULD — verify S3).** PRD §6.3 / Decision #2 require non-possessive labelling ("Favorites", never "My Favorites") and a "(shared)" treatment. The eight notes don't mention whether S3 handles DISABLED at all — verify the panel/tab render and label correctly with no principal.
7. **Star reach beyond the three list surfaces (COULD).** Consistency argues for a star anywhere an asset is listed — lineage graph nodes, DEG member lists, Directory rows, Recommended tiles. MVP = the three primary list surfaces (#6/#8 + search); lineage/DEG/Directory is a COULD.
8. **Sort control (COULD).** OpenMetadata offers Last Updated / Weekly Usage / Relevance. Favorites' `favorited_at DESC` default is fine for MVP; an explicit sort (favorited-date / name / recently-updated) is a COULD.

## SRE lens (operational / performance / reliability of the *enriched* scope)

- **Order-then-semi-join vs heterogeneous facets (the #1 flag).** PRD §7.2 orders+paginates on the favorite row's indexed timestamp, then semi-joins the page onto each kind's list query. Adding tag/namespace/owner facets **breaks the clean LIMIT-first plan when a facet excludes a kind** (Query Examples carry no namespace/datasource; Terms carry namespace but no datasource — PRD §5.3). For *stable* pagination you must apply the facet predicate **before** the LIMIT, which means per-kind filtered sub-queries merged under a global `ORDER BY ts DESC` — the 4-way pattern §7.2 wanted to avoid. **Tractable because a curated favorites set is low-cardinality per user** (filter-then-merge over a bounded set is cheap). Recently-Viewed (capped by housekeeping at N/user) is the larger set — size the index/cap there.
- **Full-text over the polymorphic union is non-uniform (#7).** ODD FTS is a Postgres `tsvector`/GIN index over the data-entity + term corpus (`search.md:59-61`, `FTSConstants.java`). **Query Examples have no FTS vector.** "Search my favorites" must either silently drop Query Examples from text matches or fall back to `ILIKE` on name/definition for that kind. Implement as: fetch the bounded favorite-id set → run FTS with `WHERE id IN (...)` for DE+Term (GIN-index-driven) + `ILIKE` fallback for Query Examples. Cost is bounded by the per-user set — acceptable.
- **Pagination + size-cap interplay.** S3's `size` cap (100) is correct (PRD §6.4 — `SizeParam` has no `maximum`). The interplay risk is facet-aware counting: over-fetch+post-filter returns short/unstable pages. Count and page **after** facet filtering.
- **Batch-hydrate cost across every list surface (#6/#8 + enrichment 4).** Stars on N list surfaces × every render × pagination = many small lookups. The `(oidc_username, provider, asset_kind, asset_id)` unique index makes an `IN`-list status query cheap, but the **client-side favorite-id set** avoids the round-trips entirely (low cardinality). Recommend the client-set approach; it also keeps optimistic-toggle state consistent across surfaces via one Redux source of truth.
- **DISABLED open-posture parallel (reliability/honesty, not new leak).** `GET /api/dataentities/popular` "remains reachable under DISABLED for any caller on the network" (`catalog-overview.md:45`). `/api/favorites/list` under DISABLED is the **same documented posture** — not a new hole (PRD §6.1/§6.3). Note the write endpoints (`PUT`/`DELETE`/`POST /favorites`) are *also* open under DISABLED (any network caller mutates the shared bucket) — consistent with the catalog's DISABLED posture; carry the LSN-001/002 "don't run DISABLED in production" admonition.

## Competitor comparison

| System | Equivalent surface | Notable behaviour (verified this pass) | URL · status |
|---|---|---|---|
| OpenMetadata | Explore page | Left quick-filter sidebar (**Owner, Tag, Tier, Service, Service Type**) + a **"Data Asset Type"** filter that lists Table/Topic/Dashboard/Pipeline/ML Model/Container/**Glossary/Tag at one level**; FTS "front and center"; **sort by Last Updated / Weekly Usage / Relevance**; a **Clear** button | docs.open-metadata.org/v1.12.x/how-to-guides/data-discovery/discover · 200 |
| DataHub | Search + filters (+ Views) | Full-text across names/descriptions/tags/terms/owners/columns; **left faceted sidebar** (Data Platform, Tags, Glossary Terms, Domain, Owners); advanced filter incl. **Entity Type + Subtype** (flattened); "**Views**" (saved filters) exist | docs.datahub.com/docs/how/search · 200 |

Both confirm the maintainer's instincts: a **faceted sidebar** (not a checkbox group, #2), a **flattened entity-type filter that sits beside Glossary at one level** (#3), and **full-text on the list surface** (#7). Neither was fetched for a *personal favorites list* specifically — they anchor the *list/explore* pattern, which Favorites' tab reuses.

## Prioritized requirements set (for the additional slice → PRD + issue comment)

**Group A — frontend-only (no backend contract change):**
- **MUST** A1 — Replace the fixed "Asset type" checkbox with the platform `MultipleFilterItem` autocomplete facet + "Clear All" (#2).
- **MUST** A2 — Reuse the My-Objects shared column component for the main-page panel; render it in its own **always-on band outside** the owner-gated Recommended grid (#1a).
- **MUST** A3 — Reserve Star = Favorite globally; re-icon Popular (non-star) and Recently-Viewed (clock) (#1b, enrichment 2).
- **MUST** A4 — `<FavoriteStar>` on Query-Examples **and** Terms list rows, hydrated from a client-side favorite-id set (#6, #8, enrichment 4).
- **MUST** A5 — Reuse the existing Search/Directory result-row renderer on the Favorites tab (info-dense, per-kind graceful) (#4 FE half).
- **MUST** A6 — Empty / loading / error states on panel + tab; render-when-empty to teach the star (enrichment 3).
- **MUST** A7 — A11y parity on new stars + autocomplete facets (enrichment 5).
- **SHOULD** A8 — Verify + fix DISABLED non-possessive "(shared)" labelling (enrichment 6).

**Group B — needs backend-contract change (OpenAPI + semi-join):**
- **MUST** B1 — Add `namespace_ids / datasource_ids / tag_ids / owner_ids` to `GET /api/favorites/list` + the read path, with the exclude-a-kind-that-lacks-the-facet rule (#5).
- **MUST** B2 — Add `entity_class_ids[]` (reuse `DataEntityClassDto`) refining the `DATA_ENTITY` semi-join; keep the 3-way `AssetKind` discriminator; flatten the UI taxonomy on top (#3).
- **MUST** B3 — Enrich the `AssetRef` payload (namespace, asset type, created datetime, truncated description) resolved live via semi-join — no denormalization (#4 backend half).
- **SHOULD/MUST** B4 — Full-text box scoped to the user's favorites: GIN-`tsvector` for DE+Term, `ILIKE` fallback for Query Examples (#7).
- **MUST (verify)** B5 — Ensure batch `POST /api/favorites/status` exists if the client-set approach (A4) is not taken; otherwise N/A.

**Group C — cross-cutting / coherence:**
- **MUST** C1 — All A/B work lands in **shared** components/endpoint so PLT-250 (Recently-Viewed) inherits it (enrichment 1).
- **COULD** C2 — Sort control (favorited-date / name / recently-updated) (enrichment 8).
- **COULD** C3 — Extend stars to lineage nodes / DEG members / Directory rows (enrichment 7).

## Recommended framing for the caller

*S3 shipped a walking-skeleton Favorites slice; closing #1815 needs one more slice that (1) brings the Favorites tab up to the platform's own catalog-search bar — autocomplete facets, a flattened by-class Asset-type filter, info-dense rows, and full-text — and (2) builds all of it in the **shared foundation** so Recently-Viewed inherits it for free. Seven of the eight notes are valid as-is; #1 reshapes to "reuse the My-Objects column component in an ungated band," and #3 resolves to "flatten the UI by entity class while keeping the 3-way `AssetKind` as the backend discriminator + an `entity_class_ids` refinement."* The PRD already specified most of this (§5.3, §5.6) — frame the slice as **completing PRD-0001 §5, not expanding it.**

## Caveats and uncertainty

- **DISABLED handling in S3 unverified.** The caller's S3 inventory doesn't state whether the panel/tab render under DISABLED or how they're labelled — A8 is "verify then fix," not "known broken."
- **`POST /api/favorites/status` presence unverified.** PRD §9 lists it in Issue-A scope; whether S3 shipped it is unconfirmed (B5 is conditional).
- **Competitor anchors are for the explore/list pattern, not a personal-favorites list.** OM/DataHub were fetched for facet-sidebar / flattened-type / FTS norms; neither page documents a *personal favorites* list specifically (consistent with the 2026-06-26 note's finding that DataHub has no OSS favorites and OM's star = follow). Confidence on the *pattern* claims is HIGH; on "this is exactly how competitors do *favorites*" it is not claimed.
- **Existing rich row-renderer reuse (A5) assumes** the Search result-row component is cleanly reusable outside the search Redux slice; if it is tightly coupled, A5 gains a small refactor cost — flag at implementation, not a blocker.

## Citations

**Live (fetched 2026-06-27):**
- docs.open-metadata.org/v1.12.x/how-to-guides/data-discovery/discover — **200**. Left quick-filter sidebar "Owner, Tag, Tier, Service, Service Type"; "Data Asset Type (Table, Topic, Dashboard, Pipeline, ML Model, Container, Glossary, Tag)"; search "front and center"; sort "Last Updated, Weekly Usage, Relevance"; "Clear" button.
- docs.datahub.com/docs/how/search — **200**. Full-text across "names, descriptions, tags, terms, owners, and column names"; left faceted sidebar "Data Platform … Tags, Glossary Terms, Domain, Owners"; advanced filter "Column Name, Container, Domain, … Entity Type, Subtype …"; "Views" feature exists.

**Workspace (repo-relative):**
- `odd-platform-ui/src/components/Search/Filters/Filters.tsx:36-73` — the platform facet pattern: `SingleFilterItem` (datasource, namespace) + `MultipleFilterItem` autocomplete (types, owners, tags, groups, statuses) + "Clear All"; the "Type" facet is class-conditional (`searchClass > 0`).
- `documentation/docs/data-discovery/catalog-overview.md:41-62` — Recommended = 4 columns rendered by one shared list component, up to five entries, no per-column sort/filter; `:45` — Recommended hidden under DISABLED, `GET /api/dataentities/popular` reachable to any network caller under DISABLED.
- `documentation/docs/data-discovery/search.md:19-49` — 7 facets; result-class tab strip (9 tabs); "Type" facet class-conditional ("type values are only meaningful within a class"); `:51-57` per-result info density; `:108-110` search also on Query examples / Master Data / Dictionary tabs.
- `prds/0001-favorites-and-recently-viewed.md` — §5.2 (Decision #4 → `LOOKUP_TABLE` folds into `DATA_ENTITY`), §5.3 (the 4 deferred facets + exclude-a-kind rule), §5.4 (no title denormalization), §5.5 (panel band + empty states), §5.6 (facet sidebar reuses `Search/Filters/*`), §5.7/§11 (Decision #1 — "Asset" logged), §6.1/§6.3 (no read RBAC; DISABLED honesty), §7.1-§7.6 (write/read path, retention), §9 (Issue A scope incl. star on rows + `POST /api/favorites/status`).
- `lineage/odd-platform/sme-consultations/2026-06-26-favorites-recently-viewed-prd.md` — prior design-time consultation (OM star=follow; Amundsen landing panel; DataHub Subscribe≠favorite; Asset-vocabulary + read-collaborative-posture flags).
- `lineage/odd-platform/system-mission.md:80-81` (entity-class labels), P-02 (Query Example), P-03 (Lookup Table = `DATA_ENTITY` `LOOKUP_TABLE`), P-06 (Term), :267 (read-collaborative posture).
