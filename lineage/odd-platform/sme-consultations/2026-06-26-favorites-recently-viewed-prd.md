---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-26T00:00:00Z
consulted_by: maintainer-direct
consultation_question: For the 1.0.0 Favorites + Recently-Viewed PRD — what are the competitor/industry UX patterns, the right Asset-Type facet design over ODD's polymorphic union, the main-page placement & empty states across the three auth/owner scenarios, the star interaction, recently-viewed semantics, the anti-duplication argument vs existing ODD concepts, and the DISABLED/global-mode framing?
slug: favorites-recently-viewed-prd
confidence_overall: MEDIUM
prompt_version: odd-sme/0.1.0
---

# Favorites + Recently-Viewed: UX patterns, facet design, placement, anti-duplication, and global-mode framing

## TL;DR

Both features are **HIGH-plausibility, well-precedented navigation aids** that fill a cell no existing ODD concept occupies — *personal, non-ownership, navigation-only*. The star-on-asset-header pattern is verified in OpenMetadata ("the star icon … on the top right of the data asset details page"); the home-page "your stuff first" panel pattern is verified in Amundsen ("Landing Page … search bars; popular used tables"). Two ODD-specific constraints are load-bearing: (1) ODD's published vocabulary does **not** define the word **"Asset"** — introducing an "Asset Type" facet imports a non-ODD umbrella term and collides with the *existing* live "Type" facet, so it must be defined+logged as an alias or renamed; (2) ODD **already records a "view"** as the `getDataEntityDetails` → `view_count` UPDATE, so Recently-Viewed should reuse that exact "view" definition and must not compound the existing write-on-read hotspot. Recommended panel order on Overview: **Search → Favorites → Recently Viewed → Recommended/My-Objects block → catalog-wide browse**, with both panels rendering even when empty (slim one-line empty state) for discoverability. The weakest cell is **Recently-Viewed under DISABLED**: a shared "recently viewed by everyone" is conceptually muddy and must be labelled non-possessively.

## Question scope

Archetype: **mixed** (plausibility + vocabulary + implicit-requirements + comparative + workflow). The maintainer asked seven questions feeding two GitHub issues (Favorites, Recently-Viewed) for odd-platform 1.0.0. Codebase facts supplied by the caller (identity = `(oidc_username, provider)`; 4 auth modes incl. DISABLED `permitAll`; 4 viewable kinds; `FacetType` covers DataEntity only; `StarIcon` exists) are treated as verified anchors and **not re-derived**. Out of scope: the jOOQ/repository schema, the React component tree, and the exact REST contract. **Could not be verified live** (see Caveats): Atlan / Secoda / Select Star favorites specifics (JS-SPA doc shells, unfetchable via WebFetch), OpenMetadata's landing-page widget names, and any named-competitor "Recently Viewed" *list* — so the Recently-Viewed recommendations lean on ODD's own `view_count` substrate plus flagged domain knowledge, not on a fabricated competitor citation.

## Q1 — Competitor / industry UX patterns (cited)

| System | Favorite/Star equivalent | Home-page personalization | Recently-Viewed | Source (status) |
|---|---|---|---|---|
| **OpenMetadata** | **Star icon, top-right of the asset detail page**; "the star icon displays the number of users following the data asset" — i.e. star = **Follow**, and it doubles as a public **follower count** | not verified this pass | not verified this pass | docs.open-metadata.org/v1.12.x/how-to-guides/data-discovery/details (200) |
| **Amundsen** | Bookmark feature exists but **not** in the verified README | **Landing page = "1. search bars; 2. popular used tables"** + inline "Search Preview" | not in verified README | raw.githubusercontent.com/amundsen-io/amundsen/main/README.md (200) |
| **DataHub** | **No** favorites/star on the OSS Features page; **"Subscribe Me"** (Cloud) is a *notification* subscription, not a favorite — notifies on "deprecations, Assertion status changes, Incident status changes, Schema changes, Ownership changes, Glossary Term changes, and Tag changes" | not on Features page | not mentioned | docs.datahub.com/docs/features (200); .../managed-datahub/subscription-and-notification (200) |

**Patterns ODD should match:** the **star as the favorite affordance living on the asset detail header** (OpenMetadata; and ODD already ships `StarIcon`), and **personal/curated panels at the top of the landing page** (Amundsen puts "popular used tables" on the landing page — ODD already does the analogous thing with Recommended/Popular).

