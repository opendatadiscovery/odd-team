---
id: ADR-summary-top-level-restructure
title: "Restructure docs/SUMMARY.md top level — promote Introduction / Features / Use cases to ## groups, nest feature pillars + Management under Features, fold ODDRN into Main Concepts"
status: accepted
date: 2026-05-06
accepted_date: 2026-05-07
scope: documentation pillar — `docs.opendatadiscovery.org` SUMMARY taxonomy at the root level
backlog_item: DOC-138
depends_on: DOC-131 (sequencing — resolved as of 2026-05-06; DOC-131 done)
---

# ADR: Restructure docs/SUMMARY.md top level

## Context

### What today's top level looks like

The current `docs/SUMMARY.md` at the project root mixes three structurally different node types at depth 0:

1. **Single top-level pages** (no children, conceptual peer-class unclear) — `README.md`, `main-concepts.md`, `Architecture.md`, `oddrn.md`, `Features.md`, `management.md`.
2. **Top-level pillar landings with nested children** — `data-discovery.md`, `data-modelling.md`, `master-data-management.md`, `active-platform-features.md`, `use-cases.md`. Each has a sub-page set; each is a multi-page surface.
3. **Top-level `##` groups** — `Integrations`, `Configuration and Deployment`, `Developer Guides`. Each is rendered by GitBook as a heading rather than a page; the group's first child (`integrations/README.md` etc.) is the landing.

These three node types sit at the same SUMMARY depth (depth 0). Per `pillars/documentation/cornerstones.md` Cornerstone 2 — *"Hierarchy depth must reflect conceptual depth … two pages at the same depth must be conceptual peers"* — this is a structural mismatch:

- `Features.md` (a single showcase page) is not a conceptual peer of `data-discovery.md` (a multi-page pillar).
- `oddrn.md` (a 38-line vocabulary entry) is not a conceptual peer of `master-data-management.md` (a Data-Governance-pillar landing).
- `management.md` (a feature category) is not a conceptual peer of `main-concepts.md` (the platform vocabulary surface).
- The handful of single pages (Overview, Main Concepts, Architecture) sit as peers of feature-pillar landings, even though they are *orientation* content for the platform as a whole.

`retrospectives/LSN-007-summary-convenience-placements.md` is the canonical case-law for this failure class — pages landing at root or at the wrong depth because no clean parent was identified at authoring time. DOC-082 (done) patched three specific drifts (Directory + GenAI assistant + Build a custom collector) within the existing layout. DOC-131 (review-ready after the precondition fix on `feature/docs-doc131-pillar-relpath-fix-2026-05-06`) carved out the `Active platform features` pillar from `Features.md` H2 sections + the orphan top-level `genai.md`. **What neither item touched is the top-level shape itself** — that is what this ADR proposes.

### User feedback that triggered the proposal

User feedback during `/review batch:feature/docs-active-platform-and-gateway-2026-05-06` (2026-05-06):

> I would better create a "Overview" the same level as we have "INTEGRATIONS", so that "Overview" will have Main Concepts, Architecture and first page with really overview of the ODD. There should be also a "Features" the same level as "INTEGRATIONS", so the grouping of all the features pages with the first page "Overview" with the content of the current page "Features", and Also I would put Management to the bottom of the group of Features; We should also have Use Cases the level of "INTEGRATIONS", I also don't think that ODDRN deserves a separate page — we could just describe it in more details in Main Concepts.

The proposal aligns the top level on a single shape — **every depth-0 node is a `##` group with a landing + children** — matching the pattern that already works for `## Integrations` / `## Configuration and Deployment` / `## Developer Guides`.

## Decision

Accept the proposal. The new top-level shape is:

