---
id: CTRIB-002
github_issue_number: 1746
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1746
class: bug
status: pr-draft
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

