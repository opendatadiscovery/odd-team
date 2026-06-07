---
id: IT-102
title: "The UI switches locale (i18next), persists the choice, and falls back to English"
gates:
  validates: [F-043]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:multilingual-i18n.spec.ts"
plan_ref: I9
status: ready
---

# IT-102 — Multilingual UI / i18n locale switching (F-043)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The six-locale i18next layer (`locales/i18n.ts`, en/es/ch/fr/ua/hy) re-renders the SPA in a
chosen locale, persists the choice in `localStorage('i18nextLng')` across a reload, and falls
back to English for an unknown stored locale. If it FAILS, the multilingual feature (0/12
promises verified) is broken on its happy path. Source: feature-flow F-043; `i18n.ts:22-31` +
`SelectLanguage.tsx:28-33` + `components/shared/elements/AppToolbar/ToolbarTabs`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED).
- **Auth/config**: none specific. The locale switcher lives in the user menu and needs no auth.
- **Seed data**: NONE — translations are static JSON bundles shipped in the SPA; the probe
  string is the always-visible Catalog toolbar tab (en `Catalog` → es `Catálogo`, es.json:59).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- SPA shell: `curl -sL -o /dev/null -w '%{http_code}' http://localhost:18080/directory` → `200`.

## 4. Run protocol
1. SUCCESS (UC-1): open `/directory` (English: Catalog tab reads "Catalog"); open the user
   menu → "Select language" → pick "Spanish"; observe the Catalog tab re-render as "Catálogo".
2. PERSISTENCE (UC-2): after switching to Spanish, reload the page; observe Spanish persists
   (Catalog tab "Catálogo") and `localStorage('i18nextLng') === 'es'`.
3. CORNER (fallback): pre-set `localStorage('i18nextLng')='zz-bogus'` (init script) before the
   first load; open `/directory`; observe English renders (Catalog tab "Catalog", not Spanish /
   not a key literal) — the `i18n.ts:23` `languages.includes(...) ? ... : 'en'` guard.

**Automated rail**: `integration-tests/run-suite.sh IT-102` (Playwright `e2e/specs/multilingual-i18n.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** after picking Spanish, the Catalog tab reads "Catálogo" and "Catalog" is
  gone. (FAIL: label stays English → `changeLanguage` / re-render broken.)
- **PERSISTENCE (PASS):** after reload the Spanish label is still shown and `i18nextLng==='es'`.
  (FAIL: reverts to English → the localStorage round-trip is broken.)
- **CORNER (PASS):** an unknown stored locale renders English (not Spanish, not a key id).
  (FAIL: a bogus locale leaks through → the fallback guard regressed.)

## 6. Result log
- 2026-06-07 — authored; i18n config + SelectLanguage flow ground-truthed; locale switch driven
  through the real user-menu dialog; 3/3 green via run-suite.sh IT-102 (see run-log/).
