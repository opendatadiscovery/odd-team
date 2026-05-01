---
directory: pillars/_template
purpose: scaffold for new maintenance pillars
---

# Pillar template

Copy this directory to `pillars/{name}/` to bootstrap a new maintenance pillar (e.g., `pillars/tests/`, `pillars/features/`, `pillars/code-quality/`). Each file in this template carries a frontmatter status of `template` and placeholder body text — replace both with the new pillar's content.

## How to start a new pillar

1. **Decide the pillar's scope.** What artefact does the pillar maintain (test code, feature code, ADR drafts, config schemas)? What is its "live surface" (a published site, a green test suite, a working binary)? Write this into `pillar.md` "What this pillar maintains" + "The bar — stated explicitly".

2. **State the bar explicitly.** Per `pillars/documentation/pillar.md` "The bar — stated explicitly", every pillar's bar is the world-class-or-give-up version of its surface. Memory entry `feedback_world_class_doc_mission.md` carries the framing for the documentation pillar; analogous bars for other pillars should be drafted in conversation with the user before the first authoring session.

3. **Author the cornerstones.** Cornerstones are the IA-level constraints the maintainer holds on every change in the pillar. They are upstream of gates. Examples for the documentation pillar (`pillars/documentation/cornerstones.md`):
   - Cornerstone 1 — Discoverability
   - Cornerstone 2 — Aspect deep-dive with single canonical source
   - Cornerstone 3 — Configuration is a separate audience surface
   - Cornerstone 4 — Three audiences, AI-maintained consistency
   - Cornerstone 5 — One canonical home per content type

   For a new pillar, ask: what structural questions arise when authoring? What do reviewers reject changes for? Each recurring rejection is a cornerstone.

4. **List the canonical-homes.** What recurring content types does this pillar produce? Each must have exactly one canonical home; cross-references replace duplication. The documentation pillar's table is `pillars/documentation/canonical-homes.md`.

5. **Author the gates.** Each pillar specialises the universal gates in `playbooks/` and adds pillar-specific gates. Pattern:
   - Universal gates (1, 4, 5, 8, 9 + Pre-authoring stance check) → cite the playbook + add pillar-specific examples and SoT classes.
   - Pillar-specific gates (2, 3, 6, 7, 10 for documentation) → full text + case-law from `retrospectives/`.

6. **Author the authoring rules.** Pillar-specific surface conventions: link semantics, build-system caveats, file-layout conventions, commit-footer formats. The documentation pillar's are `pillars/documentation/authoring.md` (GitBook-specific link semantics + the `Sources:` footer).

7. **Register the pillar in `CLAUDE.md`.** Update the "Pillars and architecture" → "Active pillars" table to add the new pillar's path. Update the "Active pillar — {name}" pointer block if the new pillar replaces or runs alongside `documentation`.

8. **Write a startup retrospective.** Even before incidents accumulate, document the canonical example failure for each gate as the pillar matures. The first 5-10 LSN-NNN files for the documentation pillar were extracted in Phase 2 of the architecture refactor; new pillars should add LSNs as soon as the first failure mode is captured.

## Template files

| File | Purpose |
|---|---|
| `pillar.md` | Mission framing, success criteria, what authoring sessions load. |
| `cornerstones.md` | IA-level constraints (Cornerstones 1..N). |
| `gates.md` | Quality Bar gates — universal-cores cited from `playbooks/` + pillar-specific gates. |
| `canonical-homes.md` | Content-type → canonical-home table. |
| `authoring.md` | Surface conventions for the pillar's primary artefact. |

## Future tooling

A `/start-pillar <name>` skill is planned (`adrs/drafts/refactor-to-pillar-architecture.md` Phase 6 follow-up) to automate steps 1-7 from a conversation with the user. Until that skill ships, the steps above are manual.
