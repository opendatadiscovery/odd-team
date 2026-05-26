# SHB-148 — Browser language preference is never consulted; six-locale UI defaults to English on first visit regardless of navigator.language

**Category**: clustering
**Severity**: LOW

## Hypothesis

Operators with Spanish-, French-, Ukrainian-, Armenian-, or Chinese-configured browsers see the ODD Platform UI in English on first visit and must manually open the user menu → gear → choose a language. The i18n bootstrap reads `localStorage('i18nextLng')` and falls back to hardcoded `'en'`; it never consults `navigator.language` / `navigator.languages`. Operators deploying ODD for a non-English-speaking team see English-by-default until every user finds the switcher on every device. The gear menu itself is in English on first visit.

## Evidence

- `odd-platform-ui/src/locales/i18n.ts:20-26` — `defaultLanguage = 'en'`; reads `localStorage.getItem('i18nextLng')` with fallback to default. No navigator.language read anywhere.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:28-33` — write path persists to localStorage only; no API call to a server-side user-profile preference.
- (Cross-ref AppToolbar sidecar bug #7) — same finding: browser language ignored; cross-cultural UX defect noted as MEDIUM-but-not-graduated.
- F-043 covers the multilingual feature surface but does NOT call out the browser-language-discovery gap as a facet.

## Notes

- For a Spanish-speaking SRE who configured their browser in Spanish, the first ODD page they hit is in English; they must navigate a menu in English to find the language switcher. Onboarding friction.
- The fix is one i18next-line: `lng: localStorage.getItem('i18nextLng') || navigator.language?.split('-')[0] || 'en'` — and adding 'en' as the fallback whitelist.
- Server-side user-profile language preference is also absent; clearing browser data / switching device resets to English (already in F-043).
- guess: this gap is invisible to maintainers who deploy in English-speaking orgs; the bug only surfaces in international deployments.

## Next

1. Decide whether to add `navigator.language` autodetect (with locale whitelist) — a one-line change to `i18n.ts:20`.
2. Decide whether to file a feature request for server-side user-profile language preference (multi-device persistence) — likely larger scope.
3. Promote: merge into F-043 as an ENRICHER facet.

## Links

- cluster_with: [F-043, SHB-147]
- merged_into: (open)
- supersedes: []
