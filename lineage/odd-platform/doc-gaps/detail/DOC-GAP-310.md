---
doc_gap_id: DOC-GAP-310
severity: MEDIUM
category: drift
batch: ZJ
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-09"           # SPA shell — locale switcher is part of the user-cluster
related_features: []
related_doc_gaps:
  - DOC-GAP-020      # Locale Bundle / Multilingual UI missing-page (F-047)
  - DOC-GAP-027      # Locale-bundle CSP / localStorage caveat
  - DOC-GAP-307      # UI-shell canonical doc page absent
  - DOC-GAP-309      # 3 primary-nav tabs missing i18n keys (sibling — same root cause)
related_retrospectives:
  - LSN-019          # ordering-stress class (silent fallback)
  - LSN-001          # operator-trap canonical
  - LSN-011          # doc-product coherence not self-detecting
---

## DOC-GAP-310 — META at the i18n surface — the platform's six locale bundles have drifted (en=418 entries, ch=415, fr=415, es=414, hy=414, ua=414 — 3 to 4 keys per locale are missing relative to the English source); the i18next instance is configured WITHOUT a `missingKeyHandler` / `parseMissingKeyHandler` / `saveMissing` (`i18n.ts:27-31`) — silent fall-through is the default; the natural-keys pattern (417/418 en.json entries have `key === value`) hides the drift; no CI / pre-commit / static-analysis tool validates code-to-resource key parity OR locale-to-locale key parity; until a non-English-locale user encounters a key that exists in en.json but NOT in their locale, the divergence is invisible to maintainers — AND the live `/configuration-and-deployment/odd-platform` page is silent on the entire multilingual-UI surface (F-047 / DOC-GAP-020) so contributors have no doc-side guidance about the maintenance contract; the gap is the structural failure-mode for every future i18n contributor

**Severity**: MEDIUM
**Category**: drift (i18n maintenance-contract drift; no security/data-loss class, but ships silent failure mode to every future contributor of the multilingual UI)

### Surfaced by

- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[1]` ("**Locale-set drift across the six files (HIGH)**: `wc -l` per locale: en=418, ch=415, fr=415, es=414, hy=414, ua=414. Three to four keys exist in en.json but NOT in the other five locales. The natural-keys pattern hides this — the missing entries fall through to English via the `fallbackLng` chain.") **(NEW batch ZJ — en.json sidecar PRIMARY SOURCE)**
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[7]` ("**No `missingKey` event handler is wired in `i18n.ts`; silent failures are the default**: Per the i18n.ts sidecar, `i18n.use(initReactI18next).init({ resources, lng, fallbackLng })` does not configure `missingKeyHandler`, `parseMissingKeyHandler`, or `saveMissing`. A typo in a t() call site, a deleted key, or a key added in code but never added to en.json all produce silent fall-through.") **(NEW batch ZJ)**
- `odd-platform__json__locales_translations__i18n-resource__en.md:tests_coverage_semantic.uncovered_behaviours[0]` ("Every t('...') call site in the SPA has a corresponding key in en.json (the missing-key drift). HIGH criticality: A static-analysis test (or a CI step) enumerating `t\(['\"]([^'\"]+)['\"]\)` across the codebase and checking presence against en.json would catch the 12+ drift cases enumerated below. None exists at the enriched commit.") **(NEW batch ZJ)**
- `odd-platform__json__locales_translations__i18n-resource__en.md:tests_coverage_semantic.uncovered_behaviours[2]` ("Every key present in en.json is also present in every non-English locale file (the localization-completeness drift). HIGH criticality.") **(NEW batch ZJ)**

### Evidence