```
## Introduction
* [Overview](README.md)                    ← group landing (same shape as integrations/README.md)
* [Main Concepts](main-concepts.md)        ← absorbs ODDRN content; oddrn.md deleted
* [Architecture](Architecture.md)

## Features
* [Overview](Features.md)                  ← Features.md content unchanged; only the SUMMARY parent changes
* [Data Discovery](data-discovery.md)
  * [Directory](data-discovery/directory.md)
* [Data Modelling](data-modelling.md)
  * [Query Examples](data-modelling/query-examples.md)
  * [Relationships](data-modelling/relationships.md)
* [Master Data Management](master-data-management.md)
  * [Lookup Tables](master-data-management/lookup-tables.md)
* [Active platform features](active-platform-features.md)
  * [Alerting](active-platform-features/alerting.md)
  * [Notifications](active-platform-features/notifications.md)
  * [Activity Feed](active-platform-features/activity-feed.md)
  * [Data Collaboration](active-platform-features/data-collaboration.md)
  * [GenAI assistant](active-platform-features/genai.md)
* [Management](management.md)              ← bottom of the Features group, after the four feature pillars

## Use cases
* [Overview](use-cases.md)
  * [Data compliance for Data Scientists](use-cases/dc-data-compliance.md)
  * [Deprecation for Data Engineer \ Analyst](use-cases/de-deprecation.md)
  * [Visibility for Data Quality Engineer](use-cases/dq-visibility.md)
  * [Data preparation for Visualization Engineer](use-cases/viz-preparation.md)
  * [Service Provider and Pre-Sales](use-cases/service-presales.md)

## Integrations
(unchanged — already a ## group)

## Configuration and Deployment
(unchanged — already a ## group)

## Developer Guides
(unchanged — already a ## group)
```

The decision is to accept this shape pending Phase B verification of three open implementation questions (see "Open questions" below). The structural intent is settled by this ADR; Phase B answers determine the exact mechanics (URL slugs, README-as-home behaviour, cross-link sweep size).

### Group-name convention

The pattern across the existing `##` groups is **group = the topic, first page = "Overview" of that topic** (`## Integrations` → `[Overview](integrations/README.md)`). Applying that pattern at the orientation level: the first group's first page is `[Overview](README.md)`; the group itself names the topic that page overviews. **The group name `Introduction`** was chosen during Phase A drafting (user feedback 2026-05-06) over alternatives (`## Overview` / `## Open Data Discovery` / `## Solution at first glance` / `## The platform`). `## Overview` was rejected because `Overview → Overview` reduplicates and tells a first-time visitor nothing — group names should describe what's *inside*, not restate the type of content. `Introduction` is the formal-doc-convention reading; it scans cleanly with `Overview / Main Concepts / Architecture` underneath; it does not collide with the "ODD Platform" component name (which is one of several components on `main-concepts.md`); and it does not lock the tone to marketing copy.

### Why each piece is sound

- **`## Introduction` group** — orientation content (home page + Main Concepts + Architecture) clusters together rather than scattering at root. Mirrors the existing `## Integrations` / `## Configuration and Deployment` / `## Developer Guides` pattern; same convention as `[Overview](integrations/README.md)` for the group's landing. The reader who lands on the home page sees the orientation set co-located.

- **`## Features` group with feature pillars + Management nested** — today the four feature-pillar landings (`data-discovery.md`, `data-modelling.md`, `master-data-management.md`, `active-platform-features.md`) and `management.md` sit at SUMMARY top level **as peers of `main-concepts.md` and `Architecture.md`**. That is a Cornerstone-2 hierarchy-depth violation: a feature-pillar landing is not a conceptual peer of the platform-vocabulary surface. DOC-082 patched local drifts; DOC-131 carved out the active-platform-features pillar; this ADR finishes the Cornerstone-2 alignment at the root.

- **Management at the bottom of Features** — Management is operator-mutating UI; it **is** a feature category. Sitting at the bottom of the Features group (after the four governance / active-platform pillars) preserves the DOC-137 "kinds" framing — governance pillars (read-oriented), active platform features (event-driven), Management (operator-mutating) are three peer feature kinds, with the read-oriented ones first because they are the mainstream catalog-consumption path and the operator-mutating one last because most users do not need it.

