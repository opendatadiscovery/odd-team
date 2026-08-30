---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-08-31T09:10:00Z
consulted_by: maintainer-direct (/contribute CTRIB-062, odd-platform #1842, ST-8 of #1825)
consultation_question: "For the unified cross-kind search's 'My data' scope filter — what should it be called, what should it mean across kinds, which lineage direction serves impact analysis, what depth ceiling is defensible, how must truncation be surfaced, what is the posture when it cannot personalise, and where does the result count live once the tab strip is retired?"
slug: my-data-scope-filter
confidence_overall: MEDIUM
prompt_version: odd-sme/0.1.0
note: filename date is the caller-specified path; the session crossed the date boundary.
---

# "My data" scope filter on the unified asset search — PO / governance read

## TL;DR

Four of the seven answers are settled by **ODD's own published documentation**, not by competitor precedent: impact = **downstream** (`alerting.md` calls the Dependents tab the "Impact view"); the `auth.type=DISABLED` posture is already published as **hide the surface** (`catalog-overview.md`); "Upstream dependents" is a **genuine misnomer** and two live doc pages contradict each other on it; and the current cross-kind pass-through (terms + query examples unfiltered under "My Objects") is a **correctness defect already shipped in the ST-4 path**, not a scoping choice ST-8 gets to make. On naming and control shape the market evidence I could verify is thinner than expected: DataHub and Atlan ship **owner as a filter dimension** plus a **saved-view** mechanism, not a dedicated "owned by me" toggle. Depth: DataHub's Impact Analysis defaults to **1 degree "to minimize processor-intensive queries"** and hard-caps at 10,000 records with a documented remedy — that is the pattern to copy.

## Question scope

Archetypes: **mixed** — vocabulary (Q1, Q3), plausibility + implicit-requirements (Q2, Q5, Q6), comparative (Q1, Q4, Q7), workflow (Q3).
Out of scope: the index/query implementation, the perf gate's numeric thresholds, and whether QEs should *gain* an ownership model (a spec-level question for a separate consult).
Budget note: 9 live fetches (over the usual ≤6) because the question carries 7 sub-questions; two returned nothing usable and are recorded as such.

---

## Q1 — Naming and control shape

**Verified market vocabulary.** DataHub: a **View** "lets you save a set of filters and reuse them", filtering by "entity types, platforms, domains, tags, **owners**, etc.", with **one active View at a time** via a "View selector in the search bar". Atlan: "Filter by source, certification, **owner**, tags, and more—save and share filtered views." Neither verified page names a first-class "owned by me" scope — the industry primitive I can actually cite is **owner-as-a-filter-value** plus a saved-view container. Secoda's search page names four sorts and resource-type filters; no owner filter documented.

**ODD's published vocabulary is "My Objects" on three separate surfaces** — the search tab (`data-discovery/search.md:40`), the Alerts tab (`alerting.md:54,61`), and the Recommended column (`catalog-overview.md:49`) — and ODD's own docs already flag the collision: "This surface is **distinct from the Alerts → My Objects tab**, which is a different feature with the same name."

**Recommendation — group heading "My data"; options `Owned by me` · `Upstream of my data` · `Downstream of my data`.** "My Objects" fails the no-tooltip test twice: it does not say *owned* (a user reasonably reads it as "things I touched"), and "objects" is a noun ODD uses nowhere else for assets. The group heading must cover all three scopes, and the neighbour scopes are explicitly *not* mine — so the ADR's "My data" is right as a **heading** and wrong as a synonym for the owned set. Cost, stated plainly: this makes a **fourth** published name for the concept unless the same release train updates `search.md`, `catalog-overview.md`, and `alerting.md`. If the maintainer wants zero doc churn, the cheap fallback is keeping `My Objects` as the option label — but then log the reconciliation as a DOC-NNN rather than leaving four names standing.

**Control shape — multi-select checkbox group, OR within the group, no "All" option.** The decomposition's enumeration "(All · My Objects · Upstream · Downstream)" mixes a *reset state* with three *additive scopes*; shipping "All" as a fourth checkbox creates the classic contradictory selection (All + Upstream both ticked). Zero boxes ticked **is** All. The scopes are unioned because the incident-response use is "my stuff and everything one hop around it" in one list; single-select forces three searches and three mental merges. This matches the ST-8 slice text ("the My-data **multi-select**") and corrects the option list.

**"Upstream/Downstream of my objects" as a search filter is, on the evidence I can verify, unique to ODD.** DataHub ships the equivalent capability as a *separate surface* (Lineage Impact Analysis, anchored on **one** asset), not as a scope filter on catalog search anchored on your **owned set**. That is a genuine differentiator worth stating in the release notes — and a reason to be conservative on defaults (Q4).

## Q2 — Cross-kind semantics (the real question)

**Verdict: (a)-with-a-visible-exclusion — ownership evaluated per kind by that kind's own ownership relation; kinds with no ownership model are excluded from the result while the scope is active, and the exclusion is shown, not silent.**

- Data entity → `ownership`. Term → `term_ownership` (terms are first-class owned entities in ODD's model: the Glossary pillar's actions include "assign owner / namespace", `system-mission.md:185`). Query example → **no ownership model exists** → excluded.
- **Reject (b).** "QEs linked to entities I own" is a *different predicate* (`related to my data`) wearing the ownership filter's label. It manufactures false ownership claims in a governance surface, makes the filter's meaning kind-dependent and unexplainable in one line, and is exactly the class of drift that produced "Upstream dependents" (Q3).
- **The current behaviour is a defect, not an option.** "My Objects" today returns my data entities **plus every term plus every query example in the catalog** — the filter *widens* the result for two of three kinds while its label promises narrowing. Under `asset_type = all kinds` an operator would read a screen full of other people's terms as "things I own". Treat closing this as an ST-8 **launch blocker** and, since the pass-through already exists on the ST-4 unified path, note it as shipped-defect scope in the CTRIB record.
- **Implicit requirement:** when `Owned by me` is active, the Asset-type facet must show Query Example with a **0 count and a reason** ("query examples have no owner"), not a silently absent row. A zero the user can't explain is the same failure class as the silent empty (Q6).

## Q3 — Semantic direction of Upstream / Downstream

**"Upstream dependents" is a misnomer, and ODD's live docs contradict each other about it.** A *dependent* is a thing that depends on you — i.e. downstream. `catalog-overview` (live) gets it right: "**Upstream Dependencies** — data entities that serve as direct origins to those the user owns." `data-lineage` (live) states the correct semantics in its table ("entities that the user's owned entities **depend on**") and then asserts the opposite two lines later: "The UI labels the surfaces accurately as *'Upstream dependents'* / *'Downstream dependents'* — the dependents on the user's stuff, not the user's stuff." **That sentence is wrong for the upstream direction and must be corrected on the same train as ST-8.** Counting the API (`/my/upstream`), that is three published label sets for one concept.

**Recommendation: drop the dependency noun entirely — `Upstream of my data` / `Downstream of my data`.** Direction word + anchor, no dependent/dependency ambiguity, and it states the anchor (which matters because the sets *exclude* the anchor).

**Impact analysis maps to DOWNSTREAM,** and ODD has already published this framing: the Alerts **Dependents** tab is "alerts raised on data entities that are **downstream** of entities the signed-in user owns … **Impact view** — 'what's breaking in systems that consume my data'". DataHub's Impact Analysis lets users "toggle between **Upstream** and **Downstream** dependencies", so both directions are legitimate; the blast-radius workflow (Rule 4: *trace blast radius before a schema change*) is downstream, and upstream serves the complementary root-cause workflow (*diagnose a stale dashboard* — walk toward the silent producer). Both ship; only downstream should be described as "impact" in copy.

## Q4 — Depth defaults and the ceiling

**Cited anchor:** DataHub's Lineage Impact Analysis exposes "**Degree of Dependencies**" as the control, defaults to "**1 Degree of Dependency to minimize processor-intensive queries**", and hard-limits the dependency list to **10,000 records** with "we suggest applying filters to narrow the result set if you hit that limit."

**Recommendation: a 3-value select (1 / 2 / 3) per direction, default 1, hard ceiling 3, no free-text integer, no config key.** Reasoning (domain judgment, uncited): a search *filter* is a narrowing device with a per-keystroke cost budget; a lineage *graph view* is an exploration device the user has consciously entered and waits for. They cannot share a depth ceiling. Three ODD-specific facts push the ceiling down rather than up: (i) the traversal CTE has **no visited-set guard**, so cost grows with *path count*, not node count — fan-out `f` at depth `d` is `O(f^d)` rows **per root**; (ii) the anchor set is the caller's **entire** owned set, unpaginated (published caveat: an admin/CI-bot owner of thousands of entities triggers the heavy query on every call); (iii) cost therefore scales as `|owned| × f^d` — depth 3 with a modest fan-out is already a four-order-of-magnitude jump over the default. **The node/row cap, not the depth number, is the real guard** — and it must count **rows traversed**, not distinct nodes, or a cyclic graph will inflate work before the cap fires. A fixed ceiling of 3 needs no config key (subtract before you add) and can be raised later on measured evidence from the ST-8 perf gate.

## Q5 — Truncation UX

**What is citable:** DataHub documents the cap and the remedy in prose ("we currently limit … we suggest applying filters to narrow the result set"). The page does not describe a UI treatment, so the specific control below is **domain judgment, no citation**.

**Recommendation — five requirements, all load-bearing because impact analysis is the use case:**

1. **The truncation is a server fact, never an FE inference.** The response carries `truncated: true` + `truncation_reason` (`node_cap` | `depth_cap` | `timeout`) + what was reached (`traversed_nodes`, `depth_reached`). The FE must never compare counts to guess.
2. **Qualify the count, don't print a total.** A truncated set renders `1–20 of 1,240+ (partial)`, never `1,240`. A truncated total presented as a total is a **false governance claim** — the operator concludes "17 downstream consumers, I've told them all" and ships the schema change.
3. **A persistent inline strip above the results**, not a toast. The warning must live as long as the claim is on screen; a toast that has faded leaves a partial impact set looking complete.
4. **Attribute the truncation to the scope that caused it** — a marker on the `Downstream of my data` chip, so the user knows which filter to relax.
5. **Copy names cause and remedy in one line**, DataHub's pattern: *"Stopped after N,NNN related assets — reduce depth or add filters to see a complete set."* Add the escape hatch: *"for a complete blast radius, open the entity's Lineage view."*

Sixth, non-obvious: truncation must be **deterministic for a given spec**, because the search state is a shareable URL (ADR D10) — a recipient re-running the same link must see the same truncation state, or two people hold different impact sets from the same URL.

This is the LSN-001 / LSN-002 class (silent degradation under a default) applied to a read surface, and ODD has already documented the same class one layer down: the my-objects triplet's "empty response … is **indistinguishable across four root causes**".

## Q6 — The empty / disabled posture

**ODD has already published its answer for the twin surface, and it is "hide":** on the Catalog Overview, "On auth-disabled deployments (`auth.type=DISABLED`) the panel is **hidden from the home page entirely** — there is no user-owner identity to filter on, so the entire surface is removed rather than rendered with unfiltered data."

**Recommendation — two distinct states, two treatments; never silent-empty:**

| Condition | Treatment | Why |
|---|---|---|
| `auth.type=DISABLED` (no principal, instance-wide) | **Hide the whole "My data" group.** | Matches ODD's published posture on the same personalisation. Nobody on this deployment can ever use it; a permanently-disabled control is clutter with no remedy. |
| Signed in, **no Owner binding** | **Render, disabled, with a one-line reason + a link to the owner-association request.** | The capability exists and the user has a remedy — ODD already ships that remedy as the conditional "Owner association" section on the home page. Hiding hides the fix. |
| Signed in, bound, owns nothing | **Enabled; empty result with "You don't own any assets yet."** | Distinguishes "you own nothing" from "you aren't bound" — the exact confusion IT-056 pins. |

The current silent-empty is workspace-pinned as a defect class (`IT-056`: "My objects returns `[]` … byte-identical to 'nothing happened'"; the RED flips the moment a diagnostic affordance ships). ST-8 is the natural place to stop reproducing it on a new surface. **Best practice for a personalised filter that cannot personalise, stated as a rule:** a control may be hidden only when *no user of this deployment* can ever use it; if the blocker is per-user, it must be visible, disabled, and must name the remedy.

## Q7 — Where the result count lives after the tab strip goes

**No usable external citation.** The DataHub, Secoda, and Atlan pages fetched this session say nothing about result-count placement (recorded verbatim below). Treating that as "the industry does X" would be a Rule 1 violation — so this recommendation is product judgment plus ODD-internal precedent.

**Recommendation: a results-header band above the list — `N results` on the left, the ST-2 sort dropdown on the right — and per-option counts on the filter facets.** Rationale: (i) ST-2 already introduces a global sort control that needs a home; one band serves both and avoids inventing two chrome elements; (ii) ODD's existing count semantics are *count-per-scope* (the tab counts "update with the active query and facet selection"; alerts count "toward the All / My / Dependents badges") — when the tab strip retires, those per-scope counts should migrate to the **filter options** they describe (`Owned by me (23)`), which is where a faceted UI puts them, and the *total* migrates to the header; (iii) the server already computes `myObjectsCount` on every search call, so the per-option count is free — and the ADR's existing perf note about that unconditional aggregation should be re-read at ST-8 rather than left as-is.

Three ACs worth writing explicitly: the header count is the **total matched**, not the page size; it must be **qualified when truncated** (Q5); and it must be present on the empty state ("0 results") — a bare empty list with no count reads as a loading failure.

## Documentation contradictions to fix on this train (flagged per the brief)

1. `data-lineage.md` — "The UI labels the surfaces accurately as *'Upstream dependents'* … the dependents on the user's stuff" **contradicts the endpoint table three lines above it and the code**. Correct the sentence.
2. Three published label sets for one concept — `Upstream Dependencies` (catalog-overview) / `Upstream dependents` (data-lineage) / `/my/upstream` (API). Converge.
3. `search.md` documents the nine-tab strip incl. `My Objects` — already stale after ST-4 retired the class tabs, and fully stale when ST-8 retires the My-Objects tab. It must be rewritten in the ST-8 train, not after.
4. `data-lineage.md` also records the **OpenAPI summary** for `getMyObjectsWithUpstream` / `…Downstream` as describing the wrong shape — if ST-8 touches those operations, fix the spec text in the same PR.

## Recommended framing for the caller

*"'My data' is a scope group of three additive, unioned checkboxes — `Owned by me`, `Upstream of my data`, `Downstream of my data` — where ownership is evaluated per kind by that kind's own ownership relation (data entities and terms; query examples are excluded with a visible reason), lineage neighbours are bounded at depth 1 by default and 3 at most, any truncation is a server-declared, persistently-displayed, count-qualifying state, and the group hides entirely under `auth.type=DISABLED` but renders disabled-with-a-remedy for a signed-in user who has no Owner binding."*

## Caveats and uncertainty

- **Q1 naming (confidence: LOW on the market side).** No verified page shows a governance tool shipping a dedicated "owned by me" scope toggle; the verified pattern is owner-as-filter-value + saved views. My label recommendation rests on the no-tooltip test and ODD's own vocabulary, not on market precedent. Unblocked by: driving DataHub/Atlan demo instances, or an OpenMetadata "My Data" widget page (my two attempted URLs 404'd / returned nothing).
- **Q4 ceiling of 3 (confidence: MEDIUM).** DataHub's *default* of 1 is cited; the *maximum* of 3 is my judgment from ODD's unguarded CTE and unpaginated anchor set. The ST-8 perf gate should confirm or move it with measurements.
- **Q5 and Q7 UI treatments (confidence: LOW-MEDIUM, uncited).** No fetched page describes truncation UI or count placement. The requirements are derived from the governance-hazard argument and ODD case-law, not from a competitor.
- **Not verified:** whether query examples carry any authorship column that could later become an ownership model; whether Atlan's structured-search page (`/search-and-discover-assets`, referenced but not fetched) documents an owner-scoped filter.
- **Adjacent consult worth booking:** the interaction between "My data" and the Favorites filter (ST-7) — two personalised scopes composing in one sidebar needs one consistent identity/empty story, not two.

