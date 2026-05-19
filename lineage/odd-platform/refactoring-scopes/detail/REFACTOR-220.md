## REFACTOR-220 — `view_count` inflation loop PRIMARY-SOURCE CONFIRMED — home-page Popular ranking trivially manipulable

**Severity**: HIGH
**Category**: missing-rate-limit + missing-defence-in-depth
**Surfaced by**:
- `getPopular.md:bugs_limitations_corner_cases[0]` (the closure of the loop — primary-source confirmation)
- `getPopular.md:security.known_security_gaps[0]` (security restatement)

**Description**: PRIMARY-SOURCE CONFIRMATION of the inflation loop:
- **Producer**: `getDataEntityDetails` (`DataEntityController.java:139-147`) calls `incrementViewCount(id)` (`ReactiveDataEntityRepositoryImpl.java:173-180`) on every read; no rate-limit, no client-id check, no idempotency, no sampling, no per-user cap (per batch-F sidecar).
- **Consumer**: `getPopular` ranks exclusively by `view_count DESC` (`ReactiveDataEntityRepositoryImpl.java:633`, sole orderBy; the `id DESC` at line 963 is only a tiebreaker).
- **Auth posture**: Neither endpoint carries a SECURITY_RULES entry; both fall through to `.pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`); under `auth.type=DISABLED` both are anonymously reachable.

**A scripted loop of N calls to `GET /api/dataentities/{id}` from a single authenticated caller pushes entity {id} to the top of `GET /api/dataentities/popular` after sufficient N.** Under DISABLED (the default), the attacker need not even authenticate. The Popular strip on the platform's home page is therefore a **manipulable first impression** — a malicious caller can promote any entity (including a deceptively-named one — e.g. `"production-database-credentials"`) to the top of the recommendations strip.

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:633` (the sole orderBy: `.orderBy(DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC))`)
- `ReactiveDataEntityRepositoryImpl.java:173-180` (`incrementViewCount` — unconditional UPDATE on every read)
- `DataEntityController.java:139-147` (no rate-limit on the producer)
- `DataEntityController.java:307-313` (no rate-limit on the consumer)
- `SecurityConstants.java:90-355` (no rule on either path — verified by grep returning ZERO matches)
- `DisabledAuthSecurityConfiguration.java:14-17` (anonymous DISABLED-mode access enables unauthenticated inflation)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-066 (NEW THIS BATCH) — Popular ranking is exclusively `view_count DESC` by intentional design. The ADR documents the minimalism. This scope is the missing-anti-abuse layer the ADR explicitly notes the absence of. ADR-CANDIDATE-003 (read-collaborative GET posture) is the cross-cutting prescription this scope inherits — the GET-uniform-authenticated stance does NOT defend against intra-authenticated-tier abuse.

**Proposed remedy**: Layered mitigations, ordered by ROI:
1. **Sampling**: Instead of incrementing on every read, increment with probability 1/N (e.g. 1/100) — preserves rank ordering at scale while raising the cost of inflation 100x.
2. **Per-user-per-entity-per-window cap**: Combine view_count with a `(user_id, data_entity_id, day_bucket)` table or in-memory Caffeine cache. Limit increments to N per user per entity per day.
3. **Time-decay**: Replace `view_count DESC` with `view_count * exp(-age_days * decay_constant)` to reduce the asymmetry between an entity that hit high view-count years ago vs. an entity actively trending now.
4. **Anti-abuse signal**: IP-rate-limit, signed-request, or bot-detection at the controller boundary.
5. **Human-curated override**: An admin-curated "featured entities" list overriding (or supplementing) the algorithmic ranking.

A regression test should: (a) loop 1000 reads on entity X, (b) assert X reaches position 0 in `getPopular`, (c) after mitigation lands, the test should FAIL — confirming the regression is closed.

**Severity rationale**: HIGH — primary-source-confirmed manipulability of the platform's home-page recommendation strip; trivial to exploit; under DISABLED mode (the default), no authentication required; the social impact (a deceptively-named entity promoted to the top of every operator's home page) is reputational at minimum and security-relevant at maximum (e.g., the entity name is a phishing lure).

**Suggested backlog grouping**: SEC-NNN OR PERF-NNN — depending on the chosen mitigation strategy. The sampling fix is PERF; the per-user cap is SEC. Pair with REFACTOR-221 (missing view_count index — same scaling locus) and REFACTOR-222 (EXCLUDE_FROM_SEARCH not applied on Popular).

---
