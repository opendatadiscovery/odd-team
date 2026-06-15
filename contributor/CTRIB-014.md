---
id: CTRIB-014
github_issue_number: 1751
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1751
class: bug  # GitHub label `kind: bug` / `scope: frontend`. Localization-completeness gap: post-#1783, non-en operators see English fragments for the 84 en-only keys (the fallbackLng:'en' floor renders English, not a foreign leak — so this is the catch-up, not a regression).
milestone: "0.28.0"  # VERIFIED 2026-06-15 via unauthenticated GitHub read — #1751 is OPEN, milestone 0.28.0 OPEN (open milestones: 0.28.0, 1.0.0). G-C11 SATISFIED.
status: review-ready  # GATE 1 + GATE-1.5 PASSED. DRAFT PR #1785 opened 2026-06-15. /review (separate session) + the human merge own GATE 2. NOT self-done.
reproduced: |
  Deterministic catalog diff (the authoritative proof; no runtime dependency — same class + accepted form as CTRIB-012), verified 2026-06-15 against odd-platform working tree:
    $ python3 (flatten en/es/br/ch/fr/ua/hy.json, set-diff vs en)
    en.json total keys: 505
    es 421  missing_vs_en=84  orphan=0
    br 424  missing_vs_en=84  orphan=3
    ch 422  missing_vs_en=84  orphan=1
    fr 422  missing_vs_en=84  orphan=1
    ua 421  missing_vs_en=84  orphan=0
    hy 421  missing_vs_en=84  orphan=0
    missing-set: 80 keys missing from ALL non-en + 8 divergent (each locale misses 4 of the 8) = 84/locale.
  Running-system half: the i18next missing-key->fallbackLng:'en' render path is already live-verified twice
  (#1748 raw-English-under-ua; CTRIB-012 the Portuguese leak) — the SAME path. Post-#1783 (fallbackLng:'en'),
  an en-only key renders the English label under every non-en locale. The RED proof is the extended IT-102 on
  ODD_SUT=ref:main (a non-en surface shows English), captured at implement per reproduce-first step 5 (fix only
  after GATE 1). [CTRIB-012 precedent: a deterministic i18n bug carries the static diff + defers the IT RED-proof.]
adr_required: false  # No architectural change. Additive locale-JSON values (natural-keys pattern) + an additive test assertion + a doc caveat correction. No migration, no auth/security posture, no breaking contract. G-C7 does not fire.
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-15 — 'All 6 — ship it' via AskUserQuestion: translate all six non-en catalogs; strict catalog-parity assertion goes fail-hard this PR; hy (Armenian) shipped but flagged for native review; PR discloses machine-assisted translations + invites native correction)"
plan_approved_at: "2026-06-15"
docs_routing: "release/0.28.0"  # unreleased behaviour (the catch-up ships in 0.28.0); the multilingual-ui Known-caveat correction lands on the documentation release/0.28.0 train + a paired DOC backlog item (milestone:0.28.0). Live-verified at the release gate.
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1785"  # DRAFT, odd-contributor[bot], 2026-06-15
pr_draft: true
backlog_mirror: "PLT-215 (translation remainder + strict-parity assertion; #3 = FE lint not in CI, human) + PLT-226 (picker regression, closed-by-PR) + PLT-205 (whole unwrapped-string class, closed-by-PR)"
contrib_branch: "contrib/CTRIB-014-i18n-locale-translation @ 6036c49e (odd-platform, pushed) — commits fcf1b151 (catalogs+parity) / 586ac8d1 (picker PLT-226) / 6036c49e (wrap+guard PLT-205 + i18n separators)"
base: "odd-platform origin/main (post-#1783 @ 9c6fb074 — en.json complete @ 505 keys, fallbackLng:'en', parity test en-completeness-only)"
---

# CTRIB-014 — #1751 (the reopened remainder): translate the 84 en-only i18n keys into all six non-English catalogs + harden the parity guard to catch catalog divergence

