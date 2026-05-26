## REFACTOR-693 — `i18n.ts:27-31` declares `i18n.use(initReactI18next).init({ resources, lng, fallbackLng })` WITHOUT `missingKeyHandler`, `parseMissingKeyHandler`, or `saveMissing` — the contract "every t() call has a matching key" is enforced by NOTHING; typos / forgotten keys / locale drift all surface as silent fall-through

**Severity**: MEDIUM
**Category**: missing-validation-signal / silent-failure-by-default
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [ALL — applies to every translated UI surface]

**Surfaced by**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[7]` (MEDIUM) — "**No `missingKey` event handler is wired in `i18n.ts`; silent failures are the default**: Per the i18n.ts sidecar, `i18n.use(initReactI18next).init({ resources, lng, fallbackLng })` does not configure `missingKeyHandler`, `parseMissingKeyHandler`, or `saveMissing`. A typo in a t() call site, a deleted key, or a key added in code but never added to en.json all produce silent fall-through. The methodology to catch this is OUTSIDE the file — a CI step or a static analysis pass; the file itself cannot self-detect omissions. This is the i18next default, not a bug per se — but combined with the natural-keys pattern, it means the contract 'every t() call site has a matching en.json key' is enforced by NOTHING."

**Statement**: The i18next initialization at `odd-platform-ui/src/locales/i18n.ts:27-31` configures only three options: `resources`, `lng`, and `fallbackLng`. Three key options that would surface missing-key drift are NOT configured:

- **`missingKeyHandler(lng, ns, key, fallbackValue)`** — a callback invoked for every missing-key lookup. The platform could log a development warning per missing key (`console.warn('[i18n] missing key:', key, 'in locale:', lng)`) and aggregate the warnings in a development panel.

- **`parseMissingKeyHandler(key)`** — an alternative to the default "return the key string". The platform could return a sentinel like `__MISSING_${key}__` to make missing keys VISIBLE in the UI during development (a glaring debug marker that operators / QA cannot miss).

- **`saveMissing(true) + missingKeyHandler`** — sends missing keys to a backend (`/api/i18n/missing-keys`) for centralized tracking; the platform could collect missing-key reports and surface them in a maintainer dashboard.

Without any of these, the contract "every `t()` call site has a matching key in every locale" is enforced by:
- NOT i18next at runtime (the default is silent fall-through to the key string).
- NOT the TypeScript compiler (the key is a string argument with no compile-time validation).
- NOT a CI step (no static-analysis check exists).
- NOT a code review checkpoint (no convention requires reviewers to grep en.json for new keys).

The result: every drift case (REFACTOR-690 missing-from-all-locales; REFACTOR-691 locale-set drift; REFACTOR-692 partial-translation) ships silently. Only an end-user encountering the missing-key surface in their locale notices.

**Operator-visible impact**:
- A new contributor adds `t('My Feature Title')` in their PR and forgets to update en.json. Build is green, tests pass, PR merges. The UI shipping renders 'My Feature Title' (the key) — works in English by accident, broken in every other locale.
- A typo in a t() call (`t('Slttings')`) renders 'Slttings' in the UI of every locale. No warning.
- A deleted key (a refactor removes the resource entry but the t() call remains) renders the key string. No warning.

The methodology to catch this is OUTSIDE i18next: a static-analysis script that greps `t\\(['\"]([^'\"]+)['\"]\\)` across the codebase and checks presence in en.json + each non-EN locale, integrated into CI.

**Evidence**:
- i18n.ts:27-31 (the init call with only `resources`, `lng`, `fallbackLng`)
- i18next documentation ([i18next.com/overview/configuration-options](https://www.i18next.com/overview/configuration-options)) — enumerates `missingKeyHandler`, `parseMissingKeyHandler`, `saveMissing` as available options.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-011 (natural-keys) is the architectural anchor; the contract is "keys ARE English source phrases". This refactor closes the STRUCTURAL ENFORCEMENT GAP that makes the contract unverifiable in practice. ADR-CANDIDATE-009 (i18n eager-load) + ADR-CANDIDATE-010 (localStorage language pref) + ADR-CANDIDATE-239 NEW this batch (JSX composition over interpolation) are the sister i18n decisions; this refactor adds the missing tooling piece.

**Proposed remedy**: Two-part fix:

**Part A — Add development-mode missing-key warnings**:
```ts
// odd-platform-ui/src/locales/i18n.ts
i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: 'en',  // also fixes REFACTOR-030
  missingKeyHandler: (lngs, ns, key) => {
    if (import.meta.env.DEV) {
      console.warn('[i18n] missing key:', key, 'in locales:', lngs);
    }
  },
  // optional: parseMissingKeyHandler: (key) => `__MISSING_${key}__`,
});
```

Effort: 5 minutes for the warning; 10 minutes if the visible-debug-marker `parseMissingKeyHandler` is added.

**Part B — Add a CI step that fails the build on drift** (couples with REFACTOR-690 + REFACTOR-691 remedies):
- Static-analysis script (Node + jq, or Python + json) enumerates `t('...')` call sites and checks against en.json + each non-EN locale.
- Surfaces missing keys + dead keys as a report.
- Fails the CI build if drift is detected.

Effort: 2-4 hours for the CI script + integration.

**Severity rationale**: MEDIUM — structural enforcement gap; affects every t() call site across the codebase. Not HIGH because the consequence is operator-experience drift (REFACTOR-690/691/692 already track the specific cases), not a security or correctness defect. Not LOW because fixing this scope closes the regression-prevention story for the entire i18n surface — without it, every fix to REFACTOR-690/691/692 has no defence against recurrence.

**Suggested backlog grouping**: `i18n completeness sprint` — couple with REFACTOR-690 / 691 / 692 / 030. This refactor is the regression-prevention piece of the sprint.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-690 NEW (missing keys), REFACTOR-691 NEW (locale-set drift), REFACTOR-692 NEW (partial-translation), REFACTOR-030 (six-element fallbackLng); ADR-CANDIDATE-011 (natural-keys — the contract this refactor would enforce), ADR-CANDIDATE-239 NEW (JSX composition over interpolation — sister decision).
- SUPERSEDES: none.
- CONFLICTS: none.

---