**Pattern ODD should deliberately diverge from:** OpenMetadata fuses **star = follow = public follower count**. ODD's Favorites is **private and silent** (a personal shortcut, no follower count, no notification). DataHub keeps **"Subscribe" (notify-me)** separate from navigation. ODD should keep Favorites as **pure navigation** for 1.0.0 and *not* silently turn it into a follow/subscribe with a public count or alerts — that is a deliberate future extension, not 1.0.0 scope. (Confidence: HIGH on the divergence call — two of the three named systems show the convergence trap explicitly.)

## Q2 — Asset-Type facet over the polymorphic union

**Constraint flagged (load-bearing).** ODD's live manual lists exactly **seven** search facets — "Datasource / Type / Namespace / Owner / Tag / Groups / Statuses" (docs.opendatadiscovery.org/features/data-discovery, 200) — and the existing **"Type"** facet already means *DataEntity entity-class/type* (`FacetType`, caller-verified). The live `main-concepts` page (200) defines ODDRN, Data source, Adapter, Plugin, Collector, Push-adapter, Lookup Tables, and DEG ("Logical grouping of data entities inside the catalog") — but it **does not define the word "Asset"**. So a facet literally named **"Asset Type"** (a) imports an umbrella term ODD has never published and (b) sits confusingly beside the existing "Type" facet that means something narrower.

**Recommended grouping & labels** (multi-select, default = All), using ODD's *real* published nouns as the top level and reusing the existing "Type" labels verbatim for the DataEntity sub-values (anti-duplication / Gate 1):

- **Data Entities** → nested refinement reuses the *existing* "Type" facet's entity-class labels verbatim (Datasets, Transformers, Jobs, Data Quality Tests, ML Experiments/Models, Dashboards, Groups, …; `system-mission.md:80-81`). Do **not** invent new type labels.
- **Glossary Terms** (ODD term: "Term" — `system-mission.md` P-06)
- **Query Examples** (ODD term: "Query Example" — `system-mission.md` P-02)
- **Lookup Tables** (ODD term: "Lookup Table" / reference data — `system-mission.md` P-03)

**Two decisions to make explicit in the PRD:**
1. **The umbrella word.** Either (a) **rename** the facet to avoid "Asset" and the "Type" collision (e.g. a kind-selector whose values are the four nouns above, with entity-class as a nested refinement under "Data Entities"), **or** (b) **adopt "Asset" deliberately** as the union of the four kinds and **log it in `main-concepts.md` Terms & Aliases** (ODD Gate 2 — synonyms/aliases logged). Do *not* ship "Asset" as a silent new top-level concept. *(Recommendation: option (a) for 1.0.0 — extend the meaning of the existing "Type" facet to span the union on these two tabs, rather than add a second, near-synonymous "Asset Type" facet. Confidence: MEDIUM — depends on FE facet plumbing the caller owns.)*
2. **The Lookup-Table wrinkle.** A Lookup Table *is* a DataEntity of type `LOOKUP_TABLE` (`system-mission.md` P-03), yet it has its own UI surface (`ReferenceDataController`). For a non-technical user, surfacing **"Lookup Tables" as its own top-level kind** (matching the Master Data Management surface) reads more clearly than burying it under Data-Entities→Type. Recommend top-level. (Confidence: MEDIUM — domain/UX judgment.)

## Q3 — Main-page placement & empty states

**Recommended order on `Overview` (top → bottom):**

1. **Search** (unchanged primary entry).
2. **Favorites** — first 5 + "View all" (deliberate, highest-intent shortcuts).
3. **Recently Viewed** — first 5 + "View all" (passive recent context).
4. **Recommended / My-Objects block** (`OwnerEntitiesList.tsx`) — unchanged gate: only when Owner-associated **and** auth ≠ DISABLED.
5. **Catalog-wide browse** — Top tags, Domains, per-class Entities report, Directory cards (the existing Catalog-Overview composition: docs.opendatadiscovery.org/features/data-discovery, 200).

Rationale: *personal-and-deliberate* (Favorites) above *personal-and-passive* (Recently Viewed) above *algorithmic/ownership* (Recommended) above *catalog-wide* — "the stuff I chose" before "the stuff suggested for me" before "everything." This honors the caller's hard requirement that the two new panels sit **before** the My-Objects/Recommended block and are **always available** (no Owner, and DISABLED). *(No external citation — domain/UX judgment; Amundsen's "personal/popular panel on the landing page" is the directional precedent. Confidence: HIGH.)*

