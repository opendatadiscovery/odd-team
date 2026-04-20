# Decisions Log

Key decisions made during audit and implementation that affect future work.

## Format

### D-{NNN}: {Title} ({date})

**Context**: Why the decision was needed
**Decision**: What was decided
**Consequences**: What this means for future work

---

## Decisions

### D-001: No functional changes during gap-closing (2026-04-20)

**Context**: While auditing and fixing docs/tests/navigation, we'll encounter bugs and improvements. The temptation is to fix them.

**Decision**: This phase focuses ONLY on documentation, tests, code navigation (comments/refactoring without behavior change), and spec alignment. Functional changes are logged as separate GitHub Issues for future prioritization.

**Consequences**: If a scanner or implementer finds a bug, they log it as an Issue reference in the work item but do NOT fix it. This keeps the scope bounded and reviewable.

---

### D-002: Navigation index is the primary audit byproduct (2026-04-20)

**Context**: Scanners will discover hundreds of file locations. This knowledge is valuable beyond individual work items.

**Decision**: Every scanner run MUST update `navigation/domains/*.md` with file paths discovered during the scan. This is not optional — it's the mechanism that prevents future sessions from re-scanning.

**Consequences**: Even if a scanner finds zero gaps, the session is valuable because it enriches the navigation index. Progress on the index should be tracked alongside findings.

---

### D-003: Human review gate before implementation (2026-04-20)

**Context**: AI-generated work items may contain false positives, wrong priorities, or overlapping scope.

**Decision**: The full backlog must be reviewed by a human before any implementation begins. The triager produces candidates; the human approves, rejects, or reprioritizes.

**Consequences**: There is an explicit pause between audit/triage and implementation. No agent should auto-execute work items without approval.