## Citations

**Live URLs (fetched 2026-08-31):**

| URL | Status | What it supports |
|---|---|---|
| `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` | 200 | Recommended columns "My Objects / Upstream Dependencies / Downstream Dependencies / Popular"; "Upstream Dependencies — data entities that serve as direct origins to those the user owns"; "there is no per-column 'view more' affordance"; the Alerts-My-Objects name-collision note |
| `https://docs.opendatadiscovery.org/features/data-lineage` | 200 | The my-objects triplet endpoint table; the "UI labels the surfaces accurately as 'Upstream dependents'…" sentence (the contradiction); "An empty response (`HTTP 200` with `[]`) … is indistinguishable across four root causes" |
| `https://docs.datahub.com/docs/act-on-metadata/impact-analysis` | 200 | "Lineage Impact Analysis"; "toggle between **Upstream** and **Downstream** dependencies"; "Degree of Dependencies"; "1 Degree of Dependency to minimize processor-intensive queries"; "We currently limit the list of dependencies to 10,000 records; we suggest applying filters to narrow the result set if you hit that limit" |
| `https://docs.datahub.com/docs/features/feature-guides/views/overview` | 200 | "Views let you save a set of filters and reuse them across DataHub"; filters include "entity types, platforms, domains, tags, owners, etc."; "View selector in the search bar"; one active View at a time (implied by "the active View") |
| `https://docs.atlan.com/product/capabilities/discovery` | 200 | "Filter by source, certification, owner, tags, and more—save and share filtered views for precise, repeatable navigation across your full catalog." Detail page `/search-and-discover-assets` not fetched. |
| `https://docs.secoda.co/features/search` | 200 | Four sorts (Relevance / Popularity / Last modified / Date created); resource-type + tag filters; "Read up on Views for easy access to your common searches". **Explicitly no** owner filter, result-count, or "owned by me" content. |
| `https://docs.datahub.com/docs/how/search` | 200 | **Negative result recorded verbatim:** no content on owned-by-me filtering, cross-entity-type filters, result-count display, or Views. |
| `https://docs.open-metadata.org/latest/how-to-guides/data-discovery/discovery` | **404** | No claim made. |
| `https://docs.open-metadata.org/latest/how-to-guides/data-discovery` | 200 | **Negative result recorded verbatim:** no "My Data" widget, owner filter, or result-count content on this page. |