- `odd-platform-ui/src/locales/i18n.ts:27-31` — verbatim init call: `i18n.use(initReactI18next).init({ resources, lng, fallbackLng });` — NO `missingKeyHandler`, NO `parseMissingKeyHandler`, NO `saveMissing` configured. The default i18next behaviour is to silently return the lookup key on a complete fall-through miss.
- `odd-platform-ui/src/locales/i18n.ts:30` — `fallbackLng: ['en','es','ch','fr','ua','hy']` — the 6-element chain. English first means missing keys in non-English locales fall through to English; but a key missing in en.json AND in every locale resolves to the literal key string.
- `wc -l` on the 6 locale files (per en.json sidecar bugs[1]): `en=418, ch=415, fr=415, es=414, hy=414, ua=414` — 3-4 keys per non-English locale are absent.
- Grep `odd-platform-ui/src/**/*.test.*` (per en.json sidecar gaps): no test references the locale JSON files; no CI step validates key parity.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-26 status **200**: silent on i18n, locales, language selection, translation contributor guide.
- WebFetch `https://docs.opendatadiscovery.org/` (site root) + `https://docs.opendatadiscovery.org/features` 2026-05-26 status **200** (inherited from prior session fetches per i18n.ts sidecar's three-WebFetch attempts on the configuration page, Features hub, and site index): zero i18n references anywhere on the site.
- `odd-platform-ui/src/locales/translations/en.json:381` — the single non-natural-keys entry: `"main search placeholder": "Search data tables, feature group, jobs and ML models via keywords"` — pivots to the natural-keys pattern in 417 of 418 entries; the structural pattern itself is undocumented (no comment, no ADR).

### Drift narrative

The platform's multilingual-UI feature has a maintenance contract — `every t('<key>')` call site has a matching entry in `en.json`, and every non-English bundle mirrors the en.json key set — that is enforced by NOTHING. Four structural mechanisms together produce silent drift:

1. **The natural-keys pattern (`key === value` for 417/418 entries)**: a missing key falls through to the lookup-key string, which is the English label. The English UI accidentally works regardless of contract compliance.
2. **The 6-element fallbackLng chain (`['en','es','ch','fr','ua','hy']`)**: non-English locales fall through to English on a missing key; combined with the natural-keys pattern, every non-English-locale user sees English text for any code-side key the locale doesn't have.
3. **No missing-key handler in `i18n.ts`**: the i18next library has built-in support for `missingKeyHandler` / `parseMissingKeyHandler` / `saveMissing` callbacks that COULD log / warn / persist the drift — these are NOT configured. Silent failure is the chosen default.
4. **No CI / pre-commit / static-analysis gate**: a grep-and-assert script (one-shot Python or shell) enumerating every `t\(['\"]([^'\"]+)['\"]\)` call site and checking presence against en.json + the 5 non-English bundles would catch every drift case. None exists.

The combined effect is that a contributor adding a new `t('New Tab Name')` call site sees the English UI work in development, lands the change, and the bug surfaces only when a non-English user encounters the new tab (which may be weeks or months later). The drift is INVISIBLE to maintainers; the platform's multilingual-UI promise is enforced by trust in contributor discipline.

The locale-set drift today (en=418, others=414-415) is the historical accumulation of this failure mode. The current per-locale missing-key audit is out of scope for this sidecar, but the en.json sidecar's `bugs_limitations_corner_cases[1]` confirms 3-4 keys per non-English locale are missing — a steady-state drift that grows on every uncoordinated commit. Per DOC-GAP-309 NEW (the sibling content-level instance), the three primary-navigation tabs `Data Quality / Data Modelling / Master Data` are absent from ALL six locales (en.json included), a complete-fall-through case where the English UI accidentally works AND every non-English locale shows the English literal.

The doc-product surface compounds the gap: the multilingual-UI feature is unmentioned on the doc site (F-047 / DOC-GAP-020), so contributors have no doc-side guidance about the maintenance contract. A contributor who DOES want to follow the contract has no contributor-guide pointer for: (a) where to add the en.json key first; (b) how to find native-speaker translators for the 5 non-English locales; (c) what the natural-keys pattern is and when to use it (vs the single slug-key exception at `main search placeholder`); (d) how to test the drift before shipping. The methodology is operator-tribal-knowledge.

### Proposed doc action

**Three-part action — code-side + doc-side both apply.**

1. **Code-side PRIMARY** — file `/log-issue odd-platform` for two fixes (both small, both bounded):
   - **(a) Wire a `missingKeyHandler` in `i18n.ts`** — in development mode, log a console.warn (`[i18n] missing key '${key}' for language '${lng}'`); in production mode, persist to a telemetry sink (Sentry / Datadog / a custom `/api/telemetry/i18n-missing` endpoint). This converts the silent failure into a observable signal without breaking compatibility.
   - **(b) Add a CI script** — a grep-and-assert Python or shell script that:
     - Enumerates every `t\(['\"]([^'\"]+)['\"]\)` call site under `odd-platform-ui/src/`.
     - Asserts each enumerated key has a matching entry in `locales/translations/en.json`.
     - Asserts each en.json key has a matching entry in every non-English locale (`es.json`, `ch.json`, `fr.json`, `hy.json`, `ua.json`).
     - Fails the CI on any drift OR posts a comment to the PR enumerating the drift.
     This is the load-bearing fix — the methodology shifts from "trust contributors" to "verify before merge".

2. **Code-side OPTIONAL** — author a one-shot key-parity audit and surface the current locale-by-locale missing-key list (the per-locale 3-4 missing keys per en.json sidecar bugs[1]). Cross-link to DOC-GAP-309 NEW (the 3 primary-nav tabs absent from all 6 locales).

3. **Doc-side COMPANION** — in DOC-GAP-307 NEW's proposed `features/ui-overview.md` page, the "Language selection" section needs a **"Contributing translations"** sub-section:
   - Brief description of the natural-keys pattern ("English-source keys are also the rendered text — `key === value` in 417 of 418 en.json entries")
   - The single slug-key exception at `main search placeholder` (longer placeholder text needs a short key)
   - The 6-element fallbackLng chain semantics ("missing keys fall through to English; if the key is missing in en.json too, the key string is rendered literally")
   - Step-by-step contributor guide: (a) add the key to en.json first; (b) propagate to the 5 non-English bundles; (c) CI will catch missing propagations; (d) for ambiguous translations, defer to native-speaker review.
   - **Locale completeness status table**: list each locale with its current entry count (en: 418, ch: 415, fr: 415, es: 414, hy: 414, ua: 414) and a per-locale completeness ratio; update on every translation PR. Establishes a public commitment to the contract.
   - Cross-link to the locale JSON files in the source repo so contributors can land PRs.

4. **Doc-side STAND-ALONE (if the contributor-guide section feels heavy)** — author a separate `features/multilingual-ui.md` page (or a `developer-guides/contributing-translations.md` page) that homes the contributor-facing detail; the `features/ui-overview.md` page then cross-links to it. Either home works; the maintainer's call.

### Cross-references

- **DOC-GAP-020 + DOC-GAP-027 + F-047** (Multilingual UI / Locale Bundle missing-page) — this finding is the MAINTENANCE-CONTRACT META inside the missing-page surface; the contributor-guide section authoring closes F-047
- **DOC-GAP-309 NEW** (3 primary-nav tabs missing i18n keys across all 6 locales) — this finding is the META; DOC-GAP-309 is the CONCRETE INSTANCE. Same code-side fix (CI key-parity check) closes both.
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — this finding's "Contributing translations" sub-section belongs there
- **DOC-GAP-303** (Activity Feed User-filter LSN-020) — sibling LSN-020 instance at the i18n channel; the natural-keys + no-missing-key-handler pattern enables the drift to ship to every locale uniformly
- **LSN-019 / LSN-020** — the natural-keys silent-fallback is the canonical "silent fallback returns sensible-looking but wrong content" pattern; same drift class as the Search User-filter SQL drift
- **LSN-011** (doc-product coherence not self-detecting) — i18n key parity is a doc-product-class coherence contract; same failure mode (the maintenance contract is enforced by nothing)

### Severity rationale

MEDIUM — the gap is the STRUCTURAL FAILURE MODE for every future i18n contributor; the concrete impact today (per DOC-GAP-309 NEW) is HIGH on the primary navigation, but THIS finding is the methodology behind the symptom. Severity is NOT HIGH because: (a) no security boundary is crossed; (b) the concrete impacts are tracked separately (DOC-GAP-309 NEW for the primary-nav drift; future per-locale audits would surface specific user-facing gaps); (c) the fix is bounded — wire a missing-key handler + add a CI script + document the contract. Severity is NOT LOW because: (a) the failure mode SCALES with every new code-side i18n addition (every new `t(...)` call site is a potential silent drift); (b) the platform CLAIMS multilingual support but ships drift uniformly across all 5 non-English locales; (c) the doc-product surface is silent (F-047), so contributors have no guide; (d) LSN-011-class coherence — the maintenance contract is enforced by nothing and operator-trust compounds downward as drift accumulates.

### Last verified

- 2026-05-26 — en.json sidecar (PRIMARY SOURCE — full Read + `wc -l` analysis per sidecar bugs[1]) at substrate commit 4ec2b20; live WebFetch confirmation on `/configuration-and-deployment/odd-platform` (200, silent on i18n); zero-mention status across `/`, `/features`, `/configuration-and-deployment/*` confirmed via prior session fetches and inherited within LSN-018 stale-probe window.
