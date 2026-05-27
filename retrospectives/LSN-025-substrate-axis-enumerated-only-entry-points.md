---
id: LSN-025
title: Substrate axis declared but enumerated only the entry-points / shell of its conceptual surface
date: 2026-05-26
domain: methodology / Layer-1 substrate
severity: high
gates_informed: [feedback_reverse_engineering_paradigm.md, feedback_product_owner_lens.md]
status: open
related_lsn: [LSN-023]
---

# LSN-025: Substrate axis declared but enumerated only the entry-points / shell of its conceptual surface

## What happened

Rev 8 (LSN-023) made the UI interaction layer a mandatory substrate axis: *"the user-facing surface is mandatory; a UI-incomplete feature is incomplete."* From rev 8 onward, the substrate carried `ui_routes` (12 nodes — route definitions) and `ui_shell` (13 nodes — app frame + i18n + toolbar widgets). The methodology, the maintainer, and every downstream phase (file-analyser, shoebox-fulfiller, feature-flow-builder Step 0) treated these two axes as **the UI axis** — the box checked, the rule satisfied.

On 2026-05-26 — four days after rev 8 landed, after a 122-thread shoebox harvest produced 36 graduations and 61 merges, after a feature-flow-builder Step-0 pass minted 36 new F-NNN bringing the catalog to 79 — the maintainer asked: *"why are these two specific features still not captured in the ontology?"* The two were the Owner-Association admin triplet (`OwnerAssociationsActive` / `OwnerAssociationsNew` / `OwnerAssociationsResolved` under `/management/associations/*`) and the Data Entity detail-page Overview tab + class-badge widgets.

The diagnosis: the substrate's `nodes.jsonl` had **5 axes covering 395 nodes total** — `controllers` (239), `config_prefixes` (96), `openapi_tags` (35), `ui_routes` (12), `ui_shell` (13). Of those 395 nodes, **25 covered the UI** — the 12 routes + 13 shell. The platform actually ships **~550 React components under `odd-platform-ui/src/components/**/*.tsx`**. The 530 missing components — including the 12 OwnerAssociations files, the 14 per-entity Overview sub-panels, the `EntityClassItem` / `EntityTypeItem` badges, the form / modal / autocomplete trees driving every Management surface — were invisible to **every** downstream layer:

- The file-analyser only enriches nodes the substrate emits; it never received a request to enrich any of these files.
- The shoebox-fulfiller mines sidecars; the missing nodes had no sidecars, so nothing to mine.
- The feature-flow-builder threads chains through substrate nodes; missing nodes appeared (at best) as `unresolved: true` hops; F-075 (User-Owner Association Request Flow) graduated as `status: active` because the agent had no way to know the UI half existed.
- The graph-retriever indexes substrate nodes; queries like *"owner association admin page"* returned no UI hits because there were no UI nodes to retrieve.

The 48 hand-authored UI sidecars under `lineage/odd-platform/understanding/odd-platform__ts__react-component__*.md` were created by maintainer-driven `/enrich` invocations against explicit file paths — **none had a corresponding substrate node**. The methodology had been operating with a parallel, manually-maintained UI-component shadow registry that never appeared in `nodes.jsonl` and was invisible to any tool that read the substrate.

## Why it slipped

Rev 8's text says *"the UI interaction layer is a mandatory substrate axis."* It does not say *"each declared axis must enumerate the conceptual surface, not the entry-points."* That gap is the structural failure:

1. **An axis name implies a surface, but the extractor enumerates a specific definition of that surface.** `ui_shell` extracted directories rooted at `components/shared/elements/AppToolbar` + `components/shared/elements/AppErrorPage` + `src/index.tsx` + `locales/`. `ui_routes` extracted files matching `src/routes/**/*.ts`. Both produce real, valid nodes; neither covers the conceptual category *"the UI interaction layer"* the maintainer reads the axis names as covering. The mismatch between axis name and extractor scope is invisible until someone counts.

2. **Downstream phases trust the substrate.** The file-analyser's contract is "enrich one node"; it has no premise about whether the substrate omitted nodes. The feature-flow-builder's Rule 0b ("a feature is UI-complete or it is not done") fires when a chain has a UI hop and that hop is `unresolved` — but **a missing UI surface produces no chain reference at all**, so the rule never fires. The "ui-incomplete" status check inherits the substrate's blind spot: it can detect a missing sidecar for a known node, but not a missing node for a known conceptual surface.

3. **The 3-5 highest-leverage axis rule** (Section 6 Step 3) was authored as a startup heuristic — get something running, expand on miss. Rev 8 added UI as exempt-from-3-5. But "exempt from triage" did not become "verified for coverage" — the axis got added to the registration list and then assumed to be working.

4. **No coverage probe for the substrate itself.** Probes (Section 7) check whether the substrate handles known categories of capability (i18n bootstrap present? webhook receiver enumerated?); they do not check whether each axis enumerates a representative slice of its conceptual surface. A `ui_shell` axis with 13 nodes and a `ui_components` directory containing 550 files would pass every existing probe and fail every honest read.

