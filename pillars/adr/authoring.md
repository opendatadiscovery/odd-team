---
pillar: adr
file: authoring
status: active
since: 2026-05-30
---

# ADR pillar authoring rules

The published-ADR page template, the frontmatter schema, GitBook conventions, and the `Sources:` commit-footer format. These are the mechanics; the cornerstones are the WHY and the gates are the floor. Published ADRs are GitBook pages in `../documentation`, so the documentation pillar's GitBook conventions apply in full.

---

## The published ADR page template

```markdown
---
adr_id: ADR-0001
title: "<decision title>"
status: accepted
date: "2026-05-29"
promoted_from: ADR-CANDIDATE-007
realises:
  - "odd-platform: <File.java:120-148>"
superseded_by:
description: "<=200-char GitBook meta description, no colon-space hazard>"
---

# ADR-0001: <title>

## Status

Accepted — 2026-05-29. (One of: proposed / accepted / superseded / deprecated.
If superseded, name the superseding ADR and link it.)

## Context

The forces and situation that shaped the decision, **reconstructed from the code**.
What constraints the platform faced; what alternatives the code structure implies were
available. Descriptive voice — the situation the code reveals, not a mandate.

## Decision

What the platform does, in descriptive voice: "The platform does X — `<File.java:line>`."
State the choice the code embodies, plainly, with the load-bearing detail a contributor
needs to understand it.

## Consequences

The trade-offs the decision carries: what it enables, what it precludes, the known
limitations. Cross-link the related operator / feature doc pages where a reader would go
next. Note any paired refactoring-scope or upstream issue **without printing internal IDs**.

## Evidence

The `file:line` citations that embody the decision — the developer-verifiable provenance,
mirroring the `realises:` frontmatter. One bullet per locus:

- `odd-platform: <File.java:120-148>` — <what this code does that embodies the decision>.
```

Section order is fixed: **Status → Context → Decision → Consequences → Evidence.** The frontmatter schema is the contract in `canonical-homes.md`; Gate A4 verifies it.

---

## GitBook conventions (same as the documentation pillar)

### Links

- Internal links are relative paths to the `.md` file: `[label](../../features/lineage.md)`.
- Never use GitBook's `"mention"` auto-link syntax — it breaks on the live site when the target moves.
- Every internal link resolves to a real file at the committed ref.

### Frontmatter description

- Keep `description` ≤200 chars — GitBook truncates at exactly 200 on the live `<meta>` tag (mid-word, no ellipsis). Target 180 for safety.
- Never put a raw colon-space (`: `) inside an unquoted `description:` value — it reads as a YAML mapping separator and halts GitBook sync entirely. Quote the value, or rephrase. The PyYAML pre-commit + bash fast-fail check apply.

### Page structure

- One `# H1` per page: `# ADR-NNNN: <title>`, matching the SUMMARY label.
- `##` for the five sections; keep the in-page hierarchy shallow.
- Code blocks fenced and language-tagged.

### Live URL slug (the Gate 8 target)

GitBook derives each page's live URL from the **filename stem**, not the H1 title. An ADR file `ADR-0074-pluggable-auth-modes.md` is served at `.../architecture-decision-log/adr-0074-pluggable-auth-modes` — **not** the long H1-derived slug (`.../adr-0074-authentication-is-a-pluggable-mode-selected-by-auth-type-defaulting-to-disabled`). When you record the "Live URL for Gate 8" line in the backlog item, use the **filename-stem** slug; the long H1 slug 404s. (Empirically confirmed across the 2026-05-31 `/review`: every backbone item that recorded an H1-derived URL pointed at a 404, while the filename-stem URL the index actually links resolves.)

### Ship together (Gate 7)

A new ADR ships as **three changes in one commit**: the page (`ADR-NNNN-{slug}.md`), the `SUMMARY.md` entry under Developer Guides → Architectural Decision Log, and the row in the log index `README.md`. A page not in SUMMARY is unreachable; a log index missing the row misleads.

### Audience isolation (Gate 11)

Developer-facing — code refs and odd-platform class names are on-topic. Workspace-internal jargon is **not**: no `ADR-CANDIDATE-NNN`, `REFACTOR-NNN`, `DOC-GAP`, "sidecar", subagent names, or backlog IDs in the rendered prose. The candidate id lives only in `promoted_from:` frontmatter.

---

## The `Sources:` commit footer

Every commit that authors or edits an ADR ends with a `Sources:` footer citing the canonical source of truth for every claim — identical in shape to the documentation pillar, citing the odd-platform `file:line` **at the substrate commit**:

```
Sources:
- odd-platform: S3Config.java:120-148 @ <substrate-commit-sha> (the builder that embodies the decision)
- lineage/odd-platform/implicit-adrs.md ADR-CANDIDATE-007 (the ratified candidate)
- docs.opendatadiscovery.org/developer-guides/architecture-decision-log (the live page)
```

The footer is the provenance trail: a reviewer reads it to re-verify each claim without re-deriving it (Gate A2 / Gate 9). A claim with no citable source is `NOT VERIFIED → log as DOC-NNN`.

---

## The author's checklist (mechanics, not gates)

- H1 is `# ADR-NNNN: <title>`, matching the SUMMARY label.
- Five sections present, in order: Status → Context → Decision → Consequences → Evidence.
- Frontmatter complete (`adr_id`, `promoted_from`, `realises`, `status`, `date`, `description`); `promoted_from` is a real candidate.
- Description ≤200 chars, no colon-space hazard.
- Descriptive voice throughout; no internal IDs in prose.
- `Evidence` mirrors `realises:`; every `file:line` re-verified at the substrate commit.
- Page + SUMMARY entry + log-index row in the same commit.
- Gate 8 URL recorded in the item is the **filename-stem** slug (`adr-NNNN-{slug}`), not the H1-derived long slug.
- Related operator/feature pages cross-linked.
- `Sources:` footer present and complete.

(The full quality floor is in `gates.md`; this is the typing-time checklist.)
