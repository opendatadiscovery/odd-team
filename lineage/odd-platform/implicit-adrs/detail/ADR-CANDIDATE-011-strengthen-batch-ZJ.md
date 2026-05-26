## STRENGTHENS — Batch ZJ (2026-05-26 — en.json primary source confirms the natural-keys pattern verbatim across 417 of 418 entries)

Prior ADR-CANDIDATE-011 was surfaced by the `i18n_ts.md` consumer-side sidecar. Batch ZJ adds the PRIMARY-SOURCE evidence from the canonical English resource bundle (`en.json`) itself, which directly enumerates the 418 entries and quantifies the natural-keys adherence.

**New surfaced_by entry**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:implicit_adrs[0]` (HIGH) — "The natural-keys pattern is the SPA's i18n contract: keys ARE the English source phrase, values mirror the key in the English file. — evidence: `odd-platform-ui/src/locales/translations/en.json:2-419` (417/418 entries have `key === value`) + `odd-platform-ui/src/locales/i18n.ts:30` (the fallbackLng chain implicitly assumes English-phrase keys). — intent_anchor: 'the consistent shape `\"About\": \"About\"`, `\"Accept\": \"Accept\"`, `\"Add\": \"Add\"`, ... across 417 of 418 entries IS the convention' — confidence: HIGH"

- `odd-platform__json__locales_translations__i18n-resource__en.md:implicit_adrs[1]` (HIGH) — "Single exception to the natural-keys pattern: the `\"main search placeholder\"` slug-key (line 381) carries the full placeholder text 'Search data tables, feature group, jobs and ML models via keywords' as its value. This is the one entry that uses opaque-key + descriptive-value (the i18next 'slug keys' pattern)."

**What this strengthening adds**:
1. **Exact tally**: 417 of 418 entries are natural-keys (`key === value`); ONE entry deviates (line 381 `"main search placeholder"`), which is itself a deliberate slug-key choice for a sentence-length placeholder.
2. **The exception is intentional**: the maintainer chose slug-key shape precisely once, for a placeholder where the value is a complete sentence the user reads — keeping the slug short means the t() call site stays readable. This is NOT a violation of the natural-keys convention; it is a deliberate carve-out documented by the convention itself.
3. **Triangulation count**: was 1 (i18n_ts); now 2 (i18n_ts + en.json primary source). Severity unchanged (MEDIUM); confidence raised from MEDIUM to HIGH given direct primary-source evidence.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-030 (`fallbackLng` six-element array — the bug-shaped deviation from English-only fallback that this ADR's natural-keys pattern would otherwise prescribe); REFACTOR-690 NEW (14+ missing keys in en.json — the gap that natural-keys silently masks for English locales but exposes for non-English); REFACTOR-691 NEW (locale-set drift); REFACTOR-693 NEW (no missingKey handler wired).
- SUPERSEDES: none.
- CONFLICTS: none.

---
