---
pillar: documentation
file: cornerstones
status: active
since: 2026-04-16
---

# Cornerstones — documentation pillar

`docs.opendatadiscovery.org` is a **navigation panel for users to grasp the platform without prior context**, plus a deep-dive reference for operators and developers. The five cornerstones below are constraints the maintainer holds on every doc change — they are upstream of the IA decisions, the Quality Bar gates, and the cross-link expectations encoded in `pillars/documentation/gates.md`. When a structural question comes up ("does this feature deserve its own page?", "where does this content belong?", "is this duplication acceptable?"), resolve it by reading these cornerstones, not by analogy to the most recent change.

## Cornerstone 1 — Discoverability without context

A first-time reader must be able to grasp the full functionality of the platform by either (a) reading the in-page Table of Contents on the canonical Features landing OR (b) scrolling that single page. No prior knowledge of ODD's governance taxonomy, deployment topology, or terminology is required to get a complete picture of *what the platform does*. Configuration details, runtime caveats, and SDK limitations DO NOT belong on this surface — they live one click away on the feature's detail page or on the corresponding configuration page. The Features landing is a showcase for users deciding whether ODD fits a use case, not the manual for operators tuning a deployment.

## Cornerstone 2 — Aspect-level deep dive with single canonical source

Beyond the Features landing, readers deep-dive from a chosen *perspective* — "how do I assemble a comprehensive Data Cataloguing setup?", "how does Data Quality work end-to-end?", "what does ODD ship for Master Data / Reference Data?". The IA shape that supports this is explicit and consistent across pillars:

- **`main-concepts.md` stays short** — it is the concept index and the vocabulary surface (governance map + Terms & Aliases). It explains concepts at a high level (concepts can span features), and it is the canonical home for every synonym / alias entry. It does **not** carry feature-level detail. If a concept gets long, the long form belongs on its aspect landing, with a one-line entry on `main-concepts.md` cross-linking to it.
- **One aspect landing per "available" / "partially available" pillar** — separate subpage per pillar in `main-concepts.md` "Data Governance map" (today: `data-modelling.md`; future siblings for Data Discovery / Cataloguing, Data Lineage, Data Quality, Master Data Management incl. Reference Data, Business Glossary). Each aspect landing is prescriptive ("to assemble X perspective, combine these features"), carries an Overview that may describe smaller features inline, and indexes its sub-features.
- **Per-feature detail pages are optional and nested under their aspect landing** — features rich enough to justify their own page (Query Examples, Relationships, Lookup Tables, …) get a child page nested under the aspect's SUMMARY entry. Smaller features sit inside the aspect landing's Overview without a dedicated page. The decision "does this feature deserve its own page?" is answered by content depth (multiple sections, RBAC, API surface, caveat surface), not by analogy to siblings.

