---
id: LSN-006
title: lookup-tables.md acquired a 1300-word API reference section while the canonical API reference page sat empty
date: 2026-04-30
domain: documentation
severity: high
gates_informed:
  - cornerstone-5-canonical-home-per-content-type
  - gate-10-content-type-homing
status: closed
---

# LSN-006: lookup-tables.md acquired a 1300-word API reference section while the canonical API reference page sat empty

## What happened

On 2026-04-30, `docs/lookup-tables.md` shipped with an embedded `## API reference` sub-section containing approximately 1300 words of detailed endpoint tables — operation IDs, paths, methods, request/response schemas, status codes — covering 16 endpoints across four groups. At the same time, `docs/developer-guides/api-reference` (the dedicated page that should have been the canonical home for that content type) sat empty save for a "use Swagger UI" pointer. The same pattern had already shipped on three other feature pages: `odd-platform.md` (DOC-034 data-collaboration API surface, 7 routes across 3 tables), `directory.md` (DOC-047, 4 endpoints), `integration-wizard.md` (DOC-050, 2 endpoints). Four feature pages now carried API-reference content; the canonical home was empty. An operator opening `developer-guides/api-reference` got nothing; a maintainer asking "where do API endpoints live?" had to grep every feature page.

## Why it slipped

Each authoring session asked a local question: "where on this feature page does the API reference content go?" The right global question — "where in the doc tree does *this category of content* live, and should the feature page be linking to that home rather than embedding?" — was never asked. The Quality Bar at the time enforced *no-duplicates* (Gate 1) but the content wasn't duplicated; it was misplaced. There was no rule that said "API reference content has a canonical home, and feature pages link rather than embed." The Sources footer's `Spec:` lines (one per endpoint) were a content-type signal that nobody had been trained to read as such — five `Spec:` lines on a feature page commit means "this is API-reference content, not feature description."

## Rule that emerged

**Cornerstone 5 — One canonical home per content type.** Each recurring content type in the doc product has exactly one canonical home; feature pages link to the home rather than embed. **Gate 10 — Content type homing.** Generalises Gate 1 (same-content duplication) to same-type misplacement: at authoring and review time, name the content type, locate its canonical home, and verify the change is the home or a link to it. The Sources footer's per-claim-class lines double as a content-type signal — `Spec:` indicates API reference, `Config:` / `Config-consumer:` indicate configuration reference, `Lifecycle:` indicates ADR-class content. Both the cornerstone and the gate live in `CLAUDE.md`; Phase 3 of the architecture refactor moves them into `pillars/documentation/cornerstones.md` and `pillars/documentation/gates.md`. DOC-083 was logged as the systemic refactor item to migrate the four pre-existing embeddings to `developer-guides/api-reference`.

## Forcing question

What content type is this sub-section, where is its canonical home, and is this page the home — or should it be linking to one?

## References

- `docs/lookup-tables.md` `## API reference` (the canonical embedding)
- `docs/odd-platform.md` `### API surface` for data-collaboration (DOC-034 — sibling embedding)
- `docs/directory.md` `## API surface` (DOC-047 — sibling embedding)
- `docs/integration-wizard.md` `## API surface` (DOC-050 — sibling embedding)
- `docs/developer-guides/api-reference` (the canonical home that sat empty)
- Backlog item: `backlog/docs/DOC-083.md` (systemic refactor)
- Related: LSN-007 (the sibling 2026-04-30 finding — SUMMARY hierarchy convenience-placements; same root cause: local optimization without holding the global picture)