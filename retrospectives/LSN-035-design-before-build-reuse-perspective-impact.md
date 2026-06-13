---
id: LSN-035
title: The first complex feature jumped from WHAT to building without designing the HOW — no reuse/ADR scan, no product-owner/SRE lens, no Principal sufficiency review, incomplete impact analysis (i18n). Four gaps, one root cause.
date: 2026-06-13
domain: contributor / implementation-process / methodology
severity: high
gates_informed:
  - playbooks/design-before-build.md (new — the planning HOW-gate: reuse-scan + ADR-check + impact-dimension checklist + product-owner/SRE lens, using the ontology graph + odd-sme that already exist)
  - pillars/contributor/gates.md (G-C12 design-before-build; G-C13 Principal sufficiency review)
  - .claude/skills/contribute/SKILL.md (Phase C design step before GATE 1; the DoD sufficiency check)
  - CLAUDE.md (universal Implementation Quality Bar — design-before-build applies to every pillar's implement phase, not only /contribute)
status: closed
---

## What happened

CTRIB-010 (odd-platform#1657) was the first genuinely complex feature the workspace implemented — a
3-axis activity-filter rework + a reusable UI affordance + dual-name rows + tests + docs + ADRs. It
shipped, but the maintainer's review surfaced a long list of corrections that all trace to the SAME
process shape: **the flow went straight from "what do we want" (scope analysis) to "build it" (the diff),
with no step that designed the HOW.** Four distinct gaps:

1. **No reuse / existing-pattern / ADR scan before building.** I built a NEW `AppPopover`-based
   `InformationHint` component for the inline "(i) more info" affordance — when the platform ALREADY
   ships that pattern (`InformationIcon` in an `AppTooltip`: the Data Entity overview "About" block
   `InternalDescriptionHeader`, Term definitions, the DQ SLA report, the details preview). I also wrote a
   "new" ADR for it instead of reverse-engineering the existing one. The tools to catch this were all in
   hand — the **ontology graph with semantic search** (`/retrieve`), the **source code**, the
   **implicit-adrs** catalogue, the **published ADR-log** — and none were consulted for the HOW. (Memory
   `feedback_search_existing_ui_pattern_before_building`.)
2. **No Product-Owner / SRE lens on the feature shape — and never LOOKING at the rendered result.** I
   designed a "User (Owner)" dropdown and the filter/row model without once asking whether it helps an
   operator (SRE) actually work, whether it is the straightforward shape, whether the dropdown shows what
   a user expects. The maintainer caught the confusing "Owner Name (User Name)" dropdown, the ambiguous
   "bob as Owner test_1" row, AND — worst — an info `(i)` tooltip that rendered with **no background and
   a single unwrapped row of text, barely readable** ("I could not go with it to users"). The e2e
   (IT-129) asserted the tooltip *functioned*; nothing ever *looked at the pixels*. The **`odd-sme`
   subagent** existed and was never consulted, and "verify the running system" (G-C2) checked behaviour,
   not visual quality. Junior formal implementation: it compiled and passed, and was unusable.
3. **No Principal-Engineer sufficiency / control review.** Tests were written and passed, but I never
   stepped back to ask the Principal questions: are there ENOUGH tests? are they MEANINGFUL (do they
   prove stability, not just green)? am I LOSING CONTROL of the codebase? am I HARMING existing
   functionality? The patch-coverage gate (98% on changed files) went red because the new endpoint +
   mapper + threaded params were unit-uncovered — found by the maintainer / CI, not by me.
4. **Incomplete impact analysis (i18n the worst instance).** New user-facing strings went into `en.json`
   only; the platform's six other locales (`br/es/fr/ch/ua/hy`) silently fall back to English. The reflex
   was to "generate a backlog item" rather than handle it. i18n is just ONE impact DIMENSION the analysis
   omitted — the same blind spot would miss the generated FE/BE clients, every consumer of a changed
   signature, a migration, docs, the ontology. The impact analysis had no completeness checklist.

## Why it's the same root cause

The contributor flow's strength is rigor on *correctness of the change* (reproduce-first, verify the
running system, bound the diff, two human gates). Its gap was rigor on *design of the change*. "Plan the
change" (Phase C) named the diff and the tests, but had no mandatory step that: scanned for what to
REUSE, conformed to or proposed an ADR, viewed the feature through the people who use and own it
(PO/SRE), checked test SUFFICIENCY (not just passage), and enumerated the FULL impact surface. We had
every input for a thorough HOW analysis — the ontology, semantic search, the source, the SME — and used
none of it. Building from scratch was the path of least resistance, and nothing in the flow interrupted
it.

## The fix (process)

A single new planning gate — **design-before-build** (`playbooks/design-before-build.md`) — fired AFTER
the WHAT is understood and BEFORE any non-trivial code, plus a Principal sufficiency review at the
Definition of Done:

- **Reuse-scan** — `/retrieve` (ontology semantic search) + targeted grep of the source for an existing
  component/pattern that already serves the need; reuse it, or justify new in one sentence.
- **ADR-check** — consult `implicit-adrs.md` + the published ADR-log for the area; conform to the ADR, or
  if there is an existing/emerging pattern with NO ADR, propose one (reverse-engineered, not invented).
- **Impact-dimension checklist** — i18n (ALL locale files, not en-only-with-backlog), the generated
  BE+FE clients, every consumer of a changed signature/contract, migrations, docs, the ontology. Each
  dimension is addressed-in-this-change or explicitly + traceably deferred — never silently dropped.
- **Product-Owner / SRE lens** — for a feature-shaped change, an `odd-sme`-backed assessment: does it
  help the operator work, is it the straightforward shape, what does a PO/SRE expect by default.
- **Principal sufficiency review (DoD)** — enough + meaningful tests; coverage gate run locally (not
  discovered in CI); no control lost; no existing functionality harmed.

Wired as contributor gates **G-C12** (design-before-build) and **G-C13** (Principal sufficiency review),
into `/contribute` Phase C + the DoD, and as a universal Implementation-Quality-Bar gate in `CLAUDE.md`
so `/implement` benefits identically — the four gaps are not contributor-specific.

## The bar this restores

"Understand before you act" (CLAUDE.md) was honoured for the bug but not for the design. A Principal
engineer decides the HOW — reuse, the right pattern, the user's view, the full blast radius — before
writing code, and uses the analysis tools that exist rather than starting from scratch. This is that
restated as an executable gate.
