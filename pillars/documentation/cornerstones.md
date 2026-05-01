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