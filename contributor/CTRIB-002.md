---
id: CTRIB-002
github_issue_number: 1746
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1746
class: bug
status: done   # LEDGER-RECONCILED 2026-08-30: was `merged`; PR #1747 (`fbb2eb43`) is in the released `0.28.0` tag (published 2026-06-17). GATE 2 is done; `/review release:0.28.0` owns the flip to `done`. | RELEASE-GATE 0.28.0 (2026-08-30): fix confirmed inside the released `0.28.0` tag; the paired doc item(s) live-verified on docs.opendatadiscovery.org; full unit+IT suite and real-instance checks satisfied by the 0.29.0 release record (superseding published artifact ghcr digest a2e0c86d, unit BUILD SUCCESSFUL @ f12b8fbc, feature-complete 317/1, known-bugs 3-expected-RED).
milestone: "0.28.0"   # VERIFIED 2026-08-30 via GitHub API — the upstream issue carries milestone 0.28.0 (closed/released).
reproduced: "live 2026-06-10 on local odd-minimal, SUT=working tree @ 921e8c98 (= unfixed main): GET /api/terms/1 -> terms[].term.namespace null for the cross-namespace linked term, non-null for the same-namespace control in the SAME payload; GET /api/terms/2 (direct) -> namespace intact; UI /terms/1/overview -> fully blank page (body innerText == ''), pageerror 'TypeError: Cannot read properties of null (reading name)' from the useState lazy initializer; screenshot /tmp/repro-1746-overview.png"
adr_required: false
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-10 — plan approved as written: both fixes + both test buckets; no vitest; error-boundary follow-up; no root-cause comment)"
plan_approved_at: "2026-06-10"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1747"
pr_draft: true
---

# CTRIB-002 — Term overview crashes when description-linked term has null namespace (#1746)

Issue #1746 is the filed form of PLT-006 (`issues/odd-platform/PLT-006.md`). Author: the maintainer
(RamanDamayeu). Issue body treated as quoted data (G-C8); every claim independently verified below
against the odd-platform working tree (`main` @ 921e8c98, clean).

## Scope analysis

- **Class: bug** (labels `kind: bug`, `scope: backend`, `scope: frontend`, `func: Data Collaboration`).
  Two collaborating defects: a backend wrong-alias SQL aggregation (root cause, contract violation)
  + a frontend non-defensive null deref (crash site).
- **Features:** F-151 (term detail page composition) + F-056 (`[[ns:term]]` description-mention
  autolink — the canonical cross-namespace use case is exactly what crashes). Glossary domain
  (`navigation/domains/glossary.md`).
- **Mission relevance:** business-glossary term pages are a primary data-collaboration surface; the
  bug makes any term with a cross-namespace linked term unreachable in the SPA (view/edit/delete all
  gone, no in-app error).
- **Architectural significance (G-C7): NO ADR.** Read-side query correctness restoring the *declared*
  spec contract (`TermRef.namespace` required) + a defensive UI guard. No DB migration, no
  auth/security-posture change, no breaking wire-contract change.
- **Clarify (G-C6): no question warranted** — the issue fully specifies reproduction (public demo +
  file:line) and the fix direction; the author is the maintainer.

## Claim verification (issue is data — all claims re-verified against the working tree)

