---
id: LSN-023
title: Feature ontology built for a UI product with the UI absent — the operating bar was never written down
date: 2026-05-22
domain: methodology / Layer-4 feature extraction
severity: high
gates_informed: [feedback_reverse_engineering_paradigm.md, feedback_product_owner_lens.md, feedback_linus_torvalds_engineering_bar.md, feedback_record_guidance_immediately.md]
status: closed
---

# LSN-023: Feature ontology built for a UI product with the UI absent — the operating bar was never written down

## What happened

The agentic ontology had run for seven revisions against `odd-platform` — a data-discovery platform whose entire value reaches users through a rich React UI. By batch ZB it had composed 31 "features". The maintainer, looking at the actual product, asked a question the methodology had never asked itself: *do we analyse features with the UI components connected, with the functionality those components provide?*

The answer was no. Of 31 feature flows, 25 were anchored on a `rest:` endpoint, not a user-facing surface. Of 159 enrichment sidecars, 0 covered a form, a modal, or an interactive control — the 19 UI sidecars were all list/detail views. The substrate had `ui_routes` and `ui_shell` axes (route mounts + the app frame) but no axis for the component / form / modal tree. `F-031` ("Data Source Lifecycle Management") was composed entirely from backend `DataSourceController` nodes; its chain recorded the UI hop as `node: ts react-component:datasources-list` with `unresolved: true`, and from that backend-only chain it emitted a confident `permission_side_door` drift finding (REFACTOR-584, DOC-GAP-262): `registerDataSource`'s `namespace_name` field "mints a namespace bypassing `NAMESPACE_CREATE` — escalation by side effect", with a prescribed fix of "a `namespace_id` field so the caller SELECTS an existing namespace."

That finding is wrong. `namespace_name → namespaceService.getOrCreate` is the backend of `NamespaceAutocomplete` — a deliberate, labelled select-or-create combo-box (`odd-platform-ui/src/components/shared/elements/Autocomplete/NamespaceAutocomplete/`): it shows existing namespaces, filters as the user types, and offers "Create new custom namespace «X»" only when nothing matches. It is a UX pattern reused ~7× (the same component for collectors / terms / DEGs; `TagsEditFormAutocomplete` for tags; `OwnerAutocomplete` for owners). The prescribed fix ("SELECT an existing namespace") is contradicted by the actual UI. The methodology had been emitting one false "side-door" finding per backend `getOrCreate` — a whole false-positive class — because it never saw the UX pattern those backends serve.

When first asked to diagnose this, the methodology-runner framed it as "structural frame-blindness — nothing in the methodology had the mandate to question the frame." The maintainer rejected that as the junior engineer's excuse in better vocabulary, and was right to.

## Why it slipped

Not "no one had the mandate." The honest causes:

1. **The methodology was built by accretion, never from a stated bar.** Failures A-E were each patched with a new layer or protocol. The machinery grew sophisticated — including a Layer 4b literally named "top-down product-owner reflection" — but the methodology never stated, ahead of the mechanics, the operating bar all of it was meant to be run under: this is reverse engineering of a user-facing product; the user-facing surface is the primary object; you run every layer as Linus Torvalds and as a senior product owner. With the bar implicit, every layer inherited a backend-first frame — the feature-reflector's eight hypothesis-seed sources are seven-eighths backend-derived (endpoint shape, DTO field names), and its one UI seed ("UI labels") is explicitly conditional on UI sidecars that were never produced.
2. **The operator ran the methodology below the Linus / senior-product-owner bar.** A Linus-level engineer or a senior product owner, handed a substrate that is ~95% controllers / openapi / config for a product whose value is its UI, stops and refuses to proceed — *"where are the screens, the forms, the tables?"* — without needing a written instruction to do so. The bar, held, does not depend on a specific check being named. It was not held.

Both are real. The first does not excuse the second: writing the bar down does not absolve an operator who should have held it unwritten.

## Rule that emerged

`APPROACH.md` section 0 — "The operating stance — non-negotiable" — placed ahead of all mechanics: reverse engineering; the two named identities (Linus Torvalds / senior product owner); the junior's "you never asked me" forbidden; the user-facing surface as the primary object of analysis. Enforced by rules 17-19 (the stance is non-negotiable; the UI interaction layer is a mandatory substrate axis and a UI-incomplete feature is incomplete; UX patterns are ADR candidates), by section 6 Step 3 (the UI axis is mandatory, never triaged away), and by stance clauses written into the `file-analyser` / `feature-flow-builder` / `feature-reflector` / `adr-archaeologist` contracts. Auto-memory: `feedback_reverse_engineering_paradigm`, `feedback_product_owner_lens`, the extended `feedback_linus_torvalds_engineering_bar`, `feedback_record_guidance_immediately`.

## Forcing question

This is a product that humans use. **What does the user see, hold, and do — and have I looked at the actual screens and components, or only at the API?**

## References

- `lineage/odd-platform/feature-flows/detail/F-031.yaml` — the backend-only chain (`chain[0].unresolved: true`) and the wrong `permission_side_door` facet.
- `odd-platform-ui/src/components/shared/elements/Autocomplete/NamespaceAutocomplete/NamespaceAutocomplete.tsx` — the select-or-create combo-box the finding mis-read; reused by `TagsEditFormAutocomplete`, `OwnerAutocomplete`.
- `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/DataSourceForm.tsx` — the "Add datasource" modal that was never enriched.
- `APPROACH.md` section 0; rules 17-19; section 6 Step 3.
- Related LSN: LSN-016 (heuristic substrate, no semantics), LSN-019 (describes-not-interrogates), LSN-020 (no top-down reflection) — the A-E accretion pattern. LSN-023 is the meta-lesson: the pattern needed a stated operating bar, not an Nth layer.
- Auto-memory: `feedback_reverse_engineering_paradigm`, `feedback_product_owner_lens`, `feedback_record_guidance_immediately`.