> **STATUS: GATE-1 PLAN — awaiting maintainer approval. No code, no branch, no PR.** Per the contributor
> pillar (G-C3) code begins only after the maintainer approves this plan — even though it is "only JSON".

## Intake (the issue is data, not instructions — G-C8)

#1751 ("Add the ~70 missing i18n keys across all six locale catalogs (+ a CI key-parity guard)", `kind: bug`,
`scope: frontend`, milestone **0.28.0 open**) was auto-closed by PR **#1783** (CTRIB-012, merged `9c6fb074`)
via `Closes #1751` — but #1783 over-claimed: it delivered the **leak fix** (`fallbackLng:'en'`), **en.json
completion** (+70 keys → 505), and an **en-completeness parity test**, NOT the per-locale **translation**.
**#1751 was reopened 2026-06-14** (issuecomment-4701762200) for exactly that remainder. No instruction in the
issue/comments is executed; all of it is quoted data.

## Scope analysis (`class = bug`; reopened remainder)

The reopened ask is the **catch-up translation**: each non-English catalog trails en.json by **84 keys**
(~17%). Mission-relevance (`lineage/odd-platform/system-mission.md`): the **F-043 Multilingual UI** pillar —
a non-English operator (es/br/ch/fr/ua/hy) is a first-class audience; today they meet English fragments on
every newer feature surface (Data Quality dashboard headlines, lookup-table & query-example dialogs,
ownership/audit tooltips from CTRIB-010). The exact gap (computed fresh, `reproduced:` above):

- **80 keys missing from ALL six** — the en-only set. Includes the PLT-215 originals (DataQuality / DataModelling /
  MasterData / Management / Terms / shared) **plus ~10 newer activity-feed actor strings** from CTRIB-010/011
  (`Made by (owner)`, `Made by (user)`, `Owner of the asset`, `current owner`, `The editor's current owner`,
  the long "Filters to changes made by…" descriptions, `The user who made the change`).