1. **Backend wrong alias — CONFIRMED.** `ReactiveTermRepositoryImpl.getTermDetailsDto`
   (`repository/reactive/ReactiveTermRepositoryImpl.java:194-238`): line 211 aggregates
   `NAMESPACE.asterisk()` (the parent term's namespace, joined at :218) into
   `ASSIGNED_TERM_NAMESPACES`; the correctly-aliased `assignedTermsNamespace`
   (declared :196, joined :232-233 on `assignedTerms.NAMESPACE_ID`) is never selected.
   Sibling aggregation `AGG_ASSIGNED_TERMS` at :210 *does* use its alias (`assignedTerms`) —
   line 211 is the lone copy-paste miss.
2. **Null propagation — CONFIRMED.** `extractTerms` (:610-636) keys a map by namespace id from the
   aggregation (:614-617) and resolves each linked term via `namespaces.get(pojo.getNamespaceId())`
   (:628) → `null` for any linked term whose namespace differs from the parent's. `LinkedTermDto`
   serializes `namespace: null`.
3. **Bug-class sweep — the wrong-alias instance is UNIQUE.** The four sibling `extractTerms`
   implementations (`ReactiveDataEntityQueryExampleRelationRepositoryImpl`,
   `ReactiveQueryExampleRepositoryImpl`, `ReactiveDatasetVersionRepositoryImpl`,
   `ReactiveTermQueryExampleRelationRepositoryImpl`) all LEFT-JOIN `NAMESPACE` directly to the linked
   `TERM` (`TERM.NAMESPACE_ID = NAMESPACE.ID`) — only one namespace table in scope, aggregation
   correct. The two other `LinkedTermDto` producers inside `ReactiveTermRepositoryImpl`
   (`getLinkedTermsByTermId` ~:480, `getTermByIdAndLinkedTermId` :502-527) join `NAMESPACE` directly
   to the linked-term CTE — correct. `getTermDetailsDto` is the only query with TWO namespace tables
   in play, and it aggregates the wrong one.
4. **Spec contract — CONFIRMED.** `odd-platform-specification/components.yaml` `TermRef.required`
   includes `namespace` (~:2551-2570). The current `/api/terms/{id}` payload violates it.
5. **Frontend crash site — CONFIRMED, and it is the ONLY one.** `useTermWiki.ts:51-55`: the lazy
   `useState` initializer maps `terms.map(term => makeTermKey(term.namespace.name, term.name))` —
   `TypeError` on null namespace during first render. The matchAll loops (:58-96, :98-149) build keys
   from regex captures, NOT from `TermRef.namespace` — they are not crash sites (issue's "same
   pattern recurs" is imprecise; recorded, no extra guard sites needed for `makeTermKey`).
   Mount chain: `Overview.tsx` (`termsRef = termDetails.terms.map(lt => lt.term)`) →
   `TermDefinition.tsx:18-24` (`useTermWiki`) — no error boundary in the subtree; the same
   `TermDefinition` tooltip shows the `[[Finance:User]]` cross-namespace example operators are
   guided toward.

## Reproduction (G-C1) — captured live 2026-06-10

Stack: odd-minimal (`AUTH_TYPE=DISABLED`), image `odd-platform:odd-team-sut` built from the
working tree @ `921e8c98` (= unfixed `main`), `SUT_IMAGE_ID=sha256:89afc7c0…`.
Seed: namespace `it127_ns_parent` → term 1 `it127_Parent` (definition mentions
`[[it127_ns_linked:it127_Linked]]`); namespace `it127_ns_linked` → term 2 `it127_Linked`;
`term_to_term(target=1, assigned=2, is_description_link=TRUE)`; control: term 3 `it127_Sibling`
in the PARENT's namespace, also linked to term 1.

1. **API (buggy aggregation path)** — `curl http://localhost:18080/api/terms/1`:
   ```
   linked term 2 (it127_Linked):  namespace = null          <- cross-namespace: contract violation
   linked term 3 (it127_Sibling): namespace = {id:1, name:it127_ns_parent}   <- same-namespace control resolves
   ```
   One payload shows both: the aggregated `assigned_term_namespaces` array only ever contains the
   PARENT's namespace, so same-ns resolves and cross-ns nulls.
2. **API (direct path, data intact)** — `curl http://localhost:18080/api/terms/2` →
   `"namespace": {"id": 2, "name": "it127_ns_linked"}` — the row is fine; only the aggregation strips it.
3. **UI (operator symptom)** — Playwright `/terms/1/overview`, after `GET /api/terms/1` resolves:
   `body.innerText === ""` — a fully blank white page (even the app toolbar unmounts; NO error
   boundary catches it). Pageerror captured verbatim:
   ```
   TypeError: Cannot read properties of null (reading 'name')
       at AssignTermForm-….js (the useTermWiki useState lazy initializer)
       at Array.map → useState → TermDefinition (Overview chunk)
   ```
   Screenshot: blank viewport (`/tmp/repro-1746-overview.png`).

## Root cause (verified on the running system + source)

`getTermDetailsDto` aggregates the WRONG namespace table: `ReactiveTermRepositoryImpl.java:211`
selects `jsonArrayAgg(NAMESPACE.asterisk())` — the parent term's namespace join (:218) — into
`ASSIGNED_TERM_NAMESPACES`, while the linked-terms namespace alias `assignedTermsNamespace`
(declared :196, correctly LEFT-JOINed :232-233) is never selected. `extractTerms` (:614-628) then
resolves each linked term via `namespaces.get(pojo.getNamespaceId())` against a map that only
contains the parent's namespace → `null` for every cross-namespace linked term →
`LinkedTermDto.term.namespace: null` serialized, violating `TermRef.required: namespace`
(`odd-platform-specification/components.yaml`). The SPA then crashes: `useTermWiki.ts:53`
dereferences `term.namespace.name` in a `useState` lazy initializer (first render, synchronous),
no error boundary exists anywhere in the tree → React unmounts the entire app → blank page.
Affects ANY linked term (description-linked or manually attached) whose namespace differs from the
parent's — the canonical `[[OtherNamespace:Term]]` wiki-link case the in-app tooltip itself
demonstrates (`TermDefinition.tsx:28-31`).

## Comments (issue thread)

- Root-cause comment: **SKIP per G-C6** — the maintainer authored the issue with the full
  root-cause analysis (filed from our own PLT-006); no difference-making comment to add
  (CTRIB-001 precedent).

## Plan

**Branch:** `contrib/CTRIB-002-term-cross-ns-namespace` on `opendatadiscovery/odd-platform`.

### Change 1 — backend root cause (restores the spec contract)

`odd-platform-api/.../repository/reactive/ReactiveTermRepositoryImpl.java:211`:

```diff
- .select(jsonArrayAgg(field(NAMESPACE.asterisk().toString())).as(ASSIGNED_TERM_NAMESPACES))
+ .select(jsonArrayAgg(field(assignedTermsNamespace.asterisk().toString())).as(ASSIGNED_TERM_NAMESPACES))
```

Mirrors the sibling aggregation at :210, which already uses its alias (`assignedTerms`). After the
fix the `extractTerms` map contains the linked terms' namespaces and `:628` resolves every linked
term — `namespace: null` disappears from the wire.

### Change 2 — frontend defense in depth (the crash site)

`odd-platform-ui/src/lib/hooks/useTermWiki.ts:51-55` — filter terms lacking a namespace before
keying, so a future contract violation degrades to an unresolved mention instead of a white page:

```diff
  const [fetchedTerms, setFetchedTerms] = useState<Record<string, TermRef>>(() =>
    Object.fromEntries(
-     terms.map(term => [makeTermKey(term.namespace.name, term.name), term])
+     terms
+       .filter(term => term.namespace?.name)
+       .map(term => [makeTermKey(term.namespace.name, term.name), term])
    )
  );
```

(The matchAll loops in the same hook build keys from regex captures, not `TermRef.namespace` —
verified not crash sites; no further guard sites exist for `makeTermKey`.)

### Test plan (test-first, BOTH buckets — G-C9)

- **Unit bucket (odd-platform CI; in-process Testcontainers `BaseIntegrationTest` = unit per the
  home rule):** new `ReactiveTermRepositoryCrossNamespaceLinkTest` — seed parent term A (ns X) with
  TWO linked terms: B in ns Y (cross-namespace) + S in ns X (same-namespace control);
  `getTermDetailsDto(A.id)` must return BOTH with non-null namespaces carrying the right ids
  (B→Y, S→X). RED on current code for B (`namespace == null` — exactly what the live repro showed),
  GREEN post-fix; the control pins that the fix doesn't break the previously-working case.
  Run the FULL `scripts/run-platform-tests.sh` (`:odd-platform-api:build` = test + checkstyle + assemble).
- **Integration bucket (odd-team `IT-127`, browser e2e via `run-suite.sh`, working-tree SUT —
  MANDATORY: user-facing symptom, LSN-031):** new protocol `IT-127-term-cross-namespace-linked-term.md`
  (`validates: [F-151, F-056]`, `regresses: PLT-006 / #1746`), spec
  `term-cross-namespace-linked-term.spec.ts`, two cases:
  1. **Backend fix, user-observable:** seed the cross-ns pair; open `/terms/{id}/overview`; the page
     RENDERS (name + definition visible, no pageerror) and the live `GET /api/terms/{id}` payload
     carries a non-null namespace for every linked term.
  2. **Frontend guard, future-proofing:** `page.route`-intercept `GET /api/terms/{id}` and force
     `terms[0].term.namespace = null` (response-interception with applied-guard per the
     route-interception case-law); the page must STILL render — no white screen — proving the guard
     holds against any future contract violation. (This is how the FE guard stays pinned even though
     the fixed backend no longer emits null.)
  **RED proof:** `ODD_SUT=ref:main run-suite.sh IT-127` — case 1 blank page (both bugs), case 2 blank
  page (no guard). **GREEN:** default `ODD_SUT=working` post-fix.
- **No frontend vitest test — deliberate.** odd-platform PR CI runs only `odd-platform-api:build
  -PbundleUI=false` + the upstream Playwright workflow; no CI job executes vitest, so a vitest test
  would be an orphan (tests-as-gates). The FE guard is regression-pinned by IT-127 case 2, which
  drives the real rendered UI.

### Docs decision (G-C10)

Expected: **no doc change** — the blank page is a defect, never documented behaviour; the fix
restores the documented `[[namespace:term]]` cross-namespace mention behaviour
(`data-glossary/business-glossary.md`). Final decision AFTER reading the live page during Phase D
(the *why* requires the read).

### Ontology refresh (G-C10)

`/enrich --touched` on `ReactiveTermRepositoryImpl` sidecar
(`lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTermRepositoryImpl.md`)
+ sweep `TermDetails` component sidecar + `F-151`/`F-056` feature-flows for stale "namespace"
claims; re-embed the graph; COMMIT (not narrate).

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **No React error boundary work.** The repro proved the ENTIRE app unmounts (no boundary anywhere
  in `odd-platform-ui/src`) — an app-wide architectural gap, not this issue's bounded fix.
  **Dedup outcome (grep-the-backlog-first, LSN-009): already tracked** as TEST-GAP-1013 (CRITICAL) /
  F-042 / IT-006 (`error-boundary-containment.spec.ts`, known-bugs lane, expected RED until a
  root-level boundary lands) — cross-referenced, NO new draft filed.
- The four sibling `extractTerms` repositories + the two other `LinkedTermDto` queries — verified
  clean (claim-verification #3); no speculative edits.
- Other `namespace?.name` UI sites (TermsForm, QueryExampleDetails, search results…) — fed by
  correct backend paths; already-defensive or out of the crash path.
- F-151's known double-fetch of `/api/terms/{id}` on the Overview tab — separate tracked finding.
- The OpenAPI spec — correct as declared; the implementation violated it, not vice versa.

## Test ledger

- **Unit** — `ReactiveTermRepositoryCrossNamespaceLinkTest` (Testcontainers,
  `repository/reactive/`): parent term (ns X) + cross-ns linked term (ns Y) + same-ns control (ns X)
  + a no-linked-terms composition case. **RED on unfixed code (2026-06-10):**
  `[every linked term must carry its namespace (spec: TermRef.namespace is required)] Expecting
  actual: [null, NamespacePojo (2, …)] not to contain null elements` — the cross-ns term nulls, the
  control resolves; exactly the live-repro behaviour. Fix applied (line 211 alias). **GREEN
  post-fix** (2 tests, 0 failures) + **full `:odd-platform-api:build` GREEN** (`BUILD SUCCESSFUL
  in 6m` — test + checkstyle + assemble, 2026-06-10).
- **Integration** — **IT-127** (`term-cross-namespace-linked-term.spec.ts`, 2 cases). **RED against
  the pre-fix SUT** (image built from main @ 921e8c98, the same bits as `ODD_SUT=ref:main`,
  2026-06-10): case 1 — `Error: linked term 5 must carry its namespace — Received: null` (wire
  contract); case 2 — white screen (render assertions never satisfied). **GREEN against the fixed
  working-tree SUT** (`run-suite.sh IT-127`, default `ODD_SUT=working` → image digest
  `sha256:4eff35f1…`, 2026-06-10): **2/2 passed** — case 1 wire namespace non-null + page renders +
  `[[ns:term]]` deeplink rewrite (3.7s); case 2 forced `namespace:null` payload renders without
  crash, applied-guard fired (2.8s). Run-log: `integration-tests/run-log/2026-06-10-IT-127.md`.
- Registered IT-127 in `suites.yaml` (feature-complete + ui-e2e); also registered **IT-126**
  (CTRIB-001's activity fan-out IT) in feature-complete + ui-e2e + I4 — it was never added to any
  suite (bookkeeping gap found during registration; folded into this batch's odd-team commit).

## Definition of Done (four merge-readiness gates — `retrospectives/LSN-032`)

1. **Unit (full build, on the branch):** ✅ `:odd-platform-api:build` GREEN on
   `contrib/CTRIB-002-term-cross-ns-namespace` (new test 2/2 + full suite + checkstyle + assemble,
   6m, 2026-06-10).
2. **Integration (working-tree SUT):** ✅ **IT-127 GREEN 2/2** via `run-suite.sh IT-127`
   (working-tree SUT, digest `sha256:4eff35f1…`) and **RED pre-fix** against the SUT built from
   unfixed main @ 921e8c98 — the same bits as `ODD_SUT=ref:main` (LSN-033: the SUT is a run
   parameter, never a frozen tag).
3. **Docs:** ✅ **VERIFIED no change** — read `data-glossary/business-glossary.md` end-to-end
   (224 lines). The page documents the `[[namespace:term]]` mention syntax + namespace-scoped term
   identity as intended behaviour (`:42`, `:102-110`); the blank-page defect was never documented;
   the Known-operator-caveats section documents only KNOWN-UNFIXED defects, and this one is fixed in
   the same motion — a new caveat would be stale on merge. The existing caveats (double-fetch 2×,
   RBAC bypasses) are untouched by this fix and stay true.
4. **Ontology:** sidecar updates committed — `ReactiveTermRepositoryImpl` (operation entry corrected
   + FIXED-1746 bugs entry + provenance) and `DataEntityDescription` (useTermWiki seeding entry:
   line-drift + the null-namespace guard); F-151/F-056 flows checked — no stale claims (their
   namespace facets concern RBAC, not this defect). ✅ Graph re-embedded (`graph-build
   odd-platform`: vectors=7995, model `BAAI/bge-small-en-v1.5`, 2026-06-10).

## Branch / PR

- Branch `contrib/CTRIB-002-term-cross-ns-namespace` pushed to `opendatadiscovery/odd-platform`
  (commit `e9673a89`, authored `odd-contributor[bot]`; 3 files: the :211 alias fix, the useTermWiki
  guard, the new Testcontainers test).
- Draft PR: **#1747** — https://github.com/opendatadiscovery/odd-platform/pull/1747 (GATE 2; review
  requested from `RamanDamayeu`; the bot cannot merge).

## Review (2026-06-10, session: separate from the implementing session — post-fde7d11)

- **Result**: ACCEPTED — `pr-draft` → `review-ready`. GATE 2 (human review + merge of PR #1747) is the remaining step; nothing else is outstanding.
- **GATE 2 COMPLETE**: PR #1747 merged by RamanDamayeu 2026-06-10T17:02:33Z (verified via API; main @ fbb2eb43). Status → `merged` (flip recorded during the CTRIB-003 batch).
- **Re-verification protocol**: every load-bearing claim re-derived from the branch source / live GitHub / a fresh test run — not from the record.

### Definition of Done (LSN-032 four gates) — re-verified

1. **Unit (full build, on the branch)** — PASS. PR #1747 CI ran the full suite on commit `e9673a89`: **406 tests, 0 failures, 0 skipped** (120 suites, 3m29s) — VERIFIED via WebFetch of the PR checks. The recorded local `:odd-platform-api:build` GREEN is independently corroborated by CI on the exact commit.
2. **Integration (working-tree SUT)** — PASS, **re-run by the reviewer**: `run-suite.sh IT-127` against the SUT built from the committed branch tip `e9673a89` (image digest `sha256:31f1e023…`) → **2/2 passed** (case 1: 1.4s; case 2: 1.2s) — VERIFIED via reviewer's own run, logged to `integration-tests/run-log/2026-06-10-IT-127.md`. RED half: recorded pre-fix run + logically forced by code reading (pre-fix `:211` aggregates the parent-namespace join `:218`; `extractTerms:628` resolves against a map that can only contain the parent's namespace).
3. **Docs** — PASS. `data-glossary/business-glossary.md` re-read by the reviewer: `:42` documents namespace-scoped term identity + the inline-mention syntax as intended behaviour; `:102-110` the linking workflow; Known-operator-caveats (`:134`+) documents only known-UNFIXED defects. "No doc change" is correct — the defect was never documented behaviour and is fixed in the same motion — VERIFIED via read.
4. **Ontology** — PASS. `ReactiveTermRepositoryImpl` sidecar: operation entry corrected (`:49`) + `FIXED-1746` bugs entry (`:298`) + provenance (`:434`) — committed in `fde7d11`; `DataEntityDescription` sidecar: line-drift + guard noted — committed; graph re-embedded `built_at: 2026-06-10`, `vector_count: 7995`, `BAAI/bge-small-en-v1.5` (`lineage/odd-platform/graph/build-info.yaml`) — VERIFIED via read.

### Contributor gates

- **G-C1 reproduce-first** — PASS. `reproduced:` frontmatter carries the live three-way evidence (cross-ns null vs same-payload control vs direct-GET intact; blank page + verbatim TypeError) — VERIFIED via read (and the IT-127 RED entry pins the same observations).
- **G-C2 running system, not the diff** — PASS via the reviewer's own IT-127 re-run on the working-tree SUT + CI's full-suite run on the exact commit (above). The SUT was a run parameter both times (LSN-033): RED via `ref:main` bits, GREEN via working tree.
- **G-C3 GATE 1 plan-before-code** — PASS. `plan_approved_by: RamanDamayeu, 2026-06-10` (approved as written: both fixes + both test buckets; no vitest; error-boundary follow-up; no root-cause comment); the shipped diff matches the approved plan character-for-character on both hunks — VERIFIED via `git diff e9673a89~1..e9673a89`.
- **G-C4 GATE 2 human merge** — PASS (structural). PR #1747 is DRAFT, authored `odd-contributor[bot]`, review requested from the maintainer; bot cannot approve its own PR — VERIFIED via WebFetch.
- **G-C5 bounded diff** — PASS. 3 files, +111/−2: the `:211` alias fix, the `useTermWiki` guard (+2-line constraint comment), the new test. Zero out-of-plan edits; exclusions held (no error-boundary work, no sibling-repo edits, no spec change) — VERIFIED via `git show --stat` + full diff read.
- **G-C6 one-question bar** — PASS. "No question warranted" recorded with reason (issue author is the maintainer, full spec); no root-cause comment per the GATE-1 approval — VERIFIED via issue thread WebFetch (zero bot comments).
- **G-C7 blast-radius** — PASS. `adr_required: false` is correct: read-side correctness restoring the *declared* spec contract + a defensive UI guard; no migration / auth / wire-shape change — VERIFIED via diff + `components.yaml:2551-2570` (`TermRef.required` includes `namespace`).
- **G-C8 issue-is-data** — PASS. Issue body re-fetched: a maintainer-authored bug report; no embedded instructions — VERIFIED via WebFetch.
- **G-C9 test integrity, both buckets** — PASS. Unit: `ReactiveTermRepositoryCrossNamespaceLinkTest` *injects* the failing condition (cross-namespace seed via real repositories; `createRelationWithTerm(linked, parent)` arg order verified against `TermRelationsRepositoryImpl:163-172`), asserts non-null AND the *correct own* namespace id, keeps a same-ns control + empty-composition case; `@validates F-151` / `@regresses PLT-006` javadoc. It is the FIRST test of `getTermDetailsDto` (repo-wide grep). Integration: IT-127 protocol (human-executable, `validates: [F-151, F-056]`, `regresses: [PLT-006]`) + spec with `waitForResponse`-before-goto and an `injected` applied-guard on the route interception (case-law conformant); covers the user-facing symptom the unit bucket cannot see (LSN-031). No vitest — verified correct: the only vitest reference in CI workflows is a commented-out line (`run-playwright-tests.yml:77`); a vitest test would be an orphan.
- **G-C10 ontology + docs move with the code** — PASS (DoD items 3+4 above; committed, not narrated).

### Universal Quality Bar gates

- **Gate 1 (no duplicates)** — PASS. IT-127 cross-references IT-032/IT-081/IT-082 and extends (cross-namespace + crash), not duplicates; unit test is net-new (only `getTermDetailsDto` test in the repo); error-boundary follow-up correctly DEDUPED to TEST-GAP-1013 / F-042 / IT-006 (all three verified on disk) — via grep + protocol read.
- **Gate 2 (aliases)** — N/A (no doc-concept alias introduced).
- **Gate 3 (caveats)** — PASS/N/A: no new operator caveat warranted (defect fixed in the same motion; existing caveats untouched and still true) — via business-glossary.md read.
- **Gate 4 (consumer-read)** — PASS. Every `Consumer-read:` footer line re-opened and matched against actual code: `ReactiveTermRepositoryImpl.java:194-238` (query + alias `:196`, joins `:218`/`:232-233`), `:529-546` (LinkedTermDto mappers), `:610-636` (extractTerms); `TermRelationsRepositoryImpl.java:163-172`; `useTermWiki.ts:24-96` (initializer + matchAll loops — regex-capture-keyed, NOT crash sites, claim confirmed); `TermDefinition.tsx:16-33` (hook mount + `[[Finance:User]]` tooltip); `Overview.tsx:27-45` (termsRef mapping); `components.yaml` TermRef; `run-pr-tests.yaml`; `business-glossary.md` — all verified via read.
- **Gate 5 (unset-parameter)** — N/A (no SDK builder in scope).
- **Gate 6 (bidirectional code↔doc)** — PASS. The fix restores behaviour the page already documents (`:42`, `:102-110`); the FE guard's degradation handles a state the fixed backend can no longer emit (documenting it would describe an impossible state). Sibling sweep confirmed clean: all 4 sibling `extractTerms` repos LEFT-JOIN `NAMESPACE` directly to the linked `TERM`; both other `LinkedTermDto` producers join per-row (`:486`, `:518`); `ASSIGNED_TERM_NAMESPACES` has exactly one consumer — via grep + read.
- **Gate 7 (layout/completeness)** — PASS. IT-127 registered in `suites.yaml` (`feature-complete` + `ui-e2e`); the IT-126 bookkeeping gap folded in same commit (verified at suites.yaml:16,66,88); protocol + run-log + seed helper all in canonical homes — via read.
- **Gate 8 (publishing/live)** — PASS for this pillar's surfaces: no docs.opendatadiscovery.org change to verify; the public surfaces (issue #1746 open, PR #1747 draft + CI green, branch pushed) verified live via WebFetch. The PR being unmerged is not a deferral — `review-ready` is precisely the pre-GATE-2 state.
- **Gate 9 (claim provenance)** — PASS. Every load-bearing record claim re-verified (claims 1-5 of the record's verification table re-derived from branch source; spec lines exact; banned-phrase grep over the record: zero hits).
- **Gate 10 (content-type homing)** — PASS. Work record in `contributor/`, protocol in `integration-tests/protocols/`, run-log in `run-log/`, sidecars in `lineage/`, code on the upstream branch — per `pillars/contributor/canonical-homes.md`.
- **Gate 11 (audience isolation)** — PASS. No published doc page touched. The public PR/issue text uses operator/contributor language; references to IT-127/odd-team are repo-public traceability, not internal-jargon leakage — via WebFetch read of both bodies.

### Verdict bookkeeping

- **Regressions**: none found. Removing the parent namespace from the aggregation cannot regress the parent's own namespace (flows via `select(NAMESPACE.fields())` `:205` → `mapRecordToRefDto:534-539`, independent of the agg) — verified via read. Same-ns linked terms keep resolving (control case GREEN in both buckets).
- **Navigation**: `navigation/domains/glossary.md` was missing the repository-layer + `useTermWiki`/`TermDefinition` pointers this fix proved load-bearing — added during review (living-pointers rule; not part of the item's authored content).
- **Upstream issues logged**: none needed (error-boundary gap already tracked: TEST-GAP-1013 / F-042 / IT-006).
- **Doc-product editorial audit** (step 5): full tree was swept earlier today (windfall harvest, commit `6463778`); this run did the FOCUSED pass on the touched surface + neighbours — `data-glossary/business-glossary.md` end-to-end, `management.md` (namespace-delete caveat), `data-modelling/query-examples.md` (linked-terms visibility), `data-discovery/entity-detail-page.md` (description-row cross-link). **Zero new findings.** One already-tracked finding's evidence refined, not re-filed (LSN-009): DOC-GAP-100 residual — the literal `[[namespace:term]]` syntax now appears in *prose* on business-glossary.md, but only inside Known-operator-caveats (`:151,155,167`); the authoring workflow section (`:102-110`) still teaches the format only via "hover the info icon". The tracked fix direction (spell the syntax out in the workflow section) already covers this; no new DOC item.
- **Banned-phrase check**: none used in record or review.

## PR body (for GATE 2 — draft PR on #1746)

**Title:** `fix(terms): aggregate linked terms' namespaces, not the parent's, in term details`

```
## Summary
GET /api/terms/{id} serialized `terms[].term.namespace = null` for every linked term whose
namespace differs from the parent term's — violating the OpenAPI contract (TermRef.namespace is
required) — and the term-overview SPA crashed on that null (an unhandled TypeError in a useState
lazy initializer), rendering a fully blank page. Any term whose definition mentions a term in
another namespace ([[OtherNamespace:Term]] — the exact pattern the in-app tooltip demonstrates)
was unreachable in the UI: no view, no edit, no delete, no in-app error.

## Root cause (two collaborating defects)
- Backend (the contract violation): `getTermDetailsDto` aggregates a namespace JSON array
  (ASSIGNED_TERM_NAMESPACES) for its linked terms, but line 211 selected the OUTER `NAMESPACE`
  table — the PARENT term's namespace join — instead of the `assigned_terms_namespace` alias that
  is declared (:196) and correctly LEFT-JOINed (:232-233) to the linked terms. `extractTerms`
  (:614-628) then resolved each linked term against a map containing only the parent's namespace ->
  null for every cross-namespace linked term. (The sibling aggregation at :210 already used its
  alias — :211 was the lone miss.)
- Frontend (the crash site): `useTermWiki`'s useState lazy initializer dereferenced
  `term.namespace.name` unguarded; with namespace = null the first render throws synchronously,
  and with no error boundary in the tree React unmounts the entire app.

## Change
- `ReactiveTermRepositoryImpl:211` — aggregate `assignedTermsNamespace.asterisk()` (the linked
  terms' namespaces) instead of `NAMESPACE.asterisk()` (the parent's). One line; restores the
  declared contract. No wire-shape change otherwise.
- `useTermWiki.ts` — filter linked terms lacking `namespace?.name` before keying, so a
  contract-violating payload degrades to an unresolved mention instead of a white page
  (defense in depth; the matchAll loops already key from regex captures and were safe).

## Scope exclusions (deliberate)
- No error-boundary work: odd-platform-ui has no error boundary anywhere; that app-wide gap is
  tracked separately and is not this issue's bounded fix.
- The four sibling extractTerms repositories (query-example / dataset-version / term-query-example
  relations) were audited: they join NAMESPACE directly to the linked TERM and are correct.
- The OpenAPI spec is unchanged — it was already correct; the implementation violated it.

## Reproduction + verification (running system, local stack)
- Pre-fix: seeded parent term (ns A) with a description-linked term (ns B) + a same-namespace
  control. GET /api/terms/{parent} -> linked term namespace = null, control namespace resolves
  (one payload shows both); GET /api/terms/{linked} directly -> namespace intact (data fine, only
  the aggregation strips it). UI /terms/{parent}/overview -> blank white page,
  `TypeError: Cannot read properties of null (reading 'name')`.
- Post-fix: the same seeds -> every linked term carries its own namespace on the wire; the page
  renders and the [[ns:term]] mention rewrites to the linked term's deeplink.

## Tests
- New `ReactiveTermRepositoryCrossNamespaceLinkTest` (Testcontainers): cross-namespace linked term
  + same-namespace control + empty-linked-terms composition. RED before the fix
  (`[null, NamespacePojo(...)] not to contain null elements`), GREEN after; full
  `:odd-platform-api:build` green.
- Browser e2e (odd-team integration suite, IT-127): the overview page renders with a
  cross-namespace linked term (wire + DOM + deeplink), and a route-intercepted namespace:null
  payload still renders (pins the frontend guard independently of the fixed backend). RED on
  pre-fix main, GREEN on this branch.

Closes #1746

---
Opened by odd-contributor[bot]. Human approval required before merge.
```

