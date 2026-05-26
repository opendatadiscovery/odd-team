## STRENGTHENS — Batch ZJ (2026-05-26 — en.json primary-source quantifies the locale-set drift the chain hides)

Prior REFACTOR-030 framed the six-element `fallbackLng` chain as a buggy deviation from the conventional single `'en'`. Batch ZJ's en.json primary-source sidecar quantifies the consequence: the six locale files have DRIFTED (en=418, ch=415, fr=415, es=414, hy=414, ua=414), and the six-element chain is what HIDES this drift from users — a French user with a missing key falls through to en.json via the chain, so the drift never surfaces in the running UI.

**New surfaced_by entry**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[1]` (HIGH) — "**Locale-set drift across the six files (HIGH)**: `wc -l` per locale: en=418, ch=415, fr=415, es=414, hy=414, ua=414. Three to four keys exist in en.json but NOT in the other five locales. The natural-keys pattern hides this — the missing entries fall through to English via the `fallbackLng` chain. A complete audit (out of scope for this sidecar — see P-170) would enumerate per-locale missing keys; the file-line counts alone surface that the locales have drifted. The structural risk: a contributor adding a new key to en.json today does NOT receive any signal that the other five locales need updating — the natural-keys + fallbackLng + no missingKey-handler combination silently ships a multilingual feature where non-English users see English text intermittently."

- `odd-platform__json__locales_translations__i18n-resource__en.md:implicit_adrs[3]` (MEDIUM) — "English-first fallbackLng ordering with all six locales chained, not the conventional single `'en'`. — evidence: `odd-platform-ui/src/locales/i18n.ts:30` (`fallbackLng: ['en', 'es', 'ch', 'fr', 'ua', 'hy']`)."

**What this strengthening adds**: the prior REFACTOR-030 framing was "the chain is unconventional and may produce unexpected fall-through (Spanish before English under some scenarios)". Batch ZJ adds the QUANTIFICATION: 3-4 keys are actually missing per non-EN locale. The chain's behaviour matters in practice, not just theoretically. The strengthening also surfaces TWO related new scopes:
- REFACTOR-690 NEW this batch (14+ missing keys in en.json itself — code references keys not in any locale, so even English users see the key string for those entries)
- REFACTOR-691 NEW this batch (the cross-locale drift quantified — 3-4 keys per locale, varying which ones)
- REFACTOR-693 NEW this batch (no missingKey handler wired in i18n.ts — the contract "every t() has a matching key" is enforced by NOTHING)

The natural-keys ADR (ADR-CANDIDATE-011) is the architectural anchor; this REFACTOR-030 is the bug-shaped deviation; the new scopes (690/691/693) are the consequence-surfaces the deviation creates.

**Triangulation count after ZJ**: 2 sidecars (was 1 — i18n_ts; ZJ adds en.json primary-source).

**Severity unchanged**: MEDIUM.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-690 NEW (missing keys in en.json), REFACTOR-691 NEW (locale-set drift), REFACTOR-693 NEW (no missingKey handler), ADR-CANDIDATE-011 (natural-keys prescription).
- SUPERSEDES: none.
- CONFLICTS: none.

---
