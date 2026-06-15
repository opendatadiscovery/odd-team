---
id: IT-102
title: "The UI switches locale (i18next), persists the choice, and falls back to English"
gates:
  validates: [F-043]
  enforces: []
  regresses: [PLT-190, PLT-215, PLT-226]
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
Also REGRESSES PLT-190 / odd-platform#1748: three of the nine toolbar tabs (Data Quality /
Data Modelling / Master Data) had no key in ANY locale catalog — the natural-keys fallback
rendered raw English literals beside six translated siblings under every non-English locale.

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
3. REGRESSION #1748 (PLT-190): from English, switch to "Ukrainian" via the same dialog;
   observe ALL NINE toolbar tabs render Ukrainian (Каталог / Директорія / Якість даних /
   Моделювання даних / Майстер-дані / Менеджмент / Словник / Сповіщення / Активність) and
   that no tab still reads the raw literals "Data Quality" / "Data Modelling" / "Master Data".
4. CORNER (fallback): pre-set `localStorage('i18nextLng')='zz-bogus'` (init script) before the
   first load; open `/directory`; observe English renders (Catalog tab "Catalog", not Spanish /
   not a key literal) — the `i18n.ts:23` `languages.includes(...) ? ... : 'en'` guard.
5. REGRESSION #1751 (PLT-215, CTRIB-014): open `/data-modelling` (English: the "Relationships"
   sub-tab renders); switch to "Spanish"; observe the Data Modelling sub-tabs render "Relaciones"
   / "Ejemplos de consulta" (es.json) and no tab still reads the raw "Relationships" literal —
   two of the 84 feature keys each non-en catalog trailed en by until CTRIB-014's catch-up.
6. REGRESSION PLT-226 (CTRIB-014): open the user menu -> "Select language"; observe the dialog
   offers ALL seven locales (English/Spanish/Chinese/French/Ukrainian/Armenian/Brazilian
   Portuguese), not English alone. #1783's `fallbackLng:'en'` had collapsed `i18n.languages` — the
   picker's source (`SelectLanguage.tsx`) — to `['en']`, hiding every non-English option; the fix
   lists `Object.keys(LANGUAGES_MAP)`. (This is the prerequisite the four switch cases depend on.)

**Automated rail**: `integration-tests/run-suite.sh IT-102` (Playwright `e2e/specs/multilingual-i18n.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** after picking Spanish, the Catalog tab reads "Catálogo" and "Catalog" is
  gone. (FAIL: label stays English → `changeLanguage` / re-render broken.)
- **PERSISTENCE (PASS):** after reload the Spanish label is still shown and `i18nextLng==='es'`.
  (FAIL: reverts to English → the localStorage round-trip is broken.)
- **REGRESSION #1748 (PASS):** under `ua` every one of the nine toolbar tabs shows its
  ua.json value; zero tabs read "Data Quality" / "Data Modelling" / "Master Data". (FAIL: a
  toolbar tab renders a raw English literal under a non-English locale → a tab key went
  missing from a catalog again — the PLT-190 class.)
- **CORNER (PASS):** an unknown stored locale renders English (not Spanish, not a key id).
  (FAIL: a bogus locale leaks through → the fallback guard regressed.)
- **REGRESSION #1751 (PASS):** under `es` the Data Modelling sub-tabs read "Relaciones" /
  "Ejemplos de consulta"; zero tabs read the raw "Relationships". (FAIL: a feature-surface key
  renders raw English under a non-en locale → a catalog trails en again — the 84-key #1751 class.
  The deterministic complement is the odd-platform vitest `i18n-key-parity` catalog-parity
  assertion, which fails the build if ANY of the 84 keys is missing from ANY locale.)
- **REGRESSION PLT-226 (PASS):** the "Select language" dialog lists all seven supported locales.
  (FAIL: only "English" is offered → `SelectLanguage.tsx` is reading `i18n.languages` (the
  fallback chain, `['en']` under `fallbackLng:'en'`) instead of the supported-locale set — the
  #1783 second-order regression; a user cannot switch locale at all.)

## 6. Result log
- 2026-06-07 — authored; i18n config + SelectLanguage flow ground-truthed; locale switch driven
  through the real user-menu dialog; 3/3 green via run-suite.sh IT-102 (see run-log/).
- 2026-06-10 — CTRIB-003 (#1748): added case 4 (all nine toolbar tabs translate under ua;
  `regresses: [PLT-190]`). RED on the pre-fix SUT (tree clean @ fbb2eb43 = ref:main bits;
  the three tabs rendered raw English literals under ua), GREEN 4/4 on the fixed working-tree
  SUT (the 18 catalog entries). See run-log/2026-06-10-IT-102.md (3 entries: baseline/RED/GREEN).
