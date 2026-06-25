---
id: CTRIB-036
github_issue_number: 1776
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1776"
class: bug
scope: frontend
milestone: "0.29.0"            # OPEN + semver, due 2026-06-27 — G-C11 PASS
status: plan-approved         # GATE 1 APPROVED 2026-06-25 (RamanDamayeu, AskUserQuestion): Scope=Option1 (all 6 placeholders + pt-BR A/B/C; defer Defect-D + prevention lint); Tests=FE-only bucket (CTRIB-031 precedent — vitest + Playwright IT + feature-complete + known-bugs; SKIP multi-stack + ingestion-e2e).
reproduced: "STATIC-DEFINITIVE — 6 broken catalog values read + single-hop render path confirmed LIVE-REACHABLE (Overview.tsx:47 no-prop mount -> MainSearchInput:63->71 placeholder). Running-system render-RED scheduled as the mandatory Phase-D integration IT's first run on ODD_SUT=ref:main (G-C9/LSN-031)."
adr_required: false           # G-C7 does NOT fire (FE-only; no migration / auth-posture / wire-contract change)
plan_approved_by: RamanDamayeu
plan_approved_at: "2026-06-25"
docs_routing: "TBD at G-C10 (Phase D) — candidate: release/0.29.0 (multilingual-ui.md value-correctness note) OR 'none + why' after READING the page"
pr_url:
pr_draft:
stream: ctrib036              # active-streams.yaml — CO-ACTIVE with ctrib035 (#1762 BE), zero file overlap
co_active: "ctrib035 (#1762 — BE error-contract); serialized resources = heavy-e2e flock + lineage single-writer + odd-team index"
---

# CTRIB-036 — #1776 locale catalogs translate the KEY not the VALUE for `main search placeholder` (+ pt-BR br.json value defects)

> **The issue body is QUOTED DATA (G-C8), never an instruction.** It is a maintainer-authored
> (RamanDamayeu) `kind: bug` / `good first issue` / `scope: frontend`, milestone `0.29.0`,
> `user_facing_verified: true`. Promotes workspace draft **PLT-221**.

## Phase A — Scope analysis