**Per-scenario:**
- **(a) DISABLED / no user:** both panels render against the **single shared bucket**; Recommended block does not render (already gated off). See Q7 for the labelling caveat.
- **(b) Logged-in, no Owner:** both panels render (keyed on `oidc_username`); Recommended block does **not** render — so Favorites + Recently Viewed are the *only* personalization this large audience gets. This is the strongest single justification for the feature.
- **(c) Logged-in WITH Owner:** full stack 1–5 above.

**Empty states — render even when empty, with a slim one-line state (not a hero):**
- Favorites empty → one line + CTA: *"Star an asset to pin it here for quick access."* Rendering-when-empty **teaches the star affordance** (discoverability cornerstone). Confidence: HIGH.
- Recently Viewed empty → one line: *"Assets you open will appear here."* Honest and self-explaining; avoids a "broken/empty" look on first load. Confidence: MEDIUM (a brand-new user sees two empty panels; keep them compact so Overview isn't dominated by empties).

## Q4 — Star interaction

- **Where it lives: both** list rows **and** the asset detail header. OpenMetadata anchors the star at the **top-right of the detail page** (verified, 200); ODD already uses `StarIcon` in the Popular list. Put a star on every list row (search results, the two new tabs, the 5-row panels) **and** a persistent star in the asset detail header — all toggling the same state. Confidence: HIGH (header placement is competitor-anchored).
- **Optimistic toggle:** flip to gold immediately, fire the call async, roll back + toast on failure. Standard SPA pattern. *(No citation — domain knowledge. Confidence: HIGH.)*
- **Accessibility (real concern, flag it):** an icon-only toggle needs an accessible name that reflects state (`aria-label` "Add to favorites" / "Remove from favorites"), `aria-pressed`, and keyboard focus. **Do not encode favorited state in color alone** — ODD's `StarIcon` signals "favorited" by turning **gold**, which is a WCAG color-only-state issue; use **filled vs. outline** star shape in addition to color so color-blind users can tell. *(No citation — WCAG/domain knowledge. Confidence: HIGH.)*

## Q5 — Recently-Viewed semantics

- **What counts as a "view": reuse ODD's existing definition.** ODD already records a view as the `getDataEntityDetails` call, which performs a `view_count` UPDATE (`concepts.yaml:564`) and is the *producer* feeding the Popular list (`concepts.yaml:3229`). Define a Recently-Viewed "view" as **opening an asset's detail page** — the same event. **Not** hovers, **not** search-result impressions. A search-result *click* counts only because it navigates to the detail page. This gives consistency with the `view_count` semantics already in the system. Confidence: HIGH (ODD-anchored).
- **Dedupe: yes** — repeated opens collapse to **one row, move-to-top, timestamp = most-recent**; otherwise the list fills with duplicates. *(No citation — domain knowledge. Confidence: HIGH.)*
- **Per-row remove vs clear-all:** per-row **remove** (the caller's plan) is correct for MVP; add **"Clear all"** as a cheap fast-follow (log it on disk per the workspace follow-up rule). Confidence: MEDIUM.
- **Privacy expectation (flag it):** a user reasonably expects their **own** view history to be **private to them** — not visible as "who viewed this," not enumerable by other users. This **diverges from OpenMetadata**, whose star exposes a *public* follower count. Implication: the Favorites/Recently-Viewed read endpoints must be **principal-scoped** (`oidc_username + provider`), *not* catalog-wide reads — contrast `getMyObjects`, which is owner-scoped via `user_owner_mapping` (`concepts.yaml:3350`). ODD's read-collaborative posture (every authenticated user can read the catalog — `system-mission.md:267`) must **not** be extended to one user's browsing history. Confidence: HIGH.
- **Performance (flag it):** the `view_count` UPDATE is **already a write-on-read hotspot** — row-locked `O(reads)`, primary-only, no index on `view_count` (`concepts.yaml:564,3262`), and the loop is trivially "pumpable" with no anti-abuse signal (`concepts.yaml:3254`). A naive per-view INSERT into a recently-viewed table **compounds** this. Recommend piggy-backing on / batching with the existing view write (async batch increment, capped per-user ring of N rows). Confidence: HIGH (ODD-anchored).

## Q6 — Concept-overlap / anti-duplication (the critical one)

Favorites and Recently-Viewed occupy a cell **no existing ODD concept fills: *personal, non-ownership, navigation-only*.** Each potential collision resolves cleanly:

- **vs Ownership / "My Objects":** My Objects is **owner-scoped** — it requires a `user_owner_mapping` row turning the principal into an Owner (`concepts.yaml:3350`) and implies *stewardship*. Favorites keys on the **logged-in user without any Owner** (caller-verified) and implies *no* stewardship. A data analyst who owns nothing can favorite the 5 dashboards they use daily. The caller's "works with no Owner" requirement is *exactly* what makes Favorites orthogonal to My Objects. **Distinct.** Confidence: HIGH.
- **vs Alerts / subscriptions:** ODD Alerts (P-07) are platform-detected issues with an OPEN→RESOLVED lifecycle (`concepts.yaml:610`); DataHub "Subscribe Me" is a *notify-me* on changes (verified, 200). Both are **push/notification**. Favorites is **pull/navigation** — no notification. **Distinct axes.** Confidence: HIGH.
- **vs Tags:** Tags are **shared, governed catalog vocabulary** (TAG_* permissions; a search facet visible to everyone — `system-mission.md:93,240`). Favorites is **private, ungoverned, contributes no shared facet**. "Tagging things `my-favorites`" would pollute the shared taxonomy for all users — the anti-pattern Favorites prevents. **Distinct.** Confidence: HIGH.
- **vs Data Entity Groups (DEG):** a DEG is a **shared catalog object** that groups entities, can be a Domain, and **participates in group lineage** (`main-concepts`, 200; `system-mission.md` P-01/P-05). Favorites creates **no catalog object, no lineage, no shared visibility**. You would never spin up a governed, lineage-participating DEG just to bookmark 5 assets. **Distinct.** Confidence: HIGH.
- **vs Popular:** Popular ranks **`view_count DESC` across all owners**, shared and algorithmic, and even serves anonymous callers under DISABLED (`concepts.yaml:3229,3236`). Favorites is **personally chosen**; Recently-Viewed is **your** recent opens (recency-ordered, personal). Popular answers "what does everyone use," Favorites/Recently answer "what do *I* use." Both Recently-Viewed and Popular derive from the same "view" event but differ on **scope (personal vs global)** and **ordering (recency vs frequency)**. **Distinct.** Confidence: HIGH.

**One-line PRD framing:** *every existing ODD concept is either shared (Tags, DEG, Popular) or ownership-bound (My Objects) or notification-shaped (Alerts/subscribe); Favorites and Recently-Viewed are the first purely-personal, ownership-free, navigation-only surfaces — which is precisely why they must key on the logged-in user, not the Owner.*

## Q7 — DISABLED / global-mode framing

Under DISABLED there is no principal (`anyExchange().permitAll()`, caller-verified) → a **single shared bucket**. Showing a personal-possessive UI ("My Favorites", "My Recently Viewed") would **mislead**: one person's stars and history are visible to and editable by everyone on that deployment.

- **Security:** sharing the bucket leaks nothing new — the catalog is already fully readable in DISABLED, and Popular already serves the global `view_count` to anonymous callers (`concepts.yaml:3229`). The issue is **product honesty, not disclosure.**
- **Favorites in DISABLED:** keep it, but label it **non-possessively and as shared** — e.g. "Favorites" (never "My Favorites") with a one-line subtext that the list is shared in this deployment. A shared shortcut shelf is still useful for a small team on an unsecured instance.
- **Recently-Viewed in DISABLED (weakest cell):** "recently viewed *by everyone*" is conceptually muddy and overlaps a global activity feed. Since the caller requires it always-available, **keep it but label it "Recently Viewed (shared)"** with subtext clarifying the shared nature. Do **not** present it as personal history. Confidence: MEDIUM (product-judgment; the honest-labelling principle is HIGH-confidence, the keep-vs-suppress call is the maintainer's).

## Operator workflows this serves

- **Re-find a known asset / daily re-navigation (new named workflow):** a data engineer/analyst who works the same 5–10 assets every day and wants to jump straight to them without re-searching. Trigger: start-of-day / context switch. Outcome: one-click via Favorites (deliberate) + passive re-entry via Recently Viewed. Distinct from the existing *Discover a dataset* workflow (finding something new).
- **Find the owner of a problematic entity** and **Diagnose a stale dashboard** (Rule-4 seed workflows): both start by *returning* to an asset you saw before — Recently-Viewed shortens the "where was that table again?" step.

## Caveats and uncertainty

- **Atlan, Secoda, Select Star not verified.** Their docs render as **JS navigation shells** via WebFetch (docs.atlan.com root = shell; docs.secoda.co root = shell; docs.selectstar.com = intro only) — I did **not** substitute pretrained recollection of their favorites/recently-viewed UX. If the maintainer wants those specifics, it needs a browser/authenticated fetch, not WebFetch.
- **OpenMetadata landing widgets ("My Data / Following / Recently Viewed") not verified** — I located the Follow/star (detail page) but could not confirm the landing-page widget names within budget; not asserted.
- **No named-competitor "Recently Viewed" *list* citation secured.** None of the three verified systems documents a recently-viewed list on the pages I reached. The Recently-Viewed recommendations therefore rest on **ODD's own `view_count` substrate** + flagged domain knowledge, not a competitor citation. This is the main reason `confidence_overall` is MEDIUM rather than HIGH.
- **Amundsen bookmark feature** is real but absent from the verified README; only "popular used tables on the landing page" is cited.
- **DataHub** does have home-page personalization / recently-viewed in some builds, but it is **not** on the verified Features page; treated as "not verified," not "absent."

## Citations

**Live (fetched 2026-06-26):**
- docs.opendatadiscovery.org/features/data-discovery — **200**. Catalog Overview = "Search, the Directory's level-1 cards, Top tags, Domains, the per-class Entities report, the Recommended quick-jumps, and (when authentication is on) the Owner-association request"; facets "Datasource / Type / Namespace / Owner / Tag / Groups / Statuses"; **no** favorites/recently-viewed/popular mention.
- docs.opendatadiscovery.org/introduction/main-concepts — **200**. Defines ODDRN, Data source, Adapter, Plugin, Collector, Push-adapter, Lookup Tables, DEG ("Logical grouping of data entities inside the catalog"); **does not define "Asset"**, Data Entity, Term, Tag, Owner, Namespace, Query Example.
- docs.open-metadata.org/v1.12.x/how-to-guides/data-discovery/details — **200**. "The star icon displays the number of users following the data asset"; "On the top right of the data asset details page."
- docs.open-metadata.org/v1.12.x/how-to-guides/data-discovery — **200**. Discovery index; child slugs (discover / preview / details / advanced).
- raw.githubusercontent.com/amundsen-io/amundsen/main/README.md — **200**. "Landing Page … includes 1. search bars; 2. popular used tables"; "Search Preview."
- docs.datahub.com/docs/features — **200**. No favorites/star/recently-viewed/subscribe on the Features page.
- docs.datahub.com/docs/managed-datahub/subscription-and-notification — **200**. "Subscribe Me" dropdown on asset pages; notifies on "deprecations, Assertion status changes, Incident status changes, Schema changes, Ownership changes, Glossary Term changes, and Tag changes"; not framed as follow/favorite.
- **Failed/blocked fetches (recorded, not paraphrased):** datahubproject.io/docs/features → 301 → datahub.com → 301 → docs.datahub.com (chain followed); www.amundsen.io/amundsen/ → TLS "unable to get local issuer certificate"; docs.atlan.com/ → JS shell; docs.secoda.co/ → JS shell; docs.selectstar.com/ → intro only; docs.open-metadata.org/llms.txt → API-only index; several OM `/latest/...` slugs → 404 (correct version is v1.12.x).

**Workspace:**
- `lineage/odd-platform/system-mission.md` — :80-81 (entity-class examples), :93/:240 (Tags), P-01 (DEG/Domain), P-02 (Query Example), P-03 (Lookup Table = DataEntity `LOOKUP_TABLE`), P-06 (Term), :267 (read-collaborative posture), P-09 (4 auth modes incl. DISABLED).
- `lineage/odd-platform/concepts.yaml` — :30 (getMyObjects), :31/:543/:3229/:3236 (Popular = `view_count DESC` consumer, all owners, anonymous under DISABLED), :564 (view_count UPDATE = the "view" event; producer), :3254 (no anti-abuse/rate-limit on the view loop), :3262 (no index on view_count), :3350 (`user_owner_mapping` gates My-Objects owner scoping).
- `CLAUDE.md` — Gate 1 (no duplicates) / Gate 2 (aliases logged) / discoverability cornerstone; follow-up-on-disk rule.
- Caller-verified anchors (not re-derived): identity `(oidc_username, provider)`; DISABLED `permitAll`; 4 viewable kinds; `FacetType` = DataEntity only; `StarIcon` exists.
