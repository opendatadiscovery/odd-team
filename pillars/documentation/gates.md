---
pillar: documentation
file: gates
status: scaffold
populated: phase-3-and-4
---

# Documentation pillar gates

Universal gates live in `CLAUDE.md` (after Phase 4, distilled as PROTOCOL blocks pointing into `playbooks/`). This file holds doc-pillar gates and doc-specific extensions of universal gates.

## Migration status

**This file is currently a Phase 1 scaffold.** Doc Quality Bar gates live in `CLAUDE.md` until Phase 3 + Phase 4 of `adrs/drafts/refactor-to-pillar-architecture.md`.

Phase 3 will move pillar-specific gates:

- Gate 1 — No duplicates (doc-specific application; universal core in `playbooks/duplication-sweep.md`)
- Gate 2 — Synonyms and aliases logged (doc-specific — Terms & Aliases in `main-concepts.md`)
- Gate 3 — Caveats captured (doc-specific application)
- Gate 7 — Layout and completeness (SUMMARY.md sync, in-page TOC sync, IA hierarchy sanity)
- Gate 10 — Content type homing (Cornerstone 5 enforcement)

Phase 4 will introduce doc-specific extensions of universal gates:

- Doc-Gate 4 — Consumer-read pillar extension (SoT classes specific to docs)
- Doc-Gate 5 — Unset-parameter audit pillar extension
- Doc-Gate 6 — Bidirectional code ↔ doc coverage (this gate is largely doc-specific by name; pillar extension defines what "covered" means for a doc claim)
- Doc-Gate 8 — Publishing standards (live-site verification on docs.opendatadiscovery.org)
- Doc-Gate 9 — Factual claim provenance (full SoT table)