**Every feature attributes to exactly one bucket — no orphans.** Beyond the six Data Governance pillars, the doc product carries two additional buckets that play the same aspect-landing role: **Management** (`management.md`, the operator-mutating UI surface) and **Active platform features** (`active-platform-features.md`, the platform's event-driven, opt-in behaviours — alerts, notifications, activity feed, data collaboration, GenAI). Together with the six governance pillars, this gives **eight buckets** that every feature claims one of as its primary home. The attribution is explicit on both surfaces:

- The feature's section on `Features.md` (or its dedicated detail page if it has one) opens or closes with a sentence naming the primary bucket and linking to its landing — "Part of the [Data Discovery](data-discovery.md) section." or "See the dedicated X page under [Y](y.md)." Pattern is consistent so a reviewer can grep for it.
- The bucket's aspect landing **homes the feature** — either as an inline section in the landing's Overview (for smaller features) or via a `## Subsections` entry pointing at the feature's dedicated detail page (for features rich enough to warrant their own page). The bucket landing is the canonical reading path; a reader on the landing reaches every feature attributed to that bucket without leaving the bucket's subtree.

**`Features.md` is the index — cross-link direction is one-way.** Features.md is the index of the platform's user-visible functionality (Cornerstone 1) — first-time readers grasp the surface from it, then descend. Bucket landings, detail pages, integration pages, configuration pages, API reference, and any other surface **below the index** MUST NOT cross-link back to a `Features.md` anchor for canonical reference. Link direction is `Features.md` → detail; never the reverse. Index-internal navigation on `Features.md` itself (the in-page TOC, intra-page anchors) is fine; what the rule forbids is a detail surface treating the index as a peer page or as a content home.

**Migration corollary.** When a feature currently lives inline on `Features.md` AND a detail page or bucket landing wants to reference it, the right move is to **migrate the feature's content to its bucket landing** (as an inline section on the landing) **or to a new dedicated detail page under that bucket** — not to add a reverse-link to `Features.md`. The bucket landing's `## Subsections` list is the canonical home for indexing; do not introduce a parallel "Other {bucket} features" pointer-list that punts back to `Features.md`. The placement decision is a Cornerstone-2 content-depth call (smaller features inline on the bucket landing; richer features carve out a dedicated detail page); the decision is *not* "add a reverse-link and defer the homing question."

Canonical failure: 2026-05-07 (`retrospectives/LSN-012-cornerstone-codified-wrong-pattern.md`). The prior version of this cornerstone (commit `62a5011`) endorsed an "Other {bucket} features" sub-list pattern under which inline-on-`Features.md` features were indexed on the bucket landing via reverse-links to `Features.md` anchors. Within hours of that codification, sibling work (PR #66) shipped a `## Other Data Discovery features` H2 on `data-discovery.md` with 10 reverse-links; combined with the IA-refactor batch (PR #65) the doc tree carried 22 reverse-link instances across 5 files. The user flagged the inversion verbatim — *"Features/Overview is an index of all the features … it should have links to the detailed explanations of the features in the dedicated sections — not vice versa where we have references for index from some dedicated pages — this is crazy and stupid."* DOC-149 captures the doc-side cleanup; this cornerstone update (DOC-150) supersedes the rule that produced the defect.

**Cross-cutting features pick a primary, cross-link the rest.** When a feature spans multiple buckets (e.g., Data Entity Statuses participates in Data Discovery filtering and the Activity Feed event surface), name **one primary bucket** for the canonical attribution and cross-link the related buckets inline on the feature's section. The primary is the bucket whose first-time reader most depends on the feature being reachable from the bucket landing — typically the bucket that *introduces* the feature to a user encountering it for the first time. Cross-links travel **outward** to the related buckets' landings — never back to a `Features.md` anchor.

**No "independent" features.** A feature that fits into none of the eight buckets is a signal that either (a) the bucket set is incomplete and a new bucket is owed (a Cornerstone-2 decision before authoring), or (b) the proposed feature is a sub-feature of an existing bucket and the attribution is missed. Do not ship a feature with no bucket — escalate the IA decision instead.

Overlap of features and terms across aspect landings is expected and accepted. The convention is strict: **detail content lives in exactly one canonical location — either the feature's detail page (when it has one) or its aspect landing's Overview (when it doesn't) — and every other mention is a cross-link**. No parallel copies, no convenience duplication for a specific reading path. (This is Quality Bar Gate 1 applied at the IA level.)

**Hierarchy depth must reflect conceptual depth.** SUMMARY.md is not a flat list — every entry's depth is a claim. A page placed at SUMMARY top level claims peer status with the other top-level entries (Overview, Main Concepts, Architecture, ODDRN, Features, Use cases, the pillar landings). A page nested as a child claims its parent is conceptually broader. **Two pages at the same depth must be conceptual peers — not "one is a parent group with subpages and the other is a sibling of the parent."** Before adding any new SUMMARY entry, walk the conceptual tree:

- *What is this page conceptually about?*
- *Which existing top-level entry or pillar landing is the conceptual parent?*
- *If a parent exists in SUMMARY, nest under it.* If a parent exists conceptually but not yet in SUMMARY, propose adding the parent landing first (a Cornerstone-2 decision: which pillar does it belong to, what other peers will it host).
- *If no parent fits and the page is genuinely a new pillar, the addition warrants a separate Cornerstone-2 discussion before authoring.* Top-level slots are scarce and signal "primary navigation pillar."

The default is to nest under an existing thematic parent rather than to add a new top-level entry. **Convenience-placements** — a page lands at root or at the wrong depth because no clean parent was identified at authoring time, or because "next to a similar-feeling page" felt close enough — are the failure class this rule catches. The 2026-04-30 case (`retrospectives/LSN-007-summary-convenience-placements.md`) is canonical: `Directory` placed as a top-level peer of `Main Concepts`; `GenAI assistant` placed as a top-level peer of `Features`; `Build a custom collector` placed as a sibling of the `Build and run` group. DOC-082 logs the IA refactor.

Reviewer Gate 7 enforces this rule at review time; the implementer pre-empts it at authoring time by computing the placement from the conceptual tree, not from "where similar pages are today."

## Cornerstone 3 — Configuration is a separate audience surface

Configuration documents *operators, devops, and developers* — not end users. It lives on its own subtree (`configuration-and-deployment/`). Feature pages reference the configuration sections that gate runtime behavior; configuration pages reference back to the features they enable, so an operator reading a config key always knows what user-visible feature it backs. **Bidirectional cross-links between feature pages and their configuration sections are mandatory** — a feature with a configuration footprint must link to its config section, and a config key with a user-visible feature must link to that feature. The 2026-04-28 user spot-check that surfaced the Attachments-feature ↔ attachment-storage-configuration gap (`features#id-6fbe` ↔ `odd-platform#attachment-storage-configuration`, no link in either direction) is the canonical failure case for this cornerstone — treat the bidirectional link as a hard expectation, not a nice-to-have. A scanner for this class (cross-link coverage between sibling docs) is in scope for `scanners/docs/quality/`.

## Cornerstone 4 — Three audiences, AI-maintained consistency

The doc serves three distinct audiences who must be able to navigate the same source tree without friction:

- **Users** — explore features, decide whether ODD fits a use case, request enhancements, file precise bug reports against the features they actually use.
- **Operators** — deploy, maintain, and tune instances; configure security, storage, integrations, alerting; respond to runbook situations.
- **Developers (including virtual / AI agents)** — navigate the feature surface, understand cross-cutting connectivity, find the vision and rationale in ADRs, reason about the impact of a change in any feature or piece of configuration.

The consistency bar these three audiences require — no duplicates, every alias logged, every caveat captured, every cross-link bidirectional, every claim traced to its canonical source of truth — was previously infeasible at this scale without dedicated technical-writing staff. With AI-assisted maintenance (Claude Code, Codex, the Quality Bar gates and skill protocols in this workspace), the bar becomes the normal operating mode rather than an unreachable ideal. The maintainer's job is to hold that bar; the rails in this workspace exist to keep a tired or context-switching maintainer from dropping it. "It used to be impossible" is not an excuse to maintain at the old bar — it is the reason the bar has been raised. (See `pillars/documentation/pillar.md` "The bar — stated explicitly" for the world-class-or-give-up framing.)

## Cornerstone 5 — One canonical home per content type

Beyond features and aspects (Cornerstones 1 and 2) and configuration (Cornerstone 3), the doc product carries several recurring **content types** that serve different reading needs. Each must have **exactly one canonical home** in the doc tree; feature pages and aspect landings **link to that home** for any content of that type, rather than embedding authored fragments. The 2026-04-30 lookup-tables / api-reference case (`retrospectives/LSN-006-lookup-tables-content-homing.md`) is the canonical failure of this rule.

**The full content type table, the three legitimate authoring outcomes, and the rule operationalized live in `pillars/documentation/canonical-homes.md`.** This cornerstone states the rule; the table is the rule's data.

**Cornerstone 3 is a specific instance of this rule.** "Configuration is a separate audience surface" was the first content type we homed canonically; Cornerstone 5 generalizes the pattern to API reference, ADRs, glossary, developer guides, integrations, and any future content type.

**Reviewer Gate 10 enforces this.** See `pillars/documentation/gates.md` Gate 10.