**Workspace / local-doc sources (read 2026-08-30/31):**

- `documentation/docs/data-discovery/catalog-overview.md:45` — "On auth-disabled deployments (`auth.type=DISABLED`) the panel is **hidden from the home page entirely** … the entire surface is removed rather than rendered with unfiltered data." · `:49-51` (column labels) · `:62` ("no per-column 'view more' affordance") · `:68` (name collision)
- `documentation/docs/data-lineage.md:30-34` (triplet table + the mislabel sentence) · `:37-39` (OpenAPI summary describes the wrong shape) · `:53-55` (full owned set fetched before pagination; admin-owner cost) · `:59-66` (four-root-cause empty)
- `documentation/docs/active-platform-features/alerting.md:54,61-62` — All / My Objects / **Dependents**; "Dependents … downstream of entities the signed-in user owns … **Impact view** — 'what's breaking in systems that consume my data'" · `:82` (All / My / Dependents badges)
- `documentation/docs/data-discovery/search.md:33-49` — the nine-tab strip incl. `My Objects` ("The subset of the above owned by the authenticated user"); "The tab counts update with the active query and facet selection"
- `adrs/drafts/unified-asset-search.md:47,53-56,68` — D3 "My data (All / My-Objects / Up / Down)"; D4 per-direction depth default 1; D8 retire the tabs
- `state/search-overhaul-decomposition.md:139-146` — ST-8 scope, "own perf gate", multi-select framing
- `lineage/odd-platform/system-mission.md:185` (Glossary terms carry owner/namespace) · `:180` (lineage is the cross-pillar record)
- `lineage/odd-platform/concepts.yaml:610` (Alerts "Three visibility scopes: All / My Objects (owner-linked) / Dependents (downstream-by-lineage)") · `:2334,2344` (the unconditional owner-scoped `countByState` on every search call)
- `integration-tests/protocols/IT-056-my-objects-silent-empty.md:17-40` — the silent-empty characterization pin
- `retrospectives/LSN-001`, `LSN-002` — the silent-degradation-under-a-default class (referenced by name via `CLAUDE.md`)
