# SHB-147 — i18next fallbackLng walks all six locales before reaching English, occasionally surfacing Spanish or Chinese to non-English users

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators in non-English locales occasionally see Spanish or Chinese phrases mixed into otherwise-French/Ukrainian/Armenian UI because `fallbackLng` is configured as the full six-element array `['en','es','ch','fr','ua','hy']` rather than the conventional `'en'`. When a key is missing in the user's active locale, i18next walks this array in order — so a French user with a missing key tries Spanish FIRST, then Chinese, before finally landing on English. Three tab labels (Data Quality / Data Modelling / Master Data) are missing in ALL six locale bundles, so every non-English user sees the English literal for those — but for ANY key present in es.json / ch.json but absent in fr.json / ua.json / hy.json, the user sees Spanish or Chinese mid-page.

## Evidence

- `odd-platform-ui/src/locales/i18n.ts:30` — `fallbackLng: ['en', 'es', 'ch', 'fr', 'ua', 'hy']` (the full six-locale array, in alphabetical order).
- `odd-platform-ui/src/locales/translations/en.json` — natural-keys pattern: `"About": "About"`, `"Accept": "Accept"` — so missing-keys in non-English files fall through to the literal English source.
- (Cross-ref ToolbarTabs sidecar bug #1) — three tab labels (`'Data Quality'`, `'Data Modelling'`, `'Master Data'`) are absent from EVERY non-English locale bundle (en.json, es.json, ch.json, fr.json, ua.json, hy.json) — operator-visible mixed-language strip for every non-English user.
- F-043 already covers "silent missing-key fallback to natural-keys English" but does NOT enumerate the cross-locale walk side effect; this thread is the ENRICHER that names that subtlety.

## Notes

- The intended-conventional config would be `fallbackLng: 'en'` (single locale). The current array form is almost certainly an oversight from a contributor who mistook `fallbackLng` for `supportedLngs`.
- The likelihood of seeing Spanish-in-French is low but nonzero — a key present in es.json but absent in fr.json triggers it. Worth a diff: which keys are present in es.json but absent in fr.json?
- This is an ENRICHER for F-043 (Multilingual UI). The feature-flow-builder should fold this thread's fallback-chain detail into F-043's facet list.
- guess: there is no JSON-key-completeness CI check; missing keys land silently across releases.

## Next

1. Diff `es.json` vs `fr.json` / `ua.json` / `hy.json` to enumerate keys present in es but absent in others — the live attack surface for cross-locale surprise.
2. File a backlog item to change `fallbackLng: ['en','es','ch','fr','ua','hy']` to `fallbackLng: 'en'` — one-line trivial fix.
3. Add a CI check (script) that asserts every non-en locale has every key present in en.json.
4. Promote: merge into F-043 as the "fallback-chain misuse" facet.

## Links

- cluster_with: [F-043]
- merged_into: (set when graduated)
- supersedes: []
