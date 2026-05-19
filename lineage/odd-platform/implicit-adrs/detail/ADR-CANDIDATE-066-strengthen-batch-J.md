## ADR-CANDIDATE-066 — STRENGTHENED by batch J (UI-side primary-source: NO client-side analytics; view_count IS the project's usage signal)

This file appends batch-J primary-source confirmations to ADR-CANDIDATE-066 ("Popular ranking is exclusively `view_count DESC` with `id DESC` tiebreaker — single-signal minimalism, no time-decay, no anti-abuse, no signal-mix"). Batch J adds the UI architectural commitment: the project has NO client-side analytics; the server-side view_count counter IS the usage metric.

**Batch J new surfaced_by**:
- `PopularStrip.md:implicit_adrs[1]` (|-
    "**No client-side analytics event on Popular click — the only view-tracking signal is the server-side view_count increment.** The codebase has no Mixpanel / Amplitude / Segment / GA / PostHog integration (grep returned ZERO matches across the entire ui src tree). The Popular tile click is a plain `<Link>` navigation; no `onClick` interceptor emits a separate 'popular-click' event. The implicit decision: 'we don't run a separate analytics pipeline; the server-side view_count counter — which is what Popular ranks by — IS our usage metric.'")
- `PopularStrip.md:doc_drift_findings[2]` (|-
    "**'Popular = most-viewed OR most-used' — the docs are vague where code is precise.** Live doc: 'the most-viewed or most-used data entities across the catalog'. Code: the ranking signal is **exclusively** `view_count DESC`. There is no 'most-used' signal — no usage-frequency counter, no time-weighted usage, no edit-count, no API-call-count, just the singular `view_count` field that increments only on `GET /api/dataentities/{id}`. The 'or most-used' disjunction misleads operators into thinking the ranking blends multiple signals; in reality the ranking is monotonically driven by detail-reads only — an entity that has never been viewed (but is heavily INGESTED, EDITED, ALERTED on, or appears in many lineage walks) has view_count=0 and cannot reach Popular regardless of any other 'use'.")

**Updated support shape**: ADR-CANDIDATE-066 was previously sourced from the backend repository (`listPopular` CTE order-by). Batch J adds:
1. **UI-side architectural confirmation** — ZERO analytics SDKs in the SPA; the maintainer chose to couple usage tracking to the server-side view_count increment rather than maintain a separate analytics pipeline.
2. **Doc-vs-code precision drift** — the live doc uses "most-viewed or most-used" suggesting signal blending; the code is precisely view_count-only. The UI-side sidecar surfaces this drift explicitly.
3. **Coupling to ADR-CANDIDATE-054** (read-as-write) — the single-signal choice composes with the read-as-write choice: every detail-page mount IS the analytics event.

**Co-surfaced gaps newly confirmed by batch J**:
- REFACTOR-220 (existing — view_count inflation loop) — the single-signal architecture amplifies the inflation risk; no defence-in-depth signal
- REFACTOR-221 (existing — no index on data_entity.view_count) — UI consequence: every home-page visit triggers the unindexed sort
- REFACTOR-299 (NEW — Doc-vs-code drift: live doc says "most-viewed OR most-used", code is view_count-only; surfaces as misleading-doc-product finding for the maintainer's editorial pass)

---
