---
pillar: adr
file: canonical-homes
status: active
since: 2026-05-30
---

# Canonical homes — ADR pillar

The content-type homing table for the ADR pillar. Cornerstone 4 says published ADRs have exactly one home; this file is that table, plus the ID convention and the ontology-contract frontmatter every published ADR carries. Before authoring, identify the content type and route to its home.

---

## The content-type homing table

| Content type | Canonical home | Notes |
|---|---|---|
| Architecture Decision Record (published) | `docs/developer-guides/architecture-decision-log/ADR-NNNN-{slug}.md` | One ADR per page. Developer-facing; code refs allowed (Cornerstone 3). |
| The decision-log index | `docs/developer-guides/architecture-decision-log/README.md` | Lists every published ADR with id, title, status. |
| Implicit-ADR candidate (source, **not** published) | `lineage/{repo}/implicit-adrs.md` | `ADR-CANDIDATE-NNN` entries from the adr-archaeologist; never on the docs site. |
| ADR backlog work-item | `backlog/adr/ADR-NNNN.md` | The tracked item that authors the page; its ID equals the target ADR id. |
| Gap masquerading as a decision | refactoring-scopes / `backlog/` / upstream issue | `DOC/TEST/SEC/PERF-NNN`; never the ADR log (Cornerstone 2). |
| Workspace methodology decision | `odd-team/adrs/` | Internal, about the ontology method — a **distinct** concept (Cornerstone 4). |

---

## ID convention

- **Published ADRs are `ADR-NNNN`** — 4-digit, zero-padded, assigned sequentially at triage (e.g. `ADR-0001`, `ADR-0002`).
- **The backlog work-item ID equals the target ADR id** — `backlog/adr/ADR-0001.md` authors `ADR-0001-{slug}.md`. One item, one ADR, one commit.
- **The candidate keeps its own id** — `ADR-CANDIDATE-NNN` (from the adr-archaeologist) is the *source*; it is recorded on the published page as `promoted_from:` and is never reused as the published id.

---

## The ontology-contract frontmatter schema

Every published ADR page MUST carry this frontmatter. It is how the extractor projects the `ADR` node and its edges (`PROMOTED_TO` from `promoted_from`, `REALISES` from `realises`, `SUPERSEDED_BY` from `superseded_by`). Gate A4 verifies it is complete and well-formed.

```yaml
---
adr_id: ADR-0001
title: "<decision title>"
status: accepted        # proposed | accepted | superseded | deprecated
date: "YYYY-MM-DD"
promoted_from: ADR-CANDIDATE-NNN   # the implicit candidate (-> PROMOTED_TO edge)
realises:                          # code the decision governs (-> REALISES edges)
  - "odd-platform: <File.java:line-range>"
superseded_by:                     # ADR-NNNN if superseded (-> SUPERSEDED_BY), else omit/empty
description: "<=200-char GitBook meta description"
---
```

- `promoted_from` must name a **real** `ADR-CANDIDATE-NNN` that exists in `implicit-adrs.md` (Gate A4).
- `realises` lists one entry per code locus the decision governs; the same loci appear in the body's `Evidence` section.
- `description` follows the documentation pillar's GitBook rules: ≤200 chars, no raw `: ` colon-space hazard (quote or rephrase).
- `superseded_by` is populated only when a later ADR supersedes this one; setting it should be paired with flipping `status: superseded`.

---

## The three legitimate authoring outcomes

When the Pre-authoring stance check identifies a ratified candidate, exactly one of these is the right move (mirrors the adr-archaeologist classification):

1. **Promote to a new ADR page** — a clean, self-contained decision with no existing ADR (classification `promote` / `unique-load-bearing`). Create `ADR-NNNN-{slug}.md`, add the SUMMARY entry and the log-index row.
2. **Extend an existing ADR** — the decision refines one already published (classification `extend-existing`). Edit that page; do not create a second.
3. **Reconcile a drift** — the code contradicts an existing ADR or a documented claim (classification `drift`). Either supersede the old ADR (new page + `superseded_by` on the old) or correct it, and log any code/doc divergence as a follow-up.

Never: publish a gap as an ADR; invent a decision the code does not embody; auto-create a `PROMOTED_TO` edge without ratification (Cornerstones 2 + 5).

---

## Related

- Cornerstones 2, 4, 5, 6 (the invariants this table serves).
- Gate A4 (ontology frontmatter) and Gate A1 (wisdom-test confirmation).
- `playbooks/pre-authoring-stance.md` (the check that routes to this table).