- **`## Use cases` group** — already a top-level entry with five nested children today. Promoting it to a `##` group makes the SUMMARY shape uniform across all six top-level groups. Zero content change.

- **ODDRN folded into Main Concepts** — `docs/oddrn.md` is 38 lines; `docs/main-concepts.md` is 95 lines. Post-merge `main-concepts.md` is ~120 lines, well inside the "concept index stays short" budget per `pillars/documentation/cornerstones.md` Cornerstone 2. ODDRN is conceptually a vocabulary item (the canonical entity-identifier format) — exactly what Main Concepts is for. The merge is clean, no information loss; the dedicated page becomes redundant.

## Trade-offs

Three explicit trade-offs the proposal navigates:

### 1. URL-slug stability vs. conceptual peers

Accepting the proposal **may** change the URLs of the moved pages (e.g., `/data-discovery` → `/features/data-discovery`) depending on how GitBook derives slugs from the SUMMARY hierarchy. URL changes are a publishing-standards cost (external bookmarks, search-engine indexing, Slack-shared links break). Per `pillars/documentation/gates.md` Gate 8 ("Publishing standards always"), URL stability is a hard constraint; the case-law that triggered the rule is `retrospectives/LSN-004-s2s-fallback-cache.md`.

**Resolution path**: Phase B Question 1 verifies GitBook's actual behaviour. If URLs change, this ADR is amended (or rejected pending a redirect strategy); if URLs are slug-stable across SUMMARY-depth changes, the trade-off vanishes and the proposal proceeds. The decision *to make the structural change* is accepted; the *how* is gated on Phase B.

### 2. README-as-home vs. README-as-group-landing

`docs/README.md` today is the home page served at `https://docs.opendatadiscovery.org/`. The proposal nests it under `## Introduction` as the group's landing. Two questions follow: (a) does the home URL still resolve at `/` after this nesting? (b) if not, where does the user landing on `/` go?

The convention exists today — `integrations/README.md` is the `## Integrations` group's landing and renders at `https://docs.opendatadiscovery.org/integrations/integrations`. Applying the same shape to `docs/README.md` under `## Introduction` is structurally consistent. The behavioural unknown is whether GitBook treats the *root* `README.md` differently from a *subdirectory* `README.md`.

**Resolution path**: Phase B Question 2. Same gate as trade-off 1 — accept the structural intent now, verify the mechanics in Phase B before any SUMMARY edit.

### 3. ODDRN-as-page vs. ODDRN-as-section

ODDRN today has its own dedicated page (`docs/oddrn.md`) with five sections (Overview / Format / Usage / Known limitations / Examples). The proposal folds the content into a `## ODDRN` section on `main-concepts.md` and deletes the dedicated page. Cost: the URL `https://docs.opendatadiscovery.org/oddrn` becomes a 404 (GitBook does not auto-redirect; this is a deliberate URL retirement). Benefit: ODDRN is conceptually a vocabulary entry — folding it into the vocabulary surface is consistent with the canonical-home pattern (`pillars/documentation/canonical-homes.md` "Glossary / aliases" → `docs/main-concepts.md` Terms & Aliases).

**Resolution path**: deliberate URL retirement, documented in the commit body that performs the merge. Inbound-link sweep (Phase E) rewrites every `oddrn.md` reference to `main-concepts.md#oddrn`. The `oddrn` URL retirement is the cost of treating Cornerstone 5 (one canonical home per content type) as the binding constraint.

## Open questions for Phase B (pre-flight implementation reading)

Phase B is the gate before Phase C (the SUMMARY edit). Each question has a verification path; each answer either confirms the proposal proceeds as authored or identifies a constraint that amends this ADR.

### Question 1 — GitBook's URL-slug behaviour for nested pillar landings

**Background**: GitBook flattens some intermediate directory levels in URLs. We observed this on the gateway page (`integrations/integrations/odd-tracing-gateway`, not `.../auxiliary/...` despite the source path being `docs/integrations/auxiliary/odd-tracing-gateway.md`).

