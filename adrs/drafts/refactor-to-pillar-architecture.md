---
id: ADR-DRAFT-workspace-pillar-architecture
title: "Refactor odd-team workspace to layered pillar / playbook / retrospective architecture"
status: draft
date: 2026-05-01
scope: workspace-meta (this repo's structure, not ODD product code)
---

# ADR-DRAFT: Refactor odd-team workspace to layered pillar / playbook / retrospective architecture

## Context

The `odd-team` workspace has accumulated structural debt as the documentation-sync pillar matured.

**Symptoms (measured 2026-05-01):**

- `CLAUDE.md` is 54k chars / 407 lines — Claude Code surfaces a "large CLAUDE.md will impact performance" warning at 40k.
- `state/PROGRESS.md` is 47.8k tokens / 840 lines — current state, activity log, and ~30 retrospectives mixed in one file.
- `.claude/skills/implement/SKILL.md` (218 lines) and `.claude/skills/review/SKILL.md` (267 lines) restate Quality Bar prose that already lives in `CLAUDE.md`.
- Several auto-memory entries (`feedback_factual_provenance`, `feedback_ia_hierarchy_sanity`, `feedback_world_class_doc_mission`) duplicate framework rules that live in `CLAUDE.md`.

**Two structural failure modes underlie the symptoms:**

1. **Narrative-instead-of-protocol.** Rules in `CLAUDE.md` are written as case-law narratives ("DOC-008 happened, then we added Gate 5, see lookup-tables case…"). Narratives scale linearly with incidents; an autonomous loop cannot execute prose. The implicit decision protocols (trigger → inputs → procedure → exit) are buried.
2. **Pillar baked into framework.** Documentation-specific content (GitBook authoring, Cornerstones 1-5, content-type homing, in-page TOC sync) is woven through `CLAUDE.md`. Activating the next pillar (test coverage, then features) would force a 1.5-2× rewrite of `CLAUDE.md`. The framework does not actually scale across domains; it gets re-derived per domain.

The mission requires the framework to scale. AI-assisted maintenance is the premise that lets a small team hold publishing-quality across docs, tests, features, and code-quality at once. That premise depends on a framework that is parameterizable by pillar, not one that needs to be rewritten when a new pillar activates.

## Decision

Reorganise the workspace around four explicit layers:

```
CLAUDE.md                Universal framework only (~10-12k chars target)
                         identity, mission, phases, universal gates,
                         skill protocol, layout, token budget,
                         pillar registry + boot sequence

pillars/                 One subdirectory per maintenance domain
  documentation/         Current pillar — extracted from CLAUDE.md
    pillar.md            Overview, scope, success criteria
    cornerstones.md      Cornerstones 1-5
    gates.md             Pillar-specific gates + specializations of universal gates
    authoring.md         GitBook + Sources-footer + live-verify
    canonical-homes.md   Content-type homing table
  _template/             Scaffold for the next pillar (Phase 6)

playbooks/               Reusable PROTOCOL-format operational protocols
  consumer-read.md
  unset-parameter-audit.md
  duplication-sweep.md
  pre-authoring-stance.md
  claim-inventory.md
  live-site-verification.md
  follow-up-on-disk.md

retrospectives/          Case law — one file per lesson, LSN-NNN IDs
  LSN-NNN-{slug}.md      what-happened / why-slipped / rule-emerged / forcing-question
  README.md              format + index

state/
  PROGRESS.md            Live state ONLY — counts, in-flight, blocked, recent done
  log/YYYY-MM-DD.md      Daily activity log — the chronological history that PROGRESS.md used to carry
```

**Every gate, playbook, and stance check is rewritten in PROTOCOL format:**

```
PROTOCOL <name>
  trigger:    what causes this protocol to fire
  inputs:     what information the operator brings in
  procedure:  numbered steps, executable
  exit:       the verifiable end-condition
  on-fail:    what to do if exit cannot be reached
  case-law:   LSN-NNN references to the retrospectives that justify the rule
```

PROTOCOL is what an autonomous loop can execute. Narrative is what an autonomous loop has to paraphrase. Case-law belongs alongside, not embedded.

## Consequences

**Easier:**

- Adding a new pillar (tests, features, code-quality) is a scaffold + content-authoring task, not a CLAUDE.md rewrite. The framework grows ~0% per pillar; only the pillar pack is new.
- Loading context for a session becomes O(active pillar) — `CLAUDE.md` (~10k) + `pillars/{pillar}/` (~10-15k) instead of one 54k file regardless of session intent.
- Lessons stay searchable by ID. Each retrospective answers a single question; gates cite by `LSN-NNN`; no more grepping `CLAUDE.md` for "MinIO" to find the case-law on Gate 5.
- Skill files become orchestrators (`run playbook X then Y`) rather than re-statements. One source of truth per rule.
- `state/PROGRESS.md` becomes bounded by definition. Activity history moves to `state/log/`.

**Harder:**

- More files, more cross-links to keep current. Mitigation: each gate ↔ playbook ↔ retrospective link is bidirectional; lint script can verify (out of scope here, future).
- Onboarding a new contributor now requires reading `CLAUDE.md` plus the active pillar's `pillar.md`. Net: the same total content, organised — but two reads instead of one.
- A stale pillar pack is a silent failure mode: a session could miss pillar gates if the pillar pack isn't loaded. Mitigation: `CLAUDE.md` carries an explicit "Pillars index" listing each pillar's `pillar.md` and asserting that authoring sessions MUST load the active pillar before authoring. Skill `/orient` enforces this.

**Neutral but noted:**

- One-pillar overhead. Right now there is only `documentation`. Building pillar infrastructure for one pillar is overhead. We accept the overhead because the next pillar's marginal cost goes to zero, and the user has explicitly requested scaling.

## Known Issues / Exceptions

- **`NOTES.md` is out of scope.** User-authored brainstorming and not part of the framework hierarchy; preserved as-is.
- **Auto-memory cleanup is Phase 6.** Memory entries that duplicate framework rules become redundant once the framework is reorganised, but trimming them is deferred until the framework refactor is stable. Until then, memory and framework will briefly carry overlap; the framework wins on conflict (memory says "see CLAUDE.md X", but X has moved → trust the file system, update the memory).
- **No retroactive PR rewriting.** Past PRs and commits keep their original `Sources:` and `Consumer-read:` footers; new commits use the post-refactor format.
- **PROGRESS.md history is preserved, not rewritten.** Phase 2 extracts retrospective writeups to `retrospectives/LSN-*.md` files; the PROGRESS.md sections collapse to 1-line links. The chronological log moves to `state/log/`. Nothing is deleted.

## Examples

**Before — narrative gate (current `CLAUDE.md` Gate 4 excerpt):**

> "Every claim a doc makes about runtime behavior must be traced to the code that enforces it. You do not write the claim from the YAML file or from a feature's PR description — you write it from the consumer code. (~3 paragraphs of prose + DOC-008/MinIO case study.)"

**After — protocol playbook (`playbooks/consumer-read.md` shape):**

```
PROTOCOL consumer-read
  trigger:  any factual runtime claim about config, SDK, feature, or error behavior
  inputs:   claim text, claim class
  procedure:
    1. Identify SoT class (config / SDK / feature / error / spec / lifecycle / dep)
    2. Fetch SoT to working set per claim class
    3. For SDK class: also run playbook unset-parameter-audit
    4. Compose Sources: footer line per claim
    5. If SoT cannot be cited in <60s, mark item blocked
  exit:     every claim has a Sources: footer line citing a verifiable SoT
  on-fail:  drop claim or mark item blocked, never paraphrase from memory
  case-law: LSN-001 attachment-ephemeral, LSN-002 minio-region
```

The pillar then adds *its* extensions in `pillars/documentation/gates.md`:

```
DOC-GATE 4-doc — Consumer-read for documentation pillar
  inherits: playbooks/consumer-read.md
  pillar additions:
    - SoT class "spec" must include OpenAPI fragment line range
    - SoT class "lifecycle" requires release notes + grep of current main
    - All claim classes must produce a Sources: footer line in the commit body
```

## Phasing

| Phase | Goal | Independently shippable |
|---|---|---|
| 0.5 | This ADR draft | Yes |
| 1 | Empty scaffold + forward-declaration in CLAUDE.md | Yes |
| 2 | Extract retrospectives from CLAUDE.md + PROGRESS.md | Yes |
| 3 | Move doc-pillar content from CLAUDE.md to `pillars/documentation/` | Yes |
| 4 | Distill universal gates to PROTOCOL playbooks | Yes |
| 5 | Slim skill SKILL.md files into orchestrators | Yes |
| 6 | Pillar template + memory cleanup | Yes |

Each phase is one commit on `feature/refactor-pillar-architecture`. The branch may ship as one PR or be split into per-phase PRs at the user's discretion.

## References

- 2026-05-01 conversation establishing the architecture and decisions
- `CLAUDE.md` (current, pre-refactor — to be sized down)
- `state/PROGRESS.md` (current, pre-refactor — to be split)
- `.claude/skills/{implement,review,scan}/SKILL.md` (current, pre-refactor — to be slimmed in Phase 5)
- `MEMORY.md` (auto-memory index — Phase 6 trim)

## Open follow-ups (out of scope for this refactor)

- Lint script that verifies bidirectional cross-links between gates ↔ playbooks ↔ retrospectives.
- `/start-pillar <name>` skill that scaffolds from `pillars/_template/` (Phase 6 introduces the template; the skill can come later).
- Tests pillar activation (separate ADR when triggered).
- Features pillar activation (separate ADR when triggered).