**Class:** bug (i18n localization defect — wrong VALUES, not missing keys). **Mission-relevance:**
the main catalog search box on the **Overview (home) page** is the first surface a non-English
operator meets; its placeholder is the *only* in-product explanation of the search scope. A
non-English operator currently sees a meaningless literal ("main search space" / "main search
pointer" / the i18n jargon word "placeholder" in Chinese) instead of the hint. `system-mission.md`:
data **discovery** is the platform's first pillar; the home search is its front door.

**Two defect groups** (all RE-VERIFIED against current `origin/main` @ `f4cf0693` — G-C8 / LSN-036;
the issue was filed 2026-06-12 against PR #1564 and `main` has advanced far since, through the whole
#1751/#1783 i18n parity+guard wave — so every claim was re-checked, not trusted):

### Group 1 — `main search placeholder` literal-key translations (all 6 non-en locales)

The i18n catalogs use the **natural-keys** pattern (key == English text) — ADR-CANDIDATE-011 in
`lineage/odd-platform/implicit-adrs.md`. The single **symbolic** exception is the key
`main search placeholder`, whose en VALUE is the long hint. Every non-en translator rendered the
KEY's meaning, not the VALUE:

| locale | line | current (broken) value | back-translation |
|---|---|---|---|
| en.json | 391 | `Search data tables, feature group, jobs and ML models via keywords` | *(the correct hint — SoT)* |
| es.json | 386 | `espacio para búsqueda principal` | "main search space" |
| fr.json | 386 | `espace de recherche principal` | "main search space" |
| ch.json | 386 | `主搜索占位符` | "main search placeholder" (the jargon word) |
| ua.json | 397 | `основний покажчик пошуку` | "main search pointer" |
| hy.json | 386 | `հիմնական որոնման փոխարինող` | "main search substitute" |
| br.json | 386 | `local de busca principal` | "main search location" |

(Native strings quoted verbatim — the ASCII rule's native-content exception.)

### Group 2 — pt-BR (br.json) value defects from PR #1564 — all 4 STILL PRESENT

| # | line | current | defect | correct |
|---|---|---|---|---|
| A | 425 | `"Total entities": "Toal de entidades"` | typo `Toal` | `Total de entidades` |
| B | 41 | `"...delete this label?": "...excluir esta rótulo?"` | gender: `rótulo` is masculine | `excluir este rótulo?` |
| C | 167 | `"History": "História"` (vs :166 `Ocultar histórico`, :311 `Mostrar histórico`) | `História` = "the story"; inconsistent with Hide/Show history | `Histórico` |
| D | 72/104/130/184/186/326/327 | `Label` ⇒ both `Etiqueta` (:184) **and** `Rótulo` (:72,:104,:130); `Tag` ⇒ `Etiqueta` (:326) | terminology collision — `Etiqueta` overloaded for Label **and** Tag; Label rendered two ways | **needs a native-speaker decision** (the issue flags fredguth). Issue's suggestion: Label→`Rótulo`, Tag→`Etiqueta` consistently |

## Phase B — Reproduction log (G-C1)

**Static localization (definitive — the bug is 100% catalog DATA):**
- Render path CONFIRMED user-facing and single-hop:
  `components/Overview/Overview.tsx:47` → `<MainSearch mainSearch />` **(no `placeholder` prop)**
  → `components/shared/elements/MainSearchInput/MainSearchInput.tsx:63` `const mainSearchPlaceholder = t('main search placeholder')`
  → `:71` `placeholder: placeholder ?? mainSearchPlaceholder` (the `??` falls through to the catalog value because the home mount passes no prop).
- The **only other** `<MainSearch>` mount, `components/Search/Search.tsx:109` `<MainSearch placeholder={t('Search')} disableSuggestions />`, **passes its own placeholder → unaffected**. So the bug surfaces *only* on the Overview/home page. (This `??` override is exactly why reproduce-first matters: had the home mount also passed a prop, the catalog value would be dead code and this would reclassify to expected-behaviour. It does not.)
- The 6 broken values + the en SoT are read above (Group 1 table).

**Live render (to capture before GATE 1):** load the Overview page under a non-en locale (es + ua)
and screenshot the search box showing the broken literal — the RED baseline for the integration IT.
*(populated in Phase B execution; ports 18151/15503 throwaway / worktree FE render.)*

## Phase C — Root cause

A process gap, not a code bug: translators work from the **key list alone** (no English values in
view), so the one **symbolic** key (`main search placeholder`, where value ≠ key) got its KEY
translated literally by all six independently — the exact "key != value" blind spot the issue names.
The pt-BR Group-2 defects are ordinary translation slips merged in PR #1564 that the #1751 quality
pass did not reach. **None** of the four `i18n-key-parity.test.ts` guard blocks catches a wrong VALUE
(they check key-set parity + unwrapped-literal presence), so the defects passed CI green.

## Phase C — Change-request product analysis (G-C16 — critique the WHAT before the HOW)

The issue's bug is **real**; its *suggested fix* is mostly sound but carries three product/scope
sub-decisions. Restated user-problem **independent of the issue's solution**: *a non-English operator
on the home page must see a hint that explains what the search covers, in their language* — and
secondarily *the pt-BR catalog must be free of the merged-in value slips*.

Options (incl. reshape / rescope / revoke):

1. **Translate all 6 placeholder values + fix pt-BR A/B/C; DEFER Defect-D + the prevention lint.**
   *(recommended)* Completes the user-facing fix in one bounded PR. es/fr/ch/ua/hy are best-effort
   translations OF THE VALUE (the issue's own bar: "still strictly better than the current literal
   key translations"), each flagged for native review at GATE 2; pt-BR uses the maintainer's
   suggested value. Defers exactly the two things that genuinely need *more*: Defect-D (a native
   pt-BR Label/Tag decision, broader blast radius) and Group-3 prevention (CI-tooling, and the
   issue's proposed `value==key` check would **not** catch these — the broken values are translations
   *of* the key, never literally equal to it; needs redesign).
2. **pt-BR only** (placeholder + A/B/C); defer es/fr/ch/ua/hy to native-speaker PRs. Leaves 5 locales
   broken indefinitely; contradicts the "strictly better than the literal" bar; under-delivers a
   `good first issue` that is fully within a careful engineer's reach.
3. **Everything incl. Defect-D** (decide Label→Rótulo / Tag→Etiqueta now). Over-reaches: Defect-D is a
   semantic concept split across ~10 keys that the issue *explicitly* reserves for a native pt-BR
   speaker; deciding it unilaterally risks shipping a wrong call into a public UI.

**Recommendation: Option 1.** `odd-sme` not consulted — this is a pure translation-correctness +
i18n-hygiene fix, not feature-shaped; no data-catalog domain question is in play (the one domain
nuance, the Label-vs-Tag concept distinction, is precisely what Option 1 *defers*).

## Phase C — Design before build (G-C12)

- **(a) Reuse-scan.** Nothing to build — the change is catalog VALUE edits to existing keys + one
  vitest guard in the existing `locales/__tests__`. No new component, endpoint, or pattern.
- **(b) ADR-check.** Conforms to **ADR-CANDIDATE-011 (natural-keys)**: keys are unchanged; only the
  symbolic-key VALUES are corrected (the documented exception stays the exception). No new ADR.
  Conforms to the #1751/#1783 i18n posture (parity guard untouched — it is key-set-based).
- **(c) Impact-dimension checklist.**
  - *i18n (ALL locales):* exactly 7 catalogs exist (en + 6). en is the SoT (unchanged); all **6**
    non-en get the placeholder fix; **br** additionally gets Group-2 A/B/C. No locale left behind.
  - *Generated BE/FE clients:* none (no API/spec change).
  - *Consumers of a changed signature:* none (no code signature changes; values only).
  - *Migrations:* none.
  - *Docs:* `documentation/docs/multilingual-ui.md` is a dedicated i18n page (describes #1751/#1783
    parity). G-C10 decision deferred to Phase D after READING it — likely a one-line value-correctness
    note on `release/0.29.0`, or "none + why". `data-discovery/catalog-overview.md` documents Main
    search but is locale-agnostic.
  - *Ontology:* the i18n locale-bundle sidecars (`i18n_ts`, `ui-shell-bootstrap`) — minimal churn;
    `/enrich --touched` at Phase D while lineage is clean.
- **(d) Product-Owner / SRE lens:** light (not feature-shaped). PO view = "the home search hint must
  read naturally in each shipped language"; SRE view = none (no runtime/ops surface).

## Phase C — The plan (GATE-1 artifact)

### Exact change

**1. Group 1 — six `main search placeholder` values** (translate the en VALUE
`Search data tables, feature group, jobs and ML models via keywords`). Proposed values
(pt-BR = the maintainer's issue suggestion; the rest best-effort, **flagged for native review at
GATE 2** — each is a multi-item hint, unambiguously better than the current key-gloss):

| locale | proposed value | confidence |
|---|---|---|
| br.json:386 | `Busque tabelas de dados, grupos de features, jobs e modelos de ML por palavras-chave` | HIGH (maintainer-suggested; fredguth reviews) |
| es.json:386 | `Busca tablas de datos, grupos de features, jobs y modelos de ML por palabras clave` | MEDIUM-HIGH |
| fr.json:386 | `Recherchez des tables de données, des feature groups, des jobs et des modèles de ML par mots-clés` | MEDIUM-HIGH |
| ua.json:397 | `Пошук таблиць даних, груп ознак, завдань і ML-моделей за ключовими словами` | MEDIUM |
| ch.json:386 | `通过关键词搜索数据表、特征组、作业和 ML 模型` | MEDIUM (native review welcome: 作业 vs 任务; ML 模型 vs 机器学习模型) |
| hy.json:386 | `Որոնեք տվյալների աղյուսակներ, հատկանիշների խմբեր, առաջադրանքներ և ML մոդելներ ըստ բանալի բառերի` | LOW-MEDIUM (most uncertain — strongest native-review flag) |

**2. Group 2 — pt-BR br.json value fixes (A/B/C only):**
- `:425` `"Toal de entidades"` → `"Total de entidades"`
- `:41`  `"...excluir esta rótulo?"` → `"...excluir este rótulo?"`
- `:167` `"History": "História"` → `"History": "Histórico"`

### Explicit scope EXCLUSIONS (G-C5)

- **Defect-D (Label/Tag terminology split)** — NOT in this PR. Needs a native pt-BR decision
  (fredguth); ~10 keys; broader blast radius. → log a follow-up (`PLT-NNN`) + name it in the public
  scope comment.
- **Group-3 prevention lint** — NOT in this PR. Separable CI-tooling; the issue's proposed
  `value==key` check would not catch this class. → log a follow-up (`PLT-NNN` / a tests-pillar item).
- **No key changes, no en.json change, no source/.tsx change, no other locale keys.**

### Tests (G-C9 — both buckets, RED→GREEN)

- **Unit (vitest, in-process)** — a focused guard in `odd-platform-ui/src/locales/__tests__/`:
  for the symbolic key `main search placeholder`, assert every non-en value is a **multi-item hint**
  (contains ≥2 list separators `,`/`、`) — RED on base (the glosses have 0 separators), GREEN on fix.
  Non-circular (does not hard-code my strings); a heuristic complement to the IT below. *(final form
  settled in Phase D against the existing guard idiom.)*
- **Integration (Playwright IT-NNN, MANDATORY user-facing — G-C9 / LSN-031)** — load the Overview
  page under a non-en locale (es + ua), assert the main search input's placeholder is the corrected
  hint, NOT the old key-gloss. RED on `ODD_SUT=ref:main`, GREEN on the fix. Check
  `integration-tests/protocols/` for an Overview/locale IT to extend before authoring new.
- **Note for GATE 1:** FE-only change → the CTRIB-031 precedent (maintainer-approved FE-only skip of
  `multi-stack`+`ingestion-e2e`) may apply; full-regression vs lighter-FE-bucket is a GATE-1 scope call.

### Docs (G-C10) / Ontology (G-C10) / ADR (G-C7=none)

- Docs: read `multilingual-ui.md` in Phase D → update on `release/0.29.0` + paired DOC item, OR
  "none + why". Ontology: `/enrich --touched` the i18n sidecars (lineage clean now; re-verify).

### Public scope comment (drafted — posts immediately after GATE 1 approval, before any code, G-C5)

> *(ASCII, self-contained, no workspace IDs — final text in Phase C/GATE-1)*
> This PR corrects the six non-English `main search placeholder` values (they translated the symbolic
> key instead of the English hint) and three Brazilian-Portuguese value defects from #1564
> (`Toal`→`Total`, the `este rótulo` gender agreement, `History`→`Histórico`). Two items from the
> issue are intentionally **deferred**, not dropped: the Label/Tag → Etiqueta/Rótulo terminology
> split (needs a Brazilian-Portuguese decision — @fredguth) and the value≠key prevention lint
> (separate CI follow-up; the proposed value==key check wouldn't catch this class). The non-pt-BR
> hint translations are best-effort and native-speaker review is welcome.

## GATE 1 — APPROVED 2026-06-25 (RamanDamayeu) (G-C3)

- **Scope = Option 1** (all 6 placeholders + pt-BR A/B/C; defer Defect-D + prevention lint).
- **Tests = FE-only bucket** (CTRIB-031 precedent — vitest guard + Playwright locale IT + feature-complete
  + known-bugs; SKIP multi-stack + ingestion-e2e).
- Deferred items logged on disk: **PLT-244** (Label/Tag terminology, @fredguth) + **PLT-245** (prevention lint).
- **Public scope comment POSTED** (G-C5, maintainer-authorized): `odd-contributor[bot]` →
  https://github.com/opendatadiscovery/odd-platform/issues/1776#issuecomment-4796317083
- No clarifying GitHub comment warranted (G-C6) — scope was the maintainer's GATE-1 call; the maintainer
  authored the issue.

## Test / doc / ontology ledger (Phase D)

Code commit: odd-platform `contrib/CTRIB-036-i18n-locale-value-corrections` @ `773098a5` (6 locale JSON +
the vitest guard). Tests authored: IT-143 (`integration-tests/protocols/IT-143-*.md` +
`e2e/specs/i18n-main-search-placeholder.spec.ts`, wired into feature-complete + ui-e2e).

- [x] **Unit (vitest) RED→GREEN** — the symbolic-key hint guard in `i18n-key-parity.test.ts`. RED on base:
  6 per-locale tests fail (each shows the broken gloss). GREEN on fix: all 6 pass; suite 16/17 (the lone
  red is the pre-existing PLT-239 guard false-positive on `LinkedTermsList.tsx:63`, not my change). Run in
  a node:24 container (host node is 18; vitest 4 / vite 7 need ESM).
- [x] **Integration IT-143 RED→GREEN** — Overview placeholder under es+ua. **GREEN** on the fix SUT
  (2 passed, both inside feature-complete AND a standalone `run-suite.sh IT-143` re-confirm). **RED-proven**
  on the no-fix base `odd-team-sut-ctrib034` (2 failed — es+ua) → the RED survives (G-C15), the test
  genuinely guards #1776.
- [x] **FE-bucket regression on the working-tree SUT** (maintainer-approved skip of multi-stack +
  ingestion-e2e) — `run-regression.sh ctrib036 feature-complete known-bugs`, flock-serialized with the
  co-session; SUT `odd-team-sut-ctrib036` (digest 42cd1804, UI bundled). **feature-complete 316 passed /
  1 failed**; the 1 = IT-106 owner-association-triage, a FLAKE (re-ran **3/3 GREEN** in isolation;
  change-independent by construction — i18n-only diff) → **GREEN-for-change (delta 0)**. **known-bugs
  3-failed-EXPECTED-RED** (IT-004/006/007 known pins) + 1 skipped, **0 unexpected GREEN**. Run-logs:
  `integration-tests/run-log/2026-06-25-{feature-complete,known-bugs}.md` (filled).
- [x] **Docs read + routed** — `multilingual-ui.md` read; it claimed "Two build checks" + universal
  natural-keys. Updated (two→three guards + the symbolic-key value class + #1776) on `release/0.29.0`
  @ `a0f4656` (NOT pushed — external write deferred to Phase E); paired item **DOC-487** (pending-release).
- [x] **Ontology — DEFER (G-C10-justified), no stale core.** The enriched i18n node is en.json
  (`understanding/…i18n-resource__en.md`), UNCHANGED by this change (non-en catalog VALUES + a test
  guard); the sidecar ALREADY documents the symbolic `main search placeholder` exception (lines 57/67),
  so its core is accurate. Only marginal context drifts: the guard list (now 3, was 2 — the new
  symbolic-key value guard). AND lineage/** is DIRTY+unowned (P-001 probe residue: feature-flows.yaml + 2
  sidecars — R9 single-writer / O10 route-around), so `/enrich` must defer regardless. Refreshes at the
  next clean window / the 0.29.0 release substrate scan (same accepted bar as CTRIB-028..034). Nothing
  narrated as stale-but-unfixed; no i18n CODE behavior changed.
- [x] **Principal sufficiency (G-C13) + pixel review.** Enough + meaningful tests: the unit guard covers
  all 6 non-en catalogs structurally (RED on base); IT-143 proves the end-to-end render for 2
  representatives (es Latin + ua Cyrillic), RED on the no-fix base. Patch-coverage/jacoco: **N/A** — zero
  Java (FE-only; the CI gate is `-PbundleUI=false`). No control lost (value edits + a guard reusing the
  existing i18n test helpers; no new abstraction). No existing functionality harmed (feature-complete
  delta-0). **Rendered-pixel review PASS** — screenshots of the home search box under es + ua (against the
  running fix SUT, :18090): the full translated hint fits legibly in the 640px box, no overflow/truncation;
  the **Cyrillic renders correctly** (no mojibake). Captured placeholders match the catalog values exactly.

## Phase D — DONE. All 5 DoD gates GREEN (FE-only bucket per GATE 1)

1. Unit (vitest) green on the working tree (16/17; the 1 red = pre-existing PLT-239). · 2. FE-bucket
integration regression on the working-tree SUT — feature-complete GREEN-for-change (316/1-flake) +
known-bugs 3-RED-expected; IT-143 RED→GREEN proven (multi-stack + ingestion-e2e skipped per GATE 1). ·
3. Docs read + routed (`release/0.29.0` @ a0f4656 + DOC-487). · 4. Ontology — justified defer (no stale
core; lineage dirty+unowned). · 5. Principal sufficiency + pixel review PASS. Java CI replica N/A (zero Java).

**Phase E next:** push `contrib/CTRIB-036-i18n-locale-value-corrections` @ 773098a5 + the docs train + open
a DRAFT PR (`Closes #1776`, body in `contributor/CTRIB-036-pr-body.md`) → a SEPARATE `/review` → GATE 2.
