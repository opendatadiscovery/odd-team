---
pillar: documentation
status: active
since: 2026-04-16
---

# Documentation pillar

## The bar — stated explicitly

**We are building a documentation product that possibly does not yet exist for any open-source project.** Not "good open-source docs", not "better than most projects", not "good enough for now." A super-clean structure where every aspect of the implementation is covered, no redundancy that shouldn't exist, every cross-reference consistent, every topic at top quality. The kind of manual an operator finishes and trusts — and the kind of manual a contributor (human or AI) navigates without rediscovery cost.

That bar was infeasible at this scale before AI-assisted maintenance. Holding "no duplicates, every alias logged, every caveat captured, every cross-link bidirectional, every claim traced to its canonical source of truth, every page placed at the conceptual depth it warrants, every content type homed exactly once" required a dedicated technical-writing team most projects could not afford. It is feasible now: Claude Code, the Quality Bar gates, the navigation index, the Sources-footer discipline, the playbooks in this workspace make consistency cheap enough to be the default.

**There is no middle ground.** "Good enough" documentation drifts the moment the next session forgets which page already covers a topic, which alias was already registered, which caveat was already captured. Drift compounds. Six months of "good enough" produces docs that lie to the operator who Googles their way to us. The choice is to hold the bar, or to give up and stop developing — there is no third option that makes ODD worth maintaining.

Every change in this pillar either holds that bar or proves the bar wasn't real. The maintainer's pride — not rule-compliance, not "the SKILL said so" — is the mechanism that holds it.

## What this pillar maintains

`https://github.com/opendatadiscovery/documentation` (local: `../documentation`), published at `https://docs.opendatadiscovery.org`. The site is a navigation panel for users to grasp the platform without prior context, plus a deep-dive reference for operators and developers, plus the canonical surface for AI agents reasoning about the system. Three audiences, one source tree, no friction between them.

## Concrete quality criteria

The bar above is operationalised as **twelve doc-quality axes** in `pillars/documentation/quality-framework.md`. Each axis carries a positive specification of what world-class docs require, a PASS shape, derived failure shapes, and an audit cue. The framework also defines two execution modes: a **per-page systematic audit** the reviewer walks for every page (axes 1-10, 11-forward, 12) and a **code-side coverage sweep** for the reverse direction (axis 11-reverse — features implemented but never documented).

The twelve axes:

1. **Canonical-home discipline** — every content type has exactly one home; pages link rather than embed. (Cornerstones 2 + 5.)
2. **Intra-page coherence** — a single page does not repeat itself; glossary tables carry alias-only pointers, not full re-definitions. (DOC-114 case-law.)
3. **Cross-page coherence** — same fact, same answer, everywhere; concepts named consistently. (LSN-004 case-law.)
4. **Reference integrity** — every link's text matches its target; every anchor resolves; no redirect chains; no commit-pinned URL rot. (DOC-101, DOC-102, DOC-110 case-law.)
5. **Claim provenance** — every claim traces to a named SoT; no banned phrases. (Gate 9 — `pillars/documentation/gates.md`.)
6. **Operator depth** — every operator-relevant default, caveat, RBAC rule, retry/timeout, side-effect, performance and security consideration is captured. (Gates 3 + 4; LSN-001, LSN-002 case-law.)
7. **Reader-flow integrity** — getting-started flows complete; "see X for details" delivers; admonitions point at fix-paths. (DOC-105, DOC-107 case-law.)
8. **Vocabulary consistency** — terms used per the alias registry; aliases registered; ambiguities disambiguated. (Gate 2; LSN-004 case-law.)
9. **Audience completeness** — every feature on every audience surface (user / operator / developer) where its audience needs it. (DOC-091 case-law.)
10. **IA placement** — page sits at the SUMMARY depth its conceptual depth warrants. (Gate 7; LSN-007 case-law.)
11. **Bidirectional code↔doc fidelity** — both directions: doc claims are true and complete (forward); implemented features are documented on every surface that needs them (reverse). (Gate 6; LSN-001/002/010 case-law.)
12. **Prose and rendering** — one voice; no typos, broken markdown, escaped artefacts, mixed indentation. (DOC-111, DOC-112, DOC-113 case-law.)

Coverage is measured against `(pages × axes) + (code-features × audience-surfaces)` so progress has a denominator. The audit dashboard lives at `state/doc-quality-coverage.md`.

## Success signals

- An operator runs the install steps, gets a working ingestion pipeline, goes home that day. Becomes an advocate.
- A new contributor (human or AI) finds the file they need without grepping the codebase — the navigation index pointed them there.
- A user Googles a precise question and lands on an answer that is current, complete, and cross-linked to the next thing they'll need to know.
- A maintainer six months from now reads a caveat we shipped and trusts it without re-deriving it from code.

## Failure signals

- An operator follows our guidance off a cliff because a default was undocumented (LSN-001 attachment ephemeral default; LSN-002 MinIO region unset).
- A user reports the same question twice because the answer drifted between two pages (LSN-006 lookup-tables content homing).
- A future maintainer has to grep the codebase to answer a structural question because navigation is incomplete.
- A reviewer rationalises a missing source as "defensible" or "probably correct" instead of citing the canonical SoT (Gate 9 banned phrases).

## What authoring sessions in this pillar must load

Beyond the universal framework in `CLAUDE.md`, every authoring session in this pillar loads:

- `pillars/documentation/quality-framework.md` — the twelve doc-quality axes + per-page audit + code-side coverage sweep procedures
- `pillars/documentation/cornerstones.md` — Cornerstones 1-5, the IA constraints
- `pillars/documentation/gates.md` — Doc-pillar gates (specializations of the universal Quality Bar)
- `pillars/documentation/authoring.md` — GitBook authoring rules, Sources-footer, live-verify
- `pillars/documentation/canonical-homes.md` — content-type homing table

The pre-authoring stance check (a five-question cognitive ritual run before each sub-section) lives in `playbooks/pre-authoring-stance.md` after Phase 4; until then, in CLAUDE.md.

## Recent retrospectives that inform this pillar's gates

See `retrospectives/` for the case law, indexed by `LSN-NNN`. Phase 2 of `adrs/drafts/refactor-to-pillar-architecture.md` extracts the canonical cases (attachment ephemeral default, MinIO region unset, dbt wrong repo, S2S fallback cache, Features TOC desync, lookup-tables content homing, SUMMARY IA flat).

## Migration status

This file is the Phase 1 scaffold per `adrs/drafts/refactor-to-pillar-architecture.md`. The bar above is not new — it is what `CLAUDE.md` "Why this is possible now" already encodes — but the Phase 1 refactor makes it explicit at the *pillar* level, where authoring sessions load it. Authoring rules currently live in `CLAUDE.md` until Phase 3 moves them into the sibling files in this directory.