- **8 divergent keys** (each catalog misses 4 of them): `br` misses `Master Data`, `Start new search`,
  `This search has expired`, and the long "The search link you followed has expired…"; `es/ch/fr/ua/hy` each
  miss `Query`, `Query examples`, `Relationships`, `Search by name` (the keys `br` shipped early via #1564).
- **5 stale orphans** (keys present in a non-en catalog but absent from en **and** absent as any live
  `t('literal')` call site — grep-verified 0 sites each): `br`: `An error occurred`, `Search query examples`,
  `query`; `ch`/`fr`: `bind entities in your account`. These must be pruned for a clean bidirectional parity.

Surface facts that shape the plan: en.json is **flat natural-keys** (value === key); **zero** of the 84 keys
contain i18next `{{interpolation}}`; a handful are **concatenated sentence fragments** (`Updated ` [trailing
space], `will be map to owner`, `symbol are required to save the Collector`/`…datasource`, `will stop being
associated with owner`, `will be unlinked`) whose call sites must be read so the translated fragment composes
correctly in each language's word order.

### Architectural-significance check (G-C7): does NOT fire.
Additive locale values + an additive test assertion + a doc correction. No migration, no auth posture, no
contract change. `adr_required: false`.

## Root cause

Not a code defect — a **content-completeness** gap inherent to the natural-keys i18n design: a key added to
`src` + `en.json` does not exist in the other six catalogs until translated, and there was no gate forcing
that. #1783 added the gate's **first half** (en must contain every `t()` literal) but **not** the half that
forces the *other* catalogs to keep parity — so the 84-key gap is invisible to CI. (And, separately, that
parity test is **not even wired into CI** — see PLT-215 addendum #3 below.)

## The plan (GATE-1 artefact) — bounded to odd-platform-ui locale JSON + one test + docs + ontology

Branch `contrib/CTRIB-014-i18n-locale-translation` off `origin/main`. **Four parts:**

| # | Change | File(s) | Why |
|---|--------|---------|-----|
| 1 | Translate all **84** en-only keys into **es, br, ch, fr, ua, hy** (80 shared + each locale's 4 divergent), conforming to that catalog's **existing glossary**; **prune the 5 stale orphans** | `odd-platform-ui/src/locales/translations/{es,br,ch,fr,ua,hy}.json` | The reopened ask. Each catalog reaches exact key-parity with en.json (505 keys). |
| 2 | **Strict catalog-parity assertion** added to the guard: every non-en catalog's key set **equals** en's (missing → fail; orphan → fail) | `odd-platform-ui/src/locales/__tests__/i18n-key-parity.test.ts` | The deterministic unit test for THIS work — **RED today** (84 missing + 5 orphans), **GREEN after Part 1**. The current test only checks en-completeness, so it stays green regardless of the translation; this assertion is what proves completeness and stops the class regrowing. |
| 3 | **Extend IT-102** (`multilingual-i18n.spec.ts`): under a non-en locale, a previously-missing key now renders **translated** (not the English literal) on a stable surface | `integration-tests/e2e/specs/multilingual-i18n.spec.ts` + `protocols/IT-102-multilingual-i18n.md` (odd-team) | The user-facing behavioural guard. **RED on `ODD_SUT=ref:main`** (English under es), **GREEN on the fix**. |
| 4 | **Docs**: correct the multilingual-ui "Known caveat" (the "~70 keys absent" + the br 8-key trailing gap) — the catalogs are now complete; parity is test-enforced | `documentation` repo **`release/0.28.0` train** branch + a paired DOC backlog item (`milestone:0.28.0`) | G-C10/G-C11: unreleased behaviour rides the train; publishes at the 0.28.0 release gate. |

### Scope EXCLUSIONS (G-C5)
- **NOT wiring the parity test into CI.** The FE `vitest` suite is not run by any active workflow
  (`run-pr-tests.yaml` = `gradlew odd-platform-api:build -PbundleUI=false` (backend only) + Playwright;
  `sonar-frontend.yaml` is dead). Making the guard actually gate PRs requires editing `.github/workflows/`
  — which the bot's GitHub App **cannot** do (no `Workflows` permission; `github-write.md` forbids workflow
  edits). **→ logged as PLT-215 addendum #3 (human-only — the unfulfilled CI half of #1751's own ask).**
  This PR ships the test as the executable spec (runs locally, gates the moment CI is wired); it does not
  pretend the guard is enforced.
- **NOT PLT-221** (wrong-VALUE defects: the 'main search placeholder' literal-key class + `br` typos) — a
  different defect class; do not fold in.
- **NOT PLT-205** (hardcoded English with no `t()` call at all) — different defect.
- **No `en.json` change** (complete since #1783) and **no `fallbackLng` change** (correct since #1783).
- **No new selectable locale**; no change to `br`'s correct existing translations.

## Design before build (G-C12)
- **Reuse-scan:** (a) the translation **reuses each catalog's existing glossary** — ~80% of the 84 keys are
  compositions of domain terms/verbs already translated in the same catalog (Add/Delete/Save/Query/Dataset/
  Owner/Tag/Column/Table/Lookup table/Term…); I extract the established rendering per locale and conform, so
  the new strings match the 421 already there (no terminology drift). (b) The IT **reuses IT-102** (do not
  author a new spec). (c) The test **extends the existing parity test** (one new `it()` assertion, no new
  file). (d) Natural-keys is the established en pattern. Net-new = **nothing** — every part extends an
  existing artefact.
- **ADR-check:** no ADR governs i18n catalog content/parity; conform to the natural-keys pattern. G-C7 no.
- **Impact checklist:** i18n — the whole point, all 6 locales (not en-only-plus-backlog). Generated clients —
  none (locale JSON is static FE asset). Consumers of a changed signature — none (no key renames; only values
  added). Migration — none. Docs — the multilingual-ui caveat (Part 4, train). Ontology — F-043 +
  `…locales_translations__i18n-resource__en` sidecar (the "missing_key_drift" / "trails by 84" facet is now
  ~0). **CI enforcement — deferred to PLT-215 addendum #3 (human-only), named, not dropped.**
- **PO/SRE lens:** a non-English operator on the DQ dashboard / lookup-table dialogs currently reads a
  half-translated product; completing the catalogs + locking parity restores language coherence on every
  surface — the straightforward expectation. Fragment keys get per-call-site care so word order is correct,
  not word-salad.

## Translation approach (the quality mechanism — Phase D)
Per locale, **focused & glossary-anchored**, gated deterministically:
1. Extract the per-locale glossary (recurring terms/verbs already translated in that catalog).
2. Translate the 84 keys conforming to the glossary; read the call site for the ~6 fragment keys; preserve the
   `Updated ` trailing space; keep technical tokens (`URL`, `TAGS`) per the catalog's existing casing.
3. **Deterministic gate on every catalog before commit** (no trust in a "done" claim — memory
   `feedback_batch_agent_writes_need_disk_gate`): valid JSON · key-set **exactly** == en (505) · no leftover
   raw-English value where a translation is expected · orphans gone. Then run the strengthened parity test
   (local, Node 24 @ `~/.local/node-cache/node-v24.13.0`) — must go GREEN.
4. **`ua` reviewed by me in detail** (maintainer-verifiable: the workspace locale is Belarusian — Raman reads
   ua); es/fr/br/ch reasoned against the glossary; **hy (Armenian)** is the lowest-confidence — flagged for
   native review, shipped marked.

## Tests (G-C2 / G-C9 — both buckets)
- **Unit/CI bucket:** the strengthened parity test (Part 2) — RED→GREEN on the translation. (Runs locally;
  see PLT-215 addendum #3 for the CI-enforcement gap.) FE `vitest` must stay green overall.
- **Integration bucket:** IT-102 extension (Part 3) — RED on `ODD_SUT=ref:main`, GREEN on the working tree.
- **Full regression (both buckets, at implement AND review):** `run-suite.sh feature-complete` (green) +
  `multi-stack` (green) + `known-bugs` (still-RED) + `ingestion-e2e` (green), against the working-tree SUT.
  Blast radius is FE-locale-JSON only (no backend touched) — but the full regression is the gate regardless.

## Milestone / clarify (G-C11 / G-C6)
- **G-C11 SATISFIED** (verified 2026-06-15): #1751 OPEN, milestone **0.28.0** OPEN.
- **G-C6:** no public clarifying comment warranted — the reopen comment already states the remaining scope and
  this PR completes it exactly (no scope narrowing → no mandatory scope comment). The one genuine
  decision — **shipping machine-assisted translations for 6 languages under the team's name** — is a GATE-1
  matter for the maintainer, asked there, not a public issue comment.

## Phase D progress (2026-06-15) — implemented + verified; one blocker discovered

**Branch:** `contrib/CTRIB-014-i18n-locale-translation` off `origin/main@09f06242` (clean; 7 files: 6 locale JSON + the parity test).

**Unit bucket — GREEN + RED-proven.**
- All 6 catalogs merged to **exact 505-key parity** with en.json (the 84 each + the 8 divergent filled + the 5 stale orphans pruned: br `An error occurred`/`Search query examples`/`query`, ch+fr `bind entities in your account`). Deterministic gate passed (JSON valid · key-set == en · no empties · `Updated ` trailing space preserved).
- Strengthened `i18n-key-parity.test.ts`: added the **bidirectional catalog-parity assertion** (each non-en catalog == en's key set; missing→fail, orphan→fail), `__tests__`-excluded the scan to fix a **pre-existing self-match bug** (the shipped en-completeness test was RED on its own illustrative `t('...')` examples — never caught because CI does not run vitest, PLT-215 addendum #3). vitest: **8/8 GREEN** on the working tree; **6/8 RED** with the locale files reverted (each "MISSING 84 keys") = the RED→GREEN proof. Full FE suite **29/29**; `tsc --noEmit` clean; eslint clean.

**Integration bucket — `run-suite.sh feature-complete`, ODD_SUT=working (the branch). SUT BUILD SUCCESSFUL (jib, incl. `tsc --noEmit` + `vite build` — my locale JSON + test compile into the image). Result: 283 passed / 4 failed.**
- The **4 failures are ALL the IT-102 locale-SWITCH cases** (UC-1 Spanish, UC-2 persistence, #1748 ua-tabs, #1751 mine) — every one times out at the **same** line (`getByRole('dialog').getByText('Spanish'/'Ukrainian')`). The one IT-102 case that does NOT switch (unknown-locale→English) PASSES. So the failure is the **language-picker**, not my catalogs.
- **Root cause (VERIFIED, not my change) → PLT-226 (filed):** `SelectLanguage.tsx:48` builds the picker from `i18n.languages` (the runtime fallback chain); #1783's `fallbackLng:'en'` collapses it to `['en']`, so the picker lists **only English** — no UI way to switch locale (ships 0.28.0). Live a11y snapshot confirms a one-row picker. Pinned to #1783 (`git show 9c6fb074^` = the 7-element array; `9c6fb074` = `'en'`). Sole `i18n.languages` consumer (grep). The CTRIB-014 translation is independently proven by the unit parity test; only the browser render proof is gated on PLT-226.

**Docs (G-C10) — DONE + routed.** `documentation` `release/0.28.0` worktree @ **8f15dc0** (local; push is the maintainer's at the release gate, per DOC-455 precedent): reframed the multilingual-ui "Known caveat" to the 0.28.0 catch-up. Paired **DOC-458** (pending-release, milestone 0.28.0).

**Ontology (G-C10) — PENDING** (F-043 drift facet + the en.json sidecar → resolved-by-CTRIB-014); will commit after the scope decision.

## GATE-1.5 (scope decision) — PAUSED, awaiting the maintainer

PLT-226 (the picker regression) **blocks the IT render proof** and **makes the translations unreachable via the UI** for any user without a persisted non-en locale — and it ships in the same 0.28.0. The fix is a verified 1-liner in `SelectLanguage.tsx` (iterate `Object.keys(LANGUAGES_MAP)`, not `i18n.languages`) — but it is **functional component code beyond the JSON-only GATE-1 plan**, so per G-C3/G-C5 I do not widen the diff without approval. Options put to the maintainer: (1) fold the 1-line picker fix into CTRIB-014 [recommended — un-blocks the IT, ships a working multilingual UI in 0.28.0], (2) a separate CTRIB-015 for the picker, (3) ship the translation-only PR now and defer the picker.

**DECISION (2026-06-15, RamanDamayeu via AskUserQuestion): Option 1 — fold the 1-line picker fix into CTRIB-014.** Scope now: the 84-key catch-up (6 catalogs) + the bidirectional parity test + **`SelectLanguage.tsx` picker fix (PLT-226: `i18n.languages` → `Object.keys(LANGUAGES_MAP)`)** + the (now-unblocked) IT-102 + docs + ontology. PLT-226 closed-by-this-PR. The fix is the only functional code change; it is a regression repair (no ADR — G-C7 does not fire). Re-verification: full unit build + the FULL integration regression on the new SUT + a picker screenshot (G-C12 step 5) before the draft PR leaves draft.

## What GATE-1 approval authorises
The four-part change above, bounded to those files, on `contrib/CTRIB-014-i18n-locale-translation`. Then:
translate → both test buckets + full regression → docs (release/0.28.0) → F-043 ontology refresh (committed) →
**draft** PR `Closes #1751` (GATE 2 = human merge). The CI-wiring gap (PLT-215 addendum #3) is handed to the maintainer separately.

## Phase D EXPANSION (2026-06-15) — the whole unwrapped-string class + the i18n guardrail (maintainer directive)

After GATE-1.5, the maintainer drove the REAL `/data-modelling/relationships` page under `ua` and found it
still full of English (heading, search placeholder, "… overall" count). Root cause: those strings are
**hardcoded with no `t()` wrapper** (the PLT-205 "unwrapped-string" class) — invisible to catalog work. The
catalog metric had diverged from the goal ("a page free of English"). **Directive (plan-mode, approved): fix
EVERY hardcoded user-facing string across all pages AND install a guardrail, in THIS PR.** (`feedback_i18n_done_is_rendered_page_not_catalog_parity`.)

**The guardrail = the enumerator.** Installed `eslint-plugin-i18next` (dev dep) + configured
`i18next/no-literal-string` in `eslint.config.mjs` (flat, v9): `mode: 'jsx-only'`, a **text-attribute
allowlist** (placeholder/label/title/text/…) so CSS/route/style props aren't flagged, and a `callees.exclude`
for `stringFormatted`/`getHighlights` (format-mode enums + DTO keys). The rule listed the exact violations and
gates against regression. (`pnpm lint` is local + the existing `lint-staged` pre-commit runs eslint on staged
files — so a new unwrapped string blocks a commit; the CI lint job is the human step, PLT-215 #3.)

**The sweep.** The rule found **208 unwrapped user-facing strings across 98 files** (the earlier grep estimate
of ~81 was low). Wrapped via **8 parallel sub-agents by directory** (1 died on a parse error → re-run), each
self-verifying `eslint i18next: 0` in its files; the 5 residual code-tokens (the `'s'` plural hack →
restructured to whole-word keys `more outputs`/`sources`/`targets`; `EntityClassItem` `'normal'`/`'short'` map
keys → moved to plain TS + the class label now `t()`-translated) handled by me. **Result: 0
`i18next/no-literal-string` across src; 0 eslint errors; `tsc --noEmit` clean; FE vitest 29/29.**

**New keys + translation.** The sweep introduced **95 net-new keys** (en.json 505 → **600**), incl. the
`DataEntityClassLabelMap` class labels. Translated into all six non-en catalogs via **6 parallel per-locale
agents** (glossary-anchored on each catalog), gated (JSON valid · exact 95-key set · `{{id}}`/`{{count}}`
interpolation + trailing-space preserved · no empties). **All 7 catalogs at exact 600-key parity.**

**Tests strengthened.** Parity-test regex widened to `'…'\s*[,)]` so interpolation calls `t('x', {..})` are
guarded too (parity test 8/8 green @ 600). IT-102 extended: the **PLT-226 picker** test (offers all 7 locales)
+ the **#1751 Data Modelling sub-tabs** + the **#1751/PLT-205 Relationships PAGE BODY under es** (heading
"Relaciones", placeholder "Buscar relaciones"; the English forms gone) — the maintainer's exact example, the
rendered-page acceptance.

**i18next separator fix (found by the integration regression).** The wrap introduced label keys with colons
(`Source:`, `Target:`, `Is Directed:`, `Parent:`, `Owner:`, …) and the IT-077 ERD test caught that they
rendered EMPTY: i18next's default `nsSeparator: ':'` parsed `t('Source:')` as namespace `Source` + empty key.
Fixed in `i18n.ts` with `keySeparator: false` + `nsSeparator: false` — the correct natural-keys config (phrases
contain `:`/`.` as literal text). Also repairs pre-existing keys that were silently broken
(`Example: …[[Finance:User]]`, the dotted-period phrases). Verified: 11 colon-keys + 13 dot-keys are all
phrases (none `ns:key`-style), so separators-off is safe; re-ran the full regression on the rebuilt SUT.

**Closes:** #1751 (catalog catch-up + the per-page wrap + the CI guard the issue asked for) · PLT-226 (the
picker regression) · PLT-205 (the whole unwrapped-string class). Remaining human step: wire `pnpm lint` into
CI (PLT-215 #3; bot cannot edit `.github/workflows/`).
