---
id: adrs/reverse-engineer
target_repo: odd-platform (local) + odd-collectors (local) + all ecosystem repos
scope: Identify implicit architectural decisions from code patterns and formalize as ADRs
estimated_items: 20-40 ADRs to formulate
chunking: By category — one category per session (architecture, conventions, data, integration, operations)
depends_on: [navigation/feature-entry-points]
priority: high
---

## Purpose

The ODD codebase embeds many implicit architectural decisions that are nowhere documented. These decisions constrain how code should be written but are invisible to anyone who hasn't studied the codebase deeply. This scanner reverse-engineers those decisions into explicit ADRs.

## Method

For each category, examine the codebase for patterns that reveal decisions:

### Architecture Decisions
Examine:
- `build.gradle`, `pyproject.toml` — framework and language choices
- Module/package structure — why organized this way?
- `docker/`, `charts/` — deployment architecture choices
- Multi-repo structure — why separate repos vs monorepo?

Questions to answer:
- Why Spring Boot WebFlux (reactive) vs. traditional Spring MVC?
- Why R2DBC + JOOQ vs. JPA/Hibernate?
- Why separate odd-collectors from odd-platform?
- Why monorepo for collectors (4 packages + SDK) but not for integrations?
- Why pull-based collectors vs push-based integrations (both exist)?

### Convention Decisions
Examine:
- Naming patterns in code (class names, method names, package names)
- File/directory organization patterns
- API path conventions
- Database naming (table names, column names, migration naming)
- Git branch naming, commit message patterns

Questions to answer:
- What naming convention do controllers/services/repositories follow?
- What's the pattern for adding a new adapter?
- What's the API versioning strategy?
- What's the database migration naming convention?

### Data Decisions
Examine:
- `db/migration/` — schema design patterns, PostgreSQL-specific features used
- JOOQ usage patterns — what SQL patterns are preferred?
- Data model choices — why certain tables, relationships, indexes?
- Search implementation — how is full-text search done?

Questions to answer:
- Why PostgreSQL specifically (what features depend on it)?
- What PostgreSQL-native features are used (JSONB, arrays, CTEs, etc.)?
- Why JOOQ over JPA? What are the tradeoffs?
- How is data partitioned/organized for multi-tenancy?

### Integration Decisions
Examine:
- Ingress API contract — why this shape?
- Collector SDK architecture — why this abstraction?
- ODDRN format — why this naming scheme?
- Platform API → collector communication — why push/pull?
- Authentication integration — why support multiple providers?

Questions to answer:
- What's the contract between collectors and platform?
- How are breaking changes handled across repos?
- What's the versioning strategy for shared packages?
- Why do standalone integrations exist alongside the collector SDK?

### Operations Decisions
Examine:
- `application.yml` — configuration approach
- Docker/Helm — deployment choices
- CI/CD workflows — what's automated and why
- Monitoring/observability setup

Questions to answer:
- Why these specific config options?
- What's the deployment topology?
- What's the scaling strategy?

## Output: ADR Drafts

For each discovered decision, write a draft ADR to `adrs/drafts/`:

```markdown
---
id: ADR-{NNN}
title: "{Decision}"
status: draft
date: YYYY-MM-DD
category: architecture|conventions|data|integration|operations
---

# ADR-{NNN}: {Title}

## Context
{Why this decision was likely made — inferred from code and constraints}

## Decision
{What the code shows — the pattern/choice that's been made}

## Consequences
{What this enables and constrains — inferred from how code works within this decision}

## Known Issues / Exceptions
{Places where the pattern is violated or causes pain — found during scan}

## Examples
{Specific code locations that demonstrate this decision}
- `path/to/exemplar.java:line` — shows the pattern
- `path/to/exception.java:line` — violates the pattern (note why)

## References
{Git history, Issues, or comments that shed light on the origin}
```

## Findings Output

Write to: `findings/adrs-reverse-engineer/YYYY-MM-DD-{category}.md`

Report:
- Decisions identified
- Confidence level (clear pattern vs. uncertain inference)
- Violations/exceptions found
- Gaps where decision seems inconsistent (may indicate accidental drift)

## Navigation Update

Update `navigation/domains/` files with ADR references where decisions apply to specific features.

## Important Notes

- These are DRAFTS — human review required before accepting
- Mark confidence: HIGH (clear consistent pattern), MEDIUM (mostly consistent), LOW (inferred from limited evidence)
- When uncertain about the WHY, note what you CAN see and flag for human input
- Include counter-examples — places where the decision is violated tell you about exceptions or tech debt