5. **The maintainer also missed it.** Reading the manifest on any of the prior 14 batches would have shown `ui_shell: 13, ui_routes: 12` in a repo whose React app has hundreds of components. A senior product owner reading those counts stops and asks. The bar was not held. This is the Linus/senior-PO violation pattern LSN-023 explicitly named.

## The class — beyond UI

This is not a UI-specific failure. The same structural shape applies to any axis the maintainer declares whose extractor enumerates only a sub-slice of the conceptual surface:

| Axis declared as… | Extractor enumerates… | Surface left invisible |
|---|---|---|
| **UI** (today's incident) | route mounts + app shell | components / forms / modals / autocompletes / panels |
| **controllers** | `@RestController` methods | WebSocket handlers, SSE emitters, message-queue listeners, scheduled jobs, WAL processors, gRPC servers |
| **config_prefixes** | `@ConfigurationProperties` classes | scattered `@Value` reads, env-var consumers, system-property fetches, SpEL expressions, framework defaults |
| **tests** (the `test_axis` annotation) | JUnit test files | fuzz harnesses, contract tests, Postman collections, k6/Locust load scripts, Playwright e2e suites, Pact contracts |
| **migrations** | Flyway / Liquibase SQL files | trigger definitions, stored procedures, materialized view refreshes, manual data-fix scripts |
| **scheduled** | `@Scheduled` methods | ShedLock-coordinated jobs, cron containers, sidecar timers, external cron services |

Every one of these is a category where the axis NAME promises a conceptual surface but the extractor only walks a syntactic subset. The substrate appears to cover the surface; downstream phases trust the substrate; the surface stays invisible.

## Rule that emerged

**Every declared axis carries a written conceptual ceiling and is probed for surface coverage at extractor registration time.**

When you register an axis in `lineage/_extractor/`, you also write:
- **Conceptual scope**: one sentence naming the operator-readable category the axis is meant to enumerate. *"Every React component file under `odd-platform-ui/src/components/**/*.tsx` that exports a default React component."*
- **Conceptual ceiling**: a back-of-envelope upper bound for the count the extractor should produce — derived from a `find ... | wc -l` or equivalent, written as a comment in the extractor module and as a field in `manifest.yaml`'s axis block.
- **Coverage probe**: a Type-3.5 probe (`PROBES.md`) that compares the extractor's actual node count to the ceiling. If `nodes_produced < 0.3 × conceptual_ceiling`, the axis is **MISSING** for downstream purposes — not "partially covered" — and the maintainer is notified to extend the extractor or rename the axis to reflect its actual narrow scope.

The 30% threshold is a methodology default, not a mandate; an axis whose conceptual surface is itself sparse (e.g. one CLI entrypoint per project) can declare a lower expected ratio. The point is **the ratio is named**, not "we have an axis for X."

When a feature-flow-builder chain marks a hop `unresolved: true` AND the hop's conceptual surface has a declared axis whose ceiling exceeds the extractor's count, the unresolved hop is a **substrate-coverage gap**, not a missing-sidecar gap. The fix is to extend the extractor (or declare a new axis), not to fire `/enrich` against a node the substrate didn't emit.

## Probe that would have caught it

```
substrate-coverage probe (ui_components):
  conceptual_scope: "Every React component under odd-platform-ui/src/components/**/*.tsx"
  conceptual_ceiling: 553   # find odd-platform-ui/src/components -name '*.tsx' | grep -v __tests__ | wc -l
  nodes_produced:    25     # ui_shell (13) + ui_routes (12) — the union of the two declared "UI" axes
  ratio:             0.045
  verdict:           MISSING  (under 30% threshold; declared axis fails to cover its conceptual surface)
  remediation:       Add a ui_components axis OR rename ui_shell to ui_shell_widgets to reflect actual narrow scope
```

This probe, written for rev 8 when UI was declared mandatory, would have shown the gap on day one. It was not written because the methodology had no rule that a declared axis must be probed for coverage.

## Fixed by

- **APPROACH.md rev 12** — Failure F added to section 2; Rule 20 added; Section 6 Step 3 strengthened with the conceptual-ceiling sub-step; Section 7 extended with Type-3.5 substrate-coverage probes.
- **Concrete first fix** — `lineage/_extractor/src/lineage_extractor/extractors/ui_components.py` added 2026-05-26 (commit `2acd7b7` on `feature/ui-ontology-buildout-2026-05-26`) — 534 new substrate nodes; opens the 530-component blind spot.
- **Backlog** — the same surface-coverage probe shape needs to be run against every other declared axis in this and every adopter project. The five examples table above is the starting checklist.

## What's still load-bearing

- **The 30% threshold is a sensible default, not science.** An axis at 28% is not categorically different from one at 32%; the rule's value is forcing the maintainer to NAME the ceiling and the ratio, not adjudicating the line.
- **A declared narrow scope is fine.** An axis named `ui_route_mounts` covering 100% of route mounts is honest; an axis named `ui_shell` covering 100% of `AppToolbar` + `AppErrorPage` + `index.tsx` is honest. The failure mode is naming an axis after a surface the extractor does not cover.
- **The maintainer's read of the manifest matters more than the rule.** A senior PO reads `manifest.yaml` and notices `ui_shell: 13` on a project shipping a React SPA. The rule cheap-shots the methodology into surfacing the ratio; the operator's judgment closes the loop.
