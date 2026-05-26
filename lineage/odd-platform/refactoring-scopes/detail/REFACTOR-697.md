## REFACTOR-697 — AppInfoMenu hardcodes four labels in English (`'Documentation'`, `'Slack'`, `'ODD Platform version'`, `'Leave a feedback'`) — bypasses the `useTranslation()` infrastructure already present in the parent AppToolbar; the labels render in English regardless of the user's selected locale

**Severity**: LOW
**Category**: localization-gap / inconsistent-i18n-usage
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-08 Operator Experience — chrome localization]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:bugs_limitations_corner_cases[5]` (LOW) — "Hardcoded `gitbookLink`, `slackLink`, `githubLink`, `reviewLink` (lines 20-23) are NOT translatable; the menu labels 'Documentation', 'Slack', 'ODD Platform version', 'Leave a feedback' (lines 48, 100, 108, 117) hardcode English and bypass the `useTranslation()` infrastructure already present in `AppToolbar.tsx:19`. This is a localisation gap for the four hardcoded surfaces; operator-configured `link.title` values DO render verbatim, allowing operators to localise their own additions."

**Statement**: `AppInfoMenu.tsx` declares four English labels as inline string literals:
- Line 48 (visible on the Project Version row): `'ODD Platform version'`
- Line 100 (Documentation menu item): `'Documentation'`
- Line 108 (Slack menu item): `'Slack'`
- Line 117 (Feedback menu item): `'Leave a feedback'`

None uses the `useTranslation()` hook (`AppToolbar.tsx:19` shows the parent toolbar HAS the hook available). The parent toolbar correctly uses `t('Logout')` and `t('Select language')` from the locale bundles (and the en.json's `'Logout'` + `'Select language'` keys are translated in all six locales). The AppInfoMenu's hardcoded labels are an inconsistency in the chrome's i18n posture.

A French-locale user sees the toolbar's "Logout" translated to "Déconnexion" (assuming the locale has the translation) BUT the App Info menu's "Documentation" / "Slack" / "ODD Platform version" / "Leave a feedback" all render in English. The inconsistency makes the localization feel "half-applied" — five of the chrome's prominent labels are English-only.

The operator-configured links (`link.title` from `/api/links`) DO render verbatim — so operators can ship locale-aware labels in their own additions. The architectural inconsistency: operator-supplied labels are i18n-flexible; first-party labels are i18n-locked.

**Evidence**:
- AppInfoMenu.tsx:48 (`'ODD Platform version'`)
- AppInfoMenu.tsx:100 (`'Documentation'`)
- AppInfoMenu.tsx:108 (`'Slack'`)
- AppInfoMenu.tsx:117 (`'Leave a feedback'`)
- AppToolbar.tsx:19 (uses `useTranslation` for sibling labels) — the contrast that marks the AppInfoMenu's choice as inconsistency
- en.json (no entries for `'Documentation'`, `'Slack'`, `'ODD Platform version'`, `'Leave a feedback'` — these aren't in the key set because they were never wired through t())

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-011 (natural-keys i18next pattern) is the architectural anchor; the contract is "every user-visible string goes through t()". The four hardcoded labels are an unaccounted-for deviation. ADR-CANDIDATE-239 NEW this batch (JSX composition over interpolation) is the sibling architectural choice — the labels would all be eligible for t() with no JSX gymnastics.

**Proposed remedy**: Wrap each of the four labels in `t(...)` and add the keys to en.json + all five non-English locales:

```tsx
// AppInfoMenu.tsx
const { t } = useTranslation();
// ...
<Typography variant='h4'>{t('Documentation')}</Typography>
<Typography variant='h4'>{t('Slack')}</Typography>
<Typography variant='h4'>{t('ODD Platform version')}</Typography>
<Typography variant='h4'>{t('Leave a feedback')}</Typography>
```

```json
// en.json — add natural-keys entries:
"Documentation": "Documentation",
"Slack": "Slack",
"ODD Platform version": "ODD Platform version",
"Leave a feedback": "Leave a feedback",
```

Add translations in each non-English locale (or natural-keys identity entries if the locale chooses not to translate). Effort: 30 minutes for the wiring + 5 minutes per locale for translation/identity.

Composes with REFACTOR-690 NEW this batch (14+ missing keys in en.json) — the natural place to handle this is in the same i18n-completeness sprint.

**Severity rationale**: LOW — affects only non-English-locale users; bounded to four labels in one chrome widget; no functional impact; not a security issue. Bundled here as part of the i18n-completeness baseline.

**Suggested backlog grouping**: `i18n completeness sprint` — couple with REFACTOR-690 (missing keys), REFACTOR-691 (locale-set drift), REFACTOR-692 (Statuses partial), REFACTOR-693 (no missingKey handler). The five together close the i18n-completeness story for the chrome surface.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-690 NEW (missing keys), REFACTOR-691 NEW (locale-set drift); ADR-CANDIDATE-011 (natural-keys pattern — the contract this refactor honors by adding the keys); ADR-CANDIDATE-234 NEW (AppInfoMenu architecture).
- SUPERSEDES: none.
- CONFLICTS: none.

---
