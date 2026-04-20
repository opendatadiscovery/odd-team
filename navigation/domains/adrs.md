# Architectural Decision Records (stub)

Formalized decisions that constrain how the ODD codebase should be modified.

## Location
- ADRs live in: `odd-team/adrs/` (this repo — they span all repos)
- Draft ADRs: `odd-team/adrs/drafts/` (pending human review)

## Known Decisions (from NOTES.md, to be formalized)
These are stated as principles but not yet formalized as ADRs:
- Backward incompatible changes avoided unless absolutely necessary
- Heavy reliance on PostgreSQL-native implementations
- Multi-repo structure (platform, collectors, spec, integrations)
- Pull-based collectors (scheduled) + push-based integrations (event-driven)
- Spring Boot WebFlux (reactive) for platform backend
- React + Redux Toolkit for platform frontend
- Python + Poetry for collectors ecosystem
- JOOQ for type-safe SQL (not JPA/Hibernate)
- OpenAPI-first API design (contract generates code)
- ODDRN as universal resource naming scheme

## Categories to Reverse-Engineer
- Architecture — framework, repo structure, deployment
- Conventions — naming, patterns, file organization
- Data — schema design, PostgreSQL features, migrations
- Integration — inter-repo contracts, versioning, API design
- Operations — config, deployment, monitoring

## Related Domains
→ all domains (ADRs constrain implementation across every feature)
→ specification (spec is itself a set of architectural decisions)
→ core-packages (shared libraries embody cross-cutting decisions)
