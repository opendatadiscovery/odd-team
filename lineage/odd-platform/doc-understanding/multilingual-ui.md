---
doc_page: "docs/multilingual-ui.md"
page_title: "Multilingual UI"
live_url: "https://docs.opendatadiscovery.org/features/multilingual-ui"
live_url_verified_status: "200"
live_url_resolved_slug: "features/multilingual-ui"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Locale Bundle", "Switch UI Locale", "Locale-set parity drift — en=418 vs others=414/415; non-English locales silently fall back to English on 3-4 keys", "i18n missing-key drift — 14+ code-referenced keys absent from all six locales; natural-keys pattern + no missingKey handler ships silent fallback"]
  features: ["F-043"]
  code_nodes:
    - "odd-platform ts locales ui-shell-bootstrap:i18n.ts"
    - "odd-platform ts components/shared/elements/AppToolbar ui-shell-widget:SelectLanguage"
    - "odd-platform json locales/translations i18n-resource:en"
    - "odd-platform json locales/translations i18n-resource:es"
    - "odd-platform json locales/translations i18n-resource:ch"
    - "odd-platform json locales/translations i18n-resource:fr"
    - "odd-platform json locales/translations i18n-resource:ua"
    - "odd-platform json locales/translations i18n-resource:hy"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page §'How users switch' (and the intro) claims the locale switcher is a 'gear icon on the top-right of the toolbar' that opens a 'Select language' widget; code shows the switcher is a menu item INSIDE the user-account dropdown of AppToolbar, not a standalone gear icon — evidence: SelectLanguage understanding ('a menu item inside the user-account dropdown of AppToolbar') + audiences ('entry point is the user-account menu in the top-right toolbar') / odd-platform ts components/shared/elements/AppToolbar ui-shell-widget:SelectLanguage; operation:switch-ui-locale ('User-driven language switch from the AppToolbar user-menu'). An operator following the page would look for a gear icon that the code does not place on the toolbar."
  - "Page §'How to contribute a new locale' steps 2-3 say to edit i18n.ts (imports + resources + fallbackLng) AND SelectLanguage.tsx; code shows SelectLanguage needs NO edits (it iterates i18n.languages at line 48) and the actually-required additional files are lib/constants.ts LANGUAGES_MAP + LANG_TO_COUNTRY_CODE_MAP — evidence: i18n.ts coupling-notes ('Adding a locale is a three-file change: this file ... lib/constants.ts (LANGUAGES_MAP + LANG_TO_COUNTRY_CODE_MAP)') + SelectLanguage audiences ('this widget needs no edits because it iterates i18n.languages') / odd-platform ts locales ui-shell-bootstrap:i18n.ts, odd-platform ts components/shared/elements/AppToolbar ui-shell-widget:SelectLanguage. A contributor following the page edits the wrong file and omits the two LANGUAGES maps, producing the undefined-cast error the sidecar names at SelectLanguage.tsx:50 (LANGUAGES_MAP[lang as Lang] returns undefined)."
  - "Page §'Known caveat — missing translations fall through to English' frames the gap as 'a small number of strings ... a few top-level navigation labels' affecting NON-ENGLISH locale users; code shows it is broader and also hits ENGLISH: 14+ keys are referenced via t() but absent from ALL six locales (incl. all three top-level nav tabs Data Quality / Data Modelling / Master Data at ToolbarTabs.tsx:46,51,56), rendered via the natural-keys accident as the English key string with no warning — evidence: invariant:i18n-missing-key-drift-silent-fallback-natural-keys-contract (HIGH severity, '14+ code-referenced keys absent from all six locales') + F-043 fact (a). The page's count ('a small number') understates the 14+ missing-key set and omits that English users see untranslated keys too."
maintainer_curated: false
---

# Multilingual UI — doc understanding

This page is the operator+developer fix for the original undocumented-feature miss (the multilingual UI shipped with no doc page; recorded inside the substrate as the `F-047` undocumented-feature marker and now the documented Feature `F-043`). It tells an operator the platform UI ships six locale translations (`en`/`es`/`ch`/`fr`/`ua`/`hy`) loaded at SPA bootstrap, switched in-app, and persisted per browser; and gives a contributor the workflow to add a locale. The page binds to the i18n bootstrap singleton (`odd-platform ts locales ui-shell-bootstrap:i18n.ts`, confirmed via graph-node: six static locale imports, `localStorage('i18nextLng')` read with `en` fallback, `fallbackLng: ['en','es','ch','fr','ua','hy']`), the language-switcher widget (`odd-platform ts components/shared/elements/AppToolbar ui-shell-widget:SelectLanguage`, confirmed: `i18n.changeLanguage(lang)` + `localStorage.setItem('i18nextLng', lang)`, no backend call), and the six locale resource bundles plus the `Locale Bundle` / `Switch UI Locale` concepts.

The page's core operator claims match the code exactly: localStorage key `i18nextLng`, per-device (not per-account) persistence, survives logout, no server-side propagation / no `Accept-Language` honoured, default `en`, and silent fall-through to English for missing keys (all confirmed against `i18n.ts` understanding + the `Locale Bundle` concept + F-043 facts d/i). Three drift findings remain, all cited in frontmatter: (1) the switcher is reached from the user-account dropdown, not a "gear icon"; (2) the contribute-a-locale steps name `SelectLanguage.tsx` (which needs no edit) instead of the two `lib/constants.ts` maps that actually gate a new locale; (3) the missing-key caveat understates the gap (14+ keys absent from all six locales per the HIGH-severity missing-key invariant, and English is affected too, not only non-English locales).

## Maintainer notes
