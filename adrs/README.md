# Architectural Decision Records

ADRs capture the WHY behind implementation choices across the ODD ecosystem. They serve as:

1. **Context for new changes** — before modifying code, check if an ADR explains why it's built that way
2. **Guard against accidental regression** — knowing the constraint prevents unknowingly violating it
3. **Onboarding** — new contributors (human or AI) understand the reasoning, not just the code

## ADR Format

```markdown
---
id: ADR-{NNN}
title: "{Decision Title}"
status: accepted | superseded | deprecated
date: YYYY-MM-DD
superseded_by: ADR-{NNN}  # if status is superseded
---

# ADR-{NNN}: {Title}

## Context
What is the issue that we're seeing that motivates this decision or change?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or harder as a result of this decision?

## Known Issues / Exceptions
- Where does this decision NOT apply?
- What are known pain points or technical debt from this decision?
- What workarounds exist?

## Examples
- Code locations that exemplify this decision
- Counter-examples (places that violate it and why)

## References
- Related ADRs
- Issues that motivated this decision
- PRs that implemented it
```

## How ADRs Are Created

### Phase 1: Reverse-Engineering (current)
The `scanners/adrs/reverse-engineer.md` scanner examines the codebase to identify implicit architectural decisions and formulates them as explicit ADRs. These are reviewed by a human before acceptance.

### Phase 2: Living Documentation
During implementation of new changes:
- Check existing ADRs for relevant constraints
- If a new decision is made that isn't covered → create a new ADR
- If an existing ADR is invalidated by the change → update status to `superseded` and create replacement

## ADR Categories

- **Architecture** — system structure, repo organization, framework choices
- **Conventions** — naming, code style, patterns that must be followed
- **Data** — schema design, migration strategy, storage choices
- **Integration** — how repos interact, API contracts, versioning
- **Operations** — deployment, monitoring, configuration approach

## Using ADRs

### Before implementing a change:
1. Read `navigation/domains/{feature}.md` to find the relevant code
2. Check `adrs/` for any decisions that constrain the area you're changing
3. If your change would violate an ADR, either:
   - Adjust your approach to comply, OR
   - Propose superseding the ADR (with justification)

### After implementing a change:
- If you made a decision that future developers need to know → write an ADR
- If you discovered an implicit decision in the code → formalize it as an ADR
