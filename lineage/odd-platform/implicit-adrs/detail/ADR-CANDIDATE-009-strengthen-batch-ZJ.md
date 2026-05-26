## STRENGTHENS — Batch ZJ (2026-05-26 — en.json primary source confirms the static-bundle decision)

Prior ADR-CANDIDATE-009 was surfaced by the `i18n_ts.md` consumer-side sidecar. Batch ZJ adds the primary-source perspective: the en.json sidecar quantifies the static-bundle cost (~21 KB raw / ~5-8 KB gzipped per locale; ~120 KB raw / ~30-50 KB gzipped across all 6 locales) and confirms the resource shape (418 flat entries, no nesting, no interpolation placeholders) is stable across the static import path.

**New surfaced_by entry**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:dependencies_semantic.requires-feature[0]` ("i18next runtime + the canonical English source bundled into the main JS chunk via `import en from './translations/en.json'` at `odd-platform-ui/src/locales/i18n.ts:3`")
- `odd-platform__json__locales_translations__i18n-resource__en.md:performance.resource_allocation[0]` ("418 entries × ~25 bytes average key/value pair = ~21 KB raw JSON; gzipped in the main bundle ~5-8 KB. The six locales together total ~120 KB raw, ~30-50 KB gzipped.")

**What this strengthening adds**: prior coverage was the i18n.ts boot file declaring the static import. Batch ZJ adds the per-bundle size measurements that anchor the trade-off the ADR records (bundle bandwidth traded for startup determinism + zero-network locale switch).

**Triangulation count**: was 1 (i18n_ts); now 2 (i18n_ts + en.json primary source). Severity unchanged (MEDIUM).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-011 (natural-keys; batch ZJ strengthens both for the same i18n architectural posture).
- SUPERSEDES: none.
- CONFLICTS: none.

---
