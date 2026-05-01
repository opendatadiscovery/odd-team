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

These are the specific axes the bar above is measured on. Each is enforced by a Cornerstone (`pillars/documentation/cornerstones.md`), a gate (`pillars/documentation/gates.md`), or both.

- **Structurally clean.** Every page sits at the conceptual depth its content warrants. SUMMARY hierarchy reflects the conceptual tree; convenience-placements are caught at review time. (Cornerstone 2 + Gate 7.)
- **Complete coverage.** Every user-visible code path is described as a feature, a known limitation, a performance note, or a security consideration. Missing coverage in either direction is a finding to log. (Gate 6 — Bidirectional code ↔ doc coverage.)
- **No duplication that shouldn't exist.** Detail content lives in exactly one canonical location; every other mention is a cross-link. (Cornerstone 2 + Gate 1 + Gate 10.)
- **Consistent references.** Every term, alias, repo URL, integration name, config key, API path is traced to its canonical source of truth. Memory and plausibility are not sources. (Gate 9 — Factual claim provenance.)
- **Top-quality topics.** Every topic carries the operator-relevant detail an experienced reader expects: caveats, RBAC, runtime constraints, error/retry behavior, deployment-context defaults. Surface-only descriptions fail the bar. (Gate 3 — Caveats captured + Gate 4 — Consumer-read.)
- **Three audiences in one tree.** Users, operators, and developers (incl. AI) navigate the same source without friction. Configuration is its own audience surface; ADRs are their own surface; canonical homes per content type prevent any audience's content from leaking onto another's surface. (Cornerstones 3, 4, 5.)
- **Live-site verified.** Every change is verified on `docs.opendatadiscovery.org`, not just on local build. Build-time and live-site rendering are not the same system. (Gate 8 — Publishing standards.)

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

- `pillars/documentation/cornerstones.md` — Cornerstones 1-5, the IA constraints
- `pillars/documentation/gates.md` — Doc-pillar gates (specializations of the universal Quality Bar)
- `pillars/documentation/authoring.md` — GitBook authoring rules, Sources-footer, live-verify
- `pillars/documentation/canonical-homes.md` — content-type homing table

The pre-authoring stance check (a five-question cognitive ritual run before each sub-section) lives in `playbooks/pre-authoring-stance.md` after Phase 4; until then, in CLAUDE.md.

## Recent retrospectives that inform this pillar's gates

See `retrospectives/` for the case law, indexed by `LSN-NNN`. Phase 2 of `adrs/drafts/refactor-to-pillar-architecture.md` extracts the canonical cases (attachment ephemeral default, MinIO region unset, dbt wrong repo, S2S fallback cache, Features TOC desync, lookup-tables content homing, SUMMARY IA flat).

## Migration status

This file is the Phase 1 scaffold per `adrs/drafts/refactor-to-pillar-architecture.md`. The bar above is not new — it is what `CLAUDE.md` "Why this is possible now" already encodes — but the Phase 1 refactor makes it explicit at the *pillar* level, where authoring sessions load it. Authoring rules currently live in `CLAUDE.md` until Phase 3 moves them into the sibling files in this directory.