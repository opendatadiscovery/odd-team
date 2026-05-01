---
pillar: documentation
file: authoring
status: scaffold
populated: phase-3
---

# Documentation authoring rules

GitBook-specific rules and the Sources-footer protocol for documentation changes.

## Migration status

**This file is currently a Phase 1 scaffold.** Authoring rules live in the "Documentation Authoring Rules" section of `CLAUDE.md` until Phase 3 of `adrs/drafts/refactor-to-pillar-architecture.md` moves them here.

Phase 3 will move:

- No hand-authored GitBook `"mention"` links — use plain markdown links
- Ship page + SUMMARY.md entry + index/README links together in one PR (cache-fallback failure mode)
- In-page TOCs stay synchronized with H2s in the same commit
- A DOC item is not `done` until the live URL has been WebFetched (handled by `/review`)
- Before authoring, fetch + checkout `origin/main` of the documentation repo
- The `Sources:` footer format (per claim class) — also referenced by the universal `playbooks/claim-inventory.md`