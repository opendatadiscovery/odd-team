## ADR-CANDIDATE-066 — Popular ranking is exclusively `view_count DESC` with `id DESC` tiebreaker — single-signal minimalism, no time-decay, no anti-abuse, no signal-mix

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (load-bearing — the home-page recommendation surface)
**Axes present**: controllers, services, repositories
**Surfaced by**:
- `getPopular.md:implicit_adrs[0]` ("Popular ranking signal is `view_count DESC` exclusively — no signal-mixing, no time-decay, no anti-abuse.")

**Decision statement**: The home-page "popular data entities" recommendation strip (`GET /api/dataentities/popular`) ranks entities exclusively by `data_entity.view_count` in descending order, with `data_entity.id DESC` as the sole tiebreaker. There is no time-decay, no per-class weighting, no recency boost, no owner-scoped popularity, no admin curation, no anti-abuse signal. The ranking signal is the same monotone counter incremented on every `getDataEntityDetails` read (read-as-write per `getDataEntityDetails.md:implicit_adrs[2]` from batch F). The architectural decision: "popularity" = cumulative reads, period. The simplest definition possible. Trade-off explicitly accepted: legitimate-interest reads, bot reads, hot-link reads, and scripted-inflation reads all count equally.

**Evidence**:
- `getPopular.md` says: "the explicit `.orderBy(DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC))` builder call paired with the `incrementViewCount` step that the producer half guarantees populates the counter on every read — both halves of the loop are intent-anchored at distinct file:line citations" (`ReactiveDataEntityRepositoryImpl.java:633` + `:173-180`)

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — the orderBy is a deliberate `.orderBy(DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC))` builder call; the producer half (`incrementViewCount` in `getDataEntityDetails`) closes the loop. Two separate methods, one ranking signal, one tiebreaker — the minimalism is the decision.
2. *Structural impact?* YES — affects the home-page first-impression UX, the ranking-signal-hardening surface (every mitigation candidate — sampling, time-decay, owner-scoping, anti-abuse — is structural), and the storage layer (view_count is the sole counter column).
3. *Refactoring or structural?* STRUCTURAL — switching to a multi-signal ranking would require new columns, new aggregation jobs, and a new ranking algorithm.
→ ADR-CANDIDATE.

**Note on split**: the inflation-attack surface (REFACTOR-220 — primary-source-confirmed) is the GAP-shaped consequence — the ADR captures the design choice; the scope captures the missing anti-abuse. The minimalism is intentional; the absence of rate-limit is a refactoring item, NOT a redesign.

**Existing ADR**: none; cross-references `getDataEntityDetails.md:implicit_adrs[2]` (the producer half from batch F).

**Proposed action**: Promote to `adrs/drafts/popular-ranking-signal.md`. The ADR should articulate: (a) the single-signal minimalism, (b) the trade-off accepted (gaming surface), (c) the cross-reference to REFACTOR-220 as the anti-abuse gap, (d) the bootstrap-deployment behaviour (all entities at view_count=0, ranking degenerates to id DESC = "newest").

**Severity rationale**: MEDIUM — pattern-shaping recommendation-surface decision affecting the platform's first-impression for every operator. Worth documenting because every "improve Popular ranking" proposal needs to know the current minimum baseline.

---
