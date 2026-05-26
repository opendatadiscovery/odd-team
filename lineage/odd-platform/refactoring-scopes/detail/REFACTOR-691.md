## REFACTOR-691 — Locale-set drift across the six locale files: `wc -l` reports en=418, ch=415, fr=415, es=414, hy=414, ua=414 — three to four keys exist in en.json but are absent from each non-English locale; the natural-keys + fallbackLng chain HIDES the drift so non-English users see intermittent English text

**Severity**: HIGH
**Category**: locale-set-drift / silent-fallback / multilingual-feature-ships-broken
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [ALL — every translated UI surface is exposed]

**Surfaced by**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[1]` (HIGH) — "**Locale-set drift across the six files (HIGH)**: `wc -l` per locale: en=418, ch=415, fr=415, es=414, hy=414, ua=414. Three to four keys exist in en.json but NOT in the other five locales. The natural-keys pattern hides this — the missing entries fall through to English via the `fallbackLng` chain. A complete audit (out of scope for this sidecar — see P-170) would enumerate per-locale missing keys; the file-line counts alone surface that the locales have drifted. The structural risk: a contributor adding a new key to en.json today does NOT receive any signal that the other five locales need updating — the natural-keys + fallbackLng + no missingKey-handler combination silently ships a multilingual feature where non-English users see English text intermittently."

**Statement**: The six locale JSON files have diverged in entry count: en=418, ch=415, fr=415, es=414, hy=414, ua=414. The drift means 3-4 keys per non-English locale are MISSING — they exist in en.json but the locale didn't update. The natural-keys pattern (ADR-CANDIDATE-011) + the six-element `fallbackLng` chain (`i18n.ts:30`; REFACTOR-030 bug-shape) means: when a French user encounters a key missing in fr.json, i18next walks the chain → finds it in en.json → renders the English value. The French user sees English text on the specific entries that drifted, while everything else IS in French.

The drift is INVISIBLE to:
- The contributor adding the key (no compile-time check, no CI step).
- The English-locale developer testing the build (everything renders correctly in English).
- The English-locale operator running the platform (same).
- The non-English-locale user, UNTIL they hit one of the missing-key surfaces — at which point they see English text intermittently and the locale feels "half-translated".

The shape suggests: contributors add keys to en.json when adding new features and forget to propagate them. The CI doesn't catch this; the build is green; the multilingual feature ships broken.

This is DIFFERENT from REFACTOR-690 (NEW this batch) which covers keys missing from EVERY locale (including en.json) — code references them but no locale has them, so even English users see the key string. REFACTOR-691 covers keys PRESENT in en.json but MISSING in 1-5 of the non-English locales — English users see correct text; non-English users see English-fallback text.

**Per-locale specifics** (line-count delta from en=418):
- ch.json = 415 (missing 3 keys)
- fr.json = 415 (missing 3 keys)
- es.json = 414 (missing 4 keys)
- hy.json = 414 (missing 4 keys)
- ua.json = 414 (missing 4 keys)

Which specific keys are missing per locale requires a complete audit (probe P-170 in the en.json sidecar — runs a key-set diff). The line-count alone surfaces that the locales have drifted; the specific identification is the remediation step.

**Evidence**:
- `wc -l odd-platform-ui/src/locales/translations/{en,ch,fr,es,hy,ua}.json` produces the 418/415/415/414/414/414 line counts (verified at commit 4ec2b20)
- i18n.ts:30 (`fallbackLng: ['en','es','ch','fr','ua','hy']` — the chain that hides the drift)
- ADR-CANDIDATE-011 (natural-keys i18next pattern — the contract this refactor's gap deviates from)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-011 (natural-keys) IS the architectural anchor. The CONTRACT is "keys ARE English source phrases; the fallbackLng chain ends in English". The REALITY is "the contract holds for keys IN the resource bundle; for keys ABSENT from a locale, the chain SILENTLY substitutes English". The deviation from the contract is the missing keys; the silent-fall-through is the consequence the natural-keys ADR does not document.

REFACTOR-693 NEW this batch is the SHARED ROOT CAUSE: no `missingKeyHandler` / `saveMissing` is wired in i18n.ts. The contract "every t() call has a matching key in every locale" is enforced by NOTHING. Adding the missing-key signal (development warnings; CI step) closes both REFACTOR-690 + REFACTOR-691.

**Proposed remedy**: Two-part fix:

**Part A — Enumerate the drift via probe P-170 + close it**:
1. Run a key-set diff script (Node + jq, or Python + json) that:
   - Reads each locale JSON into a set of keys.
   - Reports the symmetric difference between en.json and each non-EN locale.
2. For each missing key, decide per-locale: add a translation (best UX) OR add a natural-keys entry (mechanical; falls back to English visibly but at least the key is "present").
3. Single locale-completeness PR per locale OR bundled.

**Part B — CI step to prevent regression** (same as REFACTOR-690 Part B):
- Write a script that diffs en.json against each non-EN locale.
- Fail the CI build if drift exceeds a threshold (or zero-drift policy).
- Surface the report in PR diff comments.

Effort: Part A is 4-8 hours (depending on whether translations are added or just natural-keys entries). Part B is 2-4 hours for CI integration.

**Severity rationale**: HIGH — affects every non-English user across an unspecified-but-non-trivial set of UI surfaces. The drift accumulates monotonically with each non-i18n-aware contribution; without remediation the locales drift further apart each release. Operator-impact: erodes localization trust; non-English users feel like second-class consumers of the platform.

**Suggested backlog grouping**: `i18n completeness sprint` — couple with REFACTOR-690 NEW (missing-from-all-locales keys), REFACTOR-693 NEW (no missingKey handler), REFACTOR-030 (fallbackLng chain), REFACTOR-692 NEW (Statuses partial-translation).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-690 NEW (same root cause — no missingKey signal), REFACTOR-030 (chain that hides), REFACTOR-693 NEW (the structural absence); ADR-CANDIDATE-011 (natural-keys — the contract).
- SUPERSEDES: none.
- CONFLICTS: none.

---