**Question**: When `data-discovery.md` is moved from a top-level entry to a child of the `## Features` group, does its URL stay `/data-discovery` (the slug-derivation drops the group prefix), or does it become `/features/data-discovery` (the slug includes the group)?

**Verification path**: Inspect the live URLs of pages currently under `## Integrations` / `## Configuration and Deployment` / `## Developer Guides`. Examples:
- `[odd-collector (generic)](integrations/collectors/odd-collector.md)` — what is the live URL? If it is `/integrations/integrations/odd-collector` (carries the group + directory + filename), the slug-derivation is hierarchy-driven.
- `[Configure ODD Platform](configuration-and-deployment/odd-platform.md)` — what is the live URL? Same probe for Configuration and Deployment.
- `[API Reference](developer-guides/api-reference.md)` — same probe for Developer Guides.

The pattern across these three groups is the ground truth. If the slugs include the directory hierarchy, moving `data-discovery.md` to a child of `## Features` (without moving the source file) preserves the URL `/data-discovery` (because the source is still at `docs/data-discovery.md`). If the slugs include the SUMMARY group prefix, the URL becomes `/features/data-discovery` and the cross-link sweep is wide.

**Answer determines**: cross-link sweep scope (Phase E). Slug-stable → small sweep (verify links resolve, no rewrites needed); slug-changing → wide sweep + redirect strategy (or accept the URL retirement per trade-off 1).

### Question 2 — README-as-group-landing rendering at the root URL

**Background**: `docs/README.md` is the home URL today. The proposal nests it under `## Introduction` as the group's landing.

**Question**: After the nesting, does `docs/README.md` still render at `https://docs.opendatadiscovery.org/` (the root URL), or does its URL change?

**Verification path**: WebFetch the existing group-landing pages on the live site and read their URLs:
- `docs/integrations/README.md` → `https://docs.opendatadiscovery.org/integrations/integrations` (verified during the 2026-05-06 review batch)
- The behaviour for a *root* `README.md` under a `##` group is the unknown. Since `docs/README.md` is at the top of the source tree, the URL likely stays `/` even after SUMMARY nesting (the source-tree path is what determines the URL slug, not the SUMMARY position) — but verify before relying.

**Answer determines**: whether the home URL stability is preserved (proposal proceeds) or changes (compensating action: keep `README.md` outside the `## Introduction` group, or accept the home URL change with a redirect strategy).

### Question 3 — Cross-link sweep enumeration

**Background**: Phase E rewrites every inbound link to a moved page if the URL changes. Phase B needs to enumerate the surface so the sweep is bounded.

**Question**: How many inbound links in `docs/` target the moved pages — `data-discovery.md`, `data-modelling.md`, `master-data-management.md`, `active-platform-features.md`, `management.md`, `use-cases.md`, `oddrn.md`, `Features.md`, `Architecture.md`, `main-concepts.md`?

