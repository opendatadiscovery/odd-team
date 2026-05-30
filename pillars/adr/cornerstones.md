---
pillar: adr
file: cornerstones
status: active
since: 2026-05-30
---

# Cornerstones — ADR pillar

These are the non-negotiable invariants of the ADR pillar. Every authoring and review decision serves them. They are numbered 1-6 and cited by ID throughout the gates and playbooks.

---

## Cornerstone 1 — Descriptive, not prescriptive

These ADRs are *reconstructed from the codebase*. They document the decisions the code already embodies, for contributors who need to understand WHY before they change anything. They never decree, invent, or claim authority over the core team's architecture.

**What this demands:**
- The voice is "the platform does X because Y, as the code at `<file:line>` shows."
- Provenance is honest: the record describes what the code embodies, not what someone thinks it should do.
- Where intent is inferred rather than stated in code, it is marked as reconstructed, not asserted as fact.

**What violates it:**
- "We must…", "Going forward we will…", or any decree of architecture the core team never ratified.
- A rationale invented to sound authoritative when the code shows no such force.

---

## Cornerstone 2 — Wisdom test before promotion

Only candidates that pass the adr-archaeologist 3-question wisdom test become ADRs: a **deliberate choice with a rationale**, **structural / cross-cutting impact**, **still load-bearing today**. A gap — an absent feature, missing validation, a buggy default — is the *absence* of a choice, not a decision, and never becomes an ADR.

**What this demands:**
- The candidate's `implicit-adrs.md` entry carries a passing wisdom-test verdict (Q1/Q2/Q3 all yes).
- Gaps route to refactoring-scopes / backlog (`DOC-NNN` / `TEST-NNN` / `SEC-NNN` / `PERF-NNN`) or an upstream issue — never the ADR log.

**What violates it:**
- Publishing a missing-feature or buggy-default as though it were a decision (Gate A1 rejects this).

---

## Cornerstone 3 — Code evidence is mandatory

Every published ADR cites the `file:line` that embodies the decision. The audience is developers, so code references are on-topic here — unlike operator docs, where they are noise. The `Evidence` section is the developer-verifiable provenance and feeds the ontology `REALISES` edge.

**What this demands:**
- Every claim in Context / Decision / Consequences traces to a `file:line`, re-verified against the substrate commit at authoring time.
- The `realises:` frontmatter lists the code the decision governs.

**What violates it:**
- A claim that rests on "should be" / "probably" with no citable line (Gate 9 / Gate A2).
- `Evidence` citations that no longer match the current code (the decision is not load-bearing → fails the wisdom test).

---

## Cornerstone 4 — One canonical home

Published ADRs live only at `docs/developer-guides/architecture-decision-log/ADR-NNNN-{slug}.md`, with the log index at `.../architecture-decision-log/README.md`. They are **distinct** from the workspace's internal methodology decisions in `odd-team/adrs/` (those are about the ontology method, not the platform). The two are never conflated.

**What this demands:**
- One ADR per page; one log index that lists them.
- A platform decision goes to the published log; a methodology decision goes to `odd-team/adrs/`.

**What violates it:**
- A platform ADR drafted in `odd-team/adrs/`, or a methodology ADR published to the docs site.
- An ADR's rationale narrated inside a feature page instead of in the log (Cornerstone 5 of the documentation pillar).

---

## Cornerstone 5 — Human ratification; the graph records, never triggers

A candidate becomes a public ADR only when the maintainer ratifies it: `/triage` proposes it → the maintainer approves → `/implement` authors it → `/review` verifies it → the PR merges. The ontology `PROMOTED_TO` edge is recorded *after the fact* from the published ADR's committed frontmatter (`promoted_from:`). It is **never** auto-created from a candidate.

**What this demands:**
- No ADR is published without an explicit maintainer ratification step.
- The extractor reads `promoted_from:` from the merged page to create `PROMOTED_TO`; it does not promote candidates itself.

**What violates it:**
- A pipeline that turns a high-scoring `ADR-CANDIDATE-NNN` into a published ADR (or a `PROMOTED_TO` edge) without a human in the loop.

---

## Cornerstone 6 — Separation of labels

Positive-space `ADR` (ratified, published) and gap-shaped `ImplicitADR` (candidate) stay distinct ontology labels. A regenerated candidate must never overwrite a ratified decision.

**What this demands:**
- The extractor keeps `ADR` and `ImplicitADR` as separate node labels.
- Re-running the adr-archaeologist refreshes candidates only; ratified `ADR` nodes are immutable from that path.

**What violates it:**
- A candidate refresh that mutates or clobbers a published `ADR` node, or collapses the two labels into one.

---

## The cornerstones in one line each

1. Descriptive, reconstructed-from-code — never decreed.
2. Wisdom test before promotion; gaps are not ADRs.
3. Code `file:line` evidence is mandatory.
4. One canonical home; never conflated with `odd-team/adrs/`.
5. Human ratifies; the graph records the edge after the fact, never triggers it.
6. `ADR` and `ImplicitADR` stay separate labels.