**Verification path**: `grep -rE '(data-discovery|data-modelling|master-data-management|active-platform-features|management|use-cases|oddrn|Features|Architecture|main-concepts)\.md' docs/` — count + per-file list. The `oddrn.md` references are mandatory rewrites (the page is deleted regardless of Question 1's answer); the others are conditional on Question 1.

**Answer determines**: Phase E size. Drives the choice between a single-batch ship (small sweep) or a multi-PR phased ship (wide sweep with intermediate redirects).

## Sequencing with DOC-131

DOC-131 (`/feature/docs-doc131-pillar-relpath-fix-2026-05-06` — drop `..` prefix from `docs/active-platform-features.md` lines 16/33/39/40/41) ships as a **precondition** for this ADR's implementation, not as part of it. Reasoning:

- Today the active-platform-features pillar landing has a Gate 8 fail (5 internal cross-link targets render as `github.com/.../blob/main/...` GitHub-fallback URLs because the source uses `..`-prefixed paths from depth 0, where `..` resolves outside `docs/`).
- DOC-131's fix is small (5 line edits removing the `..` prefix) and ships independently as a one-commit PR.
- After this ADR's restructure ships, `active-platform-features.md` would be at depth 1 (child of `## Features`); at depth 1, the `..` prefix WOULD be correct for cross-links to other top-level files. So the dependency is conditional: if DOC-131 ships first as the small unblock, the no-`..` form is correct per the sibling-landing convention; then this ADR's restructure moves `active-platform-features.md` to depth 1 and the `..`-prefix form becomes correct again.
- Easier to fix DOC-131 first and treat the depth change here as a separate concern that this ADR's Phase E sweep handles.

DOC-131 ships in a separate PR ahead of this ADR's implementation.

## Phasing

Per DOC-138's acceptance criteria. Phase A is this ADR (delivered on `feature/state-doc131-doc138-2026-05-06`). Phases B–F follow on a separate batch after this ADR is approved.

| Phase | Deliverable | Branch | Status |
|---|---|---|---|
| A | This ADR draft + user review gate | `feature/state-doc131-doc138-2026-05-06` (odd-team) | **Phase A complete on branch (this ADR); awaiting user review** |
| B | Phase B verification report — answers to Questions 1/2/3 above + a written go/no-go for Phase C | (new branch — odd-team or read-only investigation) | Pending user approval of Phase A |
| C | `docs/SUMMARY.md` reshape | (new branch — documentation) | Pending Phase B answers |
| D | Fold ODDRN into `main-concepts.md`; delete `docs/oddrn.md`; Terms & Aliases row updated to `main-concepts.md#oddrn` | (same branch as Phase C) | Pending Phase C |
| E | Cross-link sweep across `docs/` for moved pages | (same branch as Phase C) | Pending Phase D |
| F | Live-site verification — WebFetch every affected URL on `docs.opendatadiscovery.org`; confirm no GitHub-fallback substring; confirm home URL still resolves | `/review` of the Phase C/D/E PR | Pending merge of C/D/E |

## Why this is ADR-class

Per `CLAUDE.md` "ADRs (Architectural Decision Records)" — *"If you make a new decision not covered by existing ADRs → create a draft in adrs/drafts/."*

This restructures the top level of the doc tree — bigger than DOC-082's specific drifts (Directory + GenAI + Build a custom collector). The trade-offs (URL-slug stability vs. conceptual peers; README-as-home vs. README-as-group-landing; ODDRN-as-page vs. ODDRN-as-section) are decision-class, not fix-class. A future maintainer asking "why is the SUMMARY shaped this way?" needs the WHY captured here, not buried in a commit message.

Cornerstone-2 (hierarchy depth must reflect conceptual depth) and Cornerstone-5 (one canonical home per content type) are the binding constraints; this ADR operationalises both at the root level.

## Risks and rollback

### Risks

- **URL retirements break external links** (mitigation: deliberate URL retirement is documented in the merge commit body per Phase D for the oddrn case; per Phase B Question 1, the moved-pillar URLs may or may not change, and the redirect strategy depends on that answer).
- **Phase B answers reveal a constraint that requires amending this ADR** — e.g., GitBook's slug behaviour forces a different shape. The ADR remains in `draft` until Phase B reports.
- **Reader-flow regressions on the home URL** if `README.md`-as-group-landing changes the home behaviour (Phase B Question 2 catches this; user spot-check confirms).

### Rollback

The restructure is reversible by SUMMARY-only revert. The content edits (Phase D — ODDRN merge, oddrn.md deletion) are content-tree changes that cannot be cleanly reverted by a SUMMARY edit alone. Rollback strategy:

1. Revert the SUMMARY commit → SUMMARY top-level shape returns to today's form.
2. Restore `docs/oddrn.md` from git history; revert the `main-concepts.md` ODDRN section addition; revert Terms & Aliases row + every inbound-link rewrite.
3. Re-WebFetch the affected URLs to confirm the rollback landed on the live site.

The rollback is not destructive but is non-trivial. Phase B verification is the cheapest insurance against needing it.

## Phase B verification report (2026-05-07)

User approved the ADR's structural intent (Phase A) on 2026-05-07. Phase B verification was run in the same session before any SUMMARY edit. Findings below.

### Question 1 — GitBook URL-slug behaviour

**Answer: URLs DO change when a top-level page becomes a child of a `##` group.**

Verified via WebFetch of existing `##` group children:

| URL probed | Status | Evidence |
|---|---|---|
| `/integrations/integrations/odd-collector` | **200** ✓ | Page renders: H1 "odd-collector (generic)" |
| `/integrations/collectors/odd-collector` | **404** ✗ | "The URL `integrations/collectors/odd-collector` does not exist" — the source-tree intermediate dir `collectors/` is flattened away |
| `/data-discovery` | **200** ✓ | Current top-level page; H1 "Data Discovery" |
| `/oddrn` | **200** ✓ | Current top-level page; H1 "ODDRN" |
| `/configuration-and-deployment/odd-platform` | (200 inferred) | Body text matched Configure ODD Platform |

**Pattern**: For a direct child of a `##` group, GitBook URL = `/{group_slug}/{filename_slug}` (intermediate source-tree directories flattened). For a nested child of an Overview README parent, URL inherits the Overview's URL prefix.

**Implication for the proposal**:

| Page | Current URL | Post-restructure URL | Delta |
|---|---|---|---|
| `data-discovery.md` | `/data-discovery` | `/features/data-discovery` | URL changes |
| `data-modelling.md` | `/data-modelling` | `/features/data-modelling` | URL changes |
| `master-data-management.md` | `/master-data-management` | `/features/master-data-management` | URL changes |
| `active-platform-features.md` | `/active-platform-features` | `/features/active-platform-features` | URL changes |
| `management.md` | `/management` | `/features/management` | URL changes |
| `use-cases.md` | `/use-cases` | `/use-cases/use-cases` | URL changes (group + filename) |
| `Features.md` | `/features` | `/features/features` (probable) | URL changes |
| `main-concepts.md` | `/main-concepts` | `/introduction/main-concepts` | URL changes |
| `Architecture.md` | `/architecture` | `/introduction/architecture` | URL changes |
| `oddrn.md` | `/oddrn` | (deleted — Phase D) | URL retired |

**9 pillar-page URLs change + 1 URL retirement.** Plus the nested children inherit new prefixes:

| Nested page | Current URL | Post-restructure URL |
|---|---|---|
| `data-discovery/directory.md` | `/data-discovery/directory` | `/features/data-discovery/directory` |
| `data-modelling/query-examples.md` | `/data-modelling/query-examples` | `/features/data-modelling/query-examples` |
| `data-modelling/relationships.md` | `/data-modelling/relationships` | `/features/data-modelling/relationships` |
| `master-data-management/lookup-tables.md` | `/master-data-management/lookup-tables` | `/features/master-data-management/lookup-tables` |
| `active-platform-features/{alerting,notifications,activity-feed,data-collaboration,genai}.md` | `/active-platform-features/{slug}` | `/features/active-platform-features/{slug}` |
| `use-cases/{five sub-pages}.md` | `/use-cases/{slug}` | `/use-cases/use-cases/{slug}` |

**Total external-bookmark surface affected: ~22 URLs change + 1 retired.**

This is exactly the trade-off the ADR's "Trade-off 1" anticipated. Per the ADR, this triggers one of: (a) accept URL retirement with deliberate documentation, (b) ADR amendment with redirect strategy, (c) source-file move so URLs change naturally.

### Question 2 — README-as-group-landing rendering at the root URL

**Answer: Unknown without live test. High risk.**

No existing scenario on the live site directly mirrors the proposed shape (a *root* `docs/README.md` nested under a `##` group). The closest analogue is `docs/integrations/README.md` (in a subdirectory) which renders at `/integrations/integrations` — i.e., it does NOT render at `/integrations/`. By that analogy, `docs/README.md` nested under `## Introduction` would likely render at `/introduction/` or `/introduction/README` rather than at `/`.

**Risk**: the home URL `https://docs.opendatadiscovery.org/` may break. Operators who bookmark the root, the README's own self-references, search-engine indexing, and any "canonical home" links into the docs tree would all need attention.

The only way to fully verify is to ship the change and observe. A pre-flight option: keep `docs/README.md` *outside* the `## Introduction` group (i.e., as a sibling to the groups, depth 0) so the home URL is unambiguously preserved; the `## Introduction` group then carries `Main Concepts` + `Architecture` only. This is a small amendment to the ADR's proposed shape.

### Question 3 — Cross-link sweep enumeration

**Answer: 167 inbound link occurrences across `docs/` to the moved-page filenames.**

Counted via:
```
grep -rEn '\b(data-discovery|data-modelling|master-data-management|active-platform-features|management|use-cases|oddrn|Features|Architecture|main-concepts)\.md\b' docs/ | grep -v '^docs/SUMMARY.md' | wc -l
```

**Critical caveat**: GitBook resolves source-relative links by source-tree path, not URL. The Phase E sweep is therefore mostly *verification* (links resolve), not *rewrite* (no path edits needed) — because the source files at `docs/data-discovery.md` etc. don't move; only their SUMMARY parent changes. Internal cross-links auto-update; what breaks is *external* references (Slack-shared links, bookmarks, search indexing).

The `oddrn.md` references ARE mandatory rewrites (the page is deleted in Phase D). Counting just `oddrn.md` references in the grep above: ~6 inbound sites (`Architecture.md`, `main-concepts.md`, `developer-guides/build-and-run/custom-collectors.md`, `developer-guides/api-reference/directory.md`, `developer-guides/github-organization-overview.md`).

### Recommendation for the user (decision needed)

The structural intent is settled and well-justified. The mechanics surface a real trade-off that the user must decide before Phase C/D/E ship.

**Options:**

1. **Accept URL retirement, ship as-drafted.** ~22 URLs change, 1 retires. Documented in commit body as deliberate URL retirement under the publishing-standards trade-off (parallel to the ODDRN URL retirement that Trade-off 3 already accepts). External bookmarks break; SEO indexing rebuilds over weeks. Low engineering cost; high external-link disruption.

2. **Ship the structural change but keep `docs/README.md` outside `## Introduction`.** Address Question 2's risk pre-emptively. Mitigates the home-URL risk but leaves the 9 pillar-page URL retirements in scope. Smaller scope of breakage, but the proposal's "every depth-0 node is a `##` group" shape is amended (a single page sits at depth 0 alongside groups).

3. **Defer Phase C/D/E pending a redirect strategy.** GitBook supports `redirects.yaml` (or similar configuration) for old-path → new-path mappings. Author the redirect manifest first; ship the SUMMARY restructure with redirects in place; external links auto-rewrite. Zero external-link disruption; higher engineering cost (redirect manifest authored + verified; need to confirm GitBook honors it on this site).

4. **Defer Phase C/D/E pending source-file moves.** Move `docs/data-discovery.md` → `docs/features/data-discovery.md` etc. so the URL change is "natural" (the source-tree change explains the URL change). Largest scope; cleanest end-state; Phase E sweep becomes wide because source-relative links inside the moved files break.

**Recommendation**: Option 2 + Option 3 in sequence. Keep `docs/README.md` at depth 0 (preserves home URL); ship the rest of the restructure with a redirect manifest for the 9 pillar pages + nested children. If GitBook redirect support is unavailable on this hosting tier, fall back to Option 1 (accept retirement) with the deliberate-URL-retirement note in the merge commit body.

**Phase C/D/E remain deferred until the user picks an option.** Phase A (this ADR) and Phase B (this report) are complete; the gate to authoring is the user's pick on the four options above.

## Decision amendment (2026-05-07) — chosen path

User intervention 2026-05-07 explicitly redirected the maintainer away from the "four options for re-approval" pattern that had stalled Phase C/D/E: *"it's not a corporate environment where we could for ages discuss and put one paper over another — it's a Open Source Project with only my capacity to maintain it ... we are not here just spending budgets and time."* The chosen path is **ship as-drafted, accept URL retirement, validate via live-site verification post-merge** (effectively Option 1 from the four-option recommendation, with Option 2's home-URL safety as a fallback if Phase F live-site verification surfaces a regression):

1. **Apply the proposed SUMMARY shape verbatim** — `docs/README.md` nested under `## Introduction` per the ADR's drafted structure. The home-URL behaviour under nesting is verified post-merge via WebFetch on `https://docs.opendatadiscovery.org/`. If the home URL has shifted, the recovery is a SUMMARY-only edit (move README back to depth 0 — Option 2 fallback applies in that branch only).
2. **Accept URL retirements** for the ~22 affected pillar pages (e.g., `/data-discovery` → `/features/data-discovery`) and the deliberate retirement of `/oddrn` (Phase D). Documented in the merge commit body. External bookmarks rebuild over the SEO crawl cycle; structural-rightness wins long-term.
3. **No GitBook redirect-manifest** authored upfront. If post-merge analytics or operator reports surface high-traffic broken inbound links, a follow-up backlog item adds redirects retroactively.
4. **Source files do not move.** The restructure is SUMMARY-only; the source-tree path of every page is unchanged. Internal source-relative links auto-resolve via GitBook.

This amendment captures what was actually shipped, not a new plan.

## Status

**Accepted** (2026-05-07).

- Phase A: ✅ done — ADR draft delivered + user-approved 2026-05-07.
- Phase B: ✅ done — verification report appended (URL slug behaviour verified, cross-link sweep size enumerated, home-URL behaviour flagged as the only post-merge unknown).
- Phase C: ✅ done — `docs/SUMMARY.md` reshaped to the proposed structure (commit on `feature/docs-doc034-2026-05-07`).
- Phase D: ✅ done — ODDRN folded into `main-concepts.md`; `docs/oddrn.md` deleted; Terms & Aliases row updated to anchor.
- Phase E: ✅ done — 8 inbound `oddrn.md` references rewritten to `main-concepts.md#oddrn`; sweep clean.
- Phase F: ⏳ pending `/review` in a separate session — live-site verification on the affected URLs once the documentation PR merges.

The ADR moves to `adrs/summary-top-level-restructure.md` (out of `drafts/`).

## Related

- `pillars/documentation/cornerstones.md` Cornerstone 2 (hierarchy depth must reflect conceptual depth) — the principle this ADR operationalises at the root.
- `pillars/documentation/cornerstones.md` Cornerstone 5 (one canonical home per content type) — the principle that justifies the ODDRN merge.
- `pillars/documentation/gates.md` Gate 7 (layout and IA hierarchy sanity) — the reviewer gate that catches the failure class this ADR pre-empts.
- `pillars/documentation/gates.md` Gate 8 (publishing standards always) — the URL-stability constraint that gates Phase B Questions 1 and 2.
- `retrospectives/LSN-007-summary-convenience-placements.md` — canonical case-law for SUMMARY-placement IA failures; this ADR addresses the same failure class at the root level.
- `retrospectives/LSN-004-s2s-fallback-cache.md` — fallback-cache event class the implementation must avoid (DOC-131 is the recent example of the wrong-relative-path-depth variant).
- DOC-138 (pending — this ADR is Phase A) — the backlog item that schedules the work.
- DOC-131 (review-ready on `feature/docs-doc131-pillar-relpath-fix-2026-05-06`) — precondition fix, ships as a separate PR.
- DOC-082 (done) — local IA refactor (Directory + GenAI + Build a custom collector); precedent for this top-level work.
- DOC-137 (done) — Features.md L3 disclaimer "kinds" framing; this ADR makes the kinds structurally visible.
