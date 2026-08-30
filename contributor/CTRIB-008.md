---
id: CTRIB-008
github_issue_number: 1759
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1759
class: bug
milestone: "0.28.0"
status: pending-release   # GATE 2 done 2026-06-12: PR #1777 merged by the maintainer = main `3f02dd63`; #1759 closed 21:09Z (verified via PR+issue API, CTRIB-009 run bookkeeping). DOC-450 stays pending-release (docs publish at the 0.28.0 gate) | LEDGER-RECONCILED 2026-08-30: was `merged`; PR #1777 (`3f02dd63`) is in the released `0.28.0` tag (published 2026-06-17). GATE 2 is done; `/review release:0.28.0` owns the flip to `done`.
reproduced: "live 2026-06-12 on the working-tree SUT (odd-platform:odd-team-sut built from clean main @ 7f905a5a, image sha256:15b44a45…, odd-minimal stack). (1) `curl -m 8 -i http://127.0.0.1:18080/api/v3/swagger-ui.html` → curl exit 28 (timeout, ZERO response bytes — not even headers) — the OpenAPI JSON route hangs. (2) `GET /api/v3/api-docs` → 302 Location: /api/v3/webjars/swagger-ui/index.html (the UI shell route works). (3) Container log at the moment of the spec request: `reactor.core.Exceptions: throwIfFatal detected a jvm fatal exception` → `java.lang.NoSuchMethodError: 'void org.springframework.web.method.ControllerAdviceBean.<init>(java.lang.Object)' at org.springdoc.core.service.GenericResponseService.lambda$getGenericMapResponse$8(GenericResponseService.java:700) ~[springdoc-openapi-starter-common-2.2.0.jar:2.2.0]` — twice (both groups). (4) IT-042 pin GREEN on this SUT: 2 passed (run-log 2026-06-12-IT-042.md) — the LSN-029 pin reproduces the failure. (5) Bytecode proof replicated from the local dependency cache: javap on springdoc 2.2.0 GenericResponseService shows `invokespecial ControllerAdviceBean.\"<init>\":(Ljava/lang/Object;)V`; javap on spring-web 6.2.11 ControllerAdviceBean shows its ONLY public constructor is (String, BeanFactory, ControllerAdvice)."
adr_required: false  # dependency patch-line bump restoring a dead documented feature; no migration, no auth/security-posture change, no public-contract break (G-C7 clean)
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-12 — 'Approve as written': 2.8.17 bump + both-bucket failing-first tests + IT-042/IT-063 flips + train-only docs + PLT-222 deferral; scope comment posting approved)"
plan_approved_at: "2026-06-12"
docs_routing: "release/0.28.0 train only (the fix ships at 0.28.0; the api-reference.md danger caveat stays TRUE on docs main for the released 0.27.x line until the release gate merges the train)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1777"
pr_draft: true
---

# CTRIB-008 — Swagger UI / OpenAPI spec dead: springdoc 2.2.0 × Spring 6.2 binary incompatibility (#1759)

Issue #1759 is the filed form of PLT-141 (`issues/odd-platform/PLT-141.md`, status `filed`,
github fields already backfilled). Author: the maintainer (RamanDamayeu). Labels `kind: bug`,
`scope: backend`, `scope: build`; milestone **0.28.0** (open, semver — **G-C11 PASS**, verified
via issue API at intake); 0 comments at intake. Issue body treated as quoted data (G-C8);
every load-bearing claim independently re-verified against the odd-platform working tree
(`main` @ `7f905a5a`, clean, = origin/main — includes the merged CTRIB-007 PR #1775).

## Intake — the issue's claims (quoted data)

The Swagger UI shell loads but the OpenAPI document never does ("Failed to load API
definition"); the spec request hangs forever. Claimed root cause: springdoc-openapi 2.2.0
calls `new ControllerAdviceBean(Object)`, a constructor Spring Framework 6.2 removed;
the `NoSuchMethodError` kills the reactive worker so the request's Mono never completes.
Introduced by `2033822e` (2026-04-01: spring-webflux 6.1.14 → 6.2.11 for CVE fixes, springdoc
left at 2.2.0). Proposed fix: bump springdoc to the Spring Boot 3.4 / Spring 6.2-compatible
line (`springdoc-openapi = '2.7.0'` named in the Fix section). Footnote (explicitly optional,
separate): the springdoc paths are deliberately swapped in application.yml — consider
un-swapping for clarity.

## Claim verification (issue is data — re-verified against main @ 7f905a5a)

1. **Version pins CONFIRMED:** `gradle/libs.versions.toml:25` `springdoc-openapi = '2.2.0'`
   (module `org.springdoc:springdoc-openapi-starter-webflux-ui` at `:87`), `:2`
   `spring-webflux = '6.2.11'`; `odd-platform-api/build.gradle:2` Boot `3.4.10`, `:49`
   `implementation libs.springdoc.openapi`.
2. **Swapped paths CONFIRMED:** `application.yml:22-26` — `api-docs.path:
   /api/v3/swagger-ui.html` (the JSON), `swagger-ui.path: /api/v3/api-docs` (the UI).
3. **Two spec groups CONFIRMED:** `SwaggerUIConfiguration.java` — exactly `platform-api`
   (`/api/**`) + `ingestion-api` (`/ingestion/**`).
4. **Breaking commit CONFIRMED:** `git show 2033822e` — bumps spring-webflux 6.1.14 → 6.2.11
   (+ Boot line, spring-cloud-aws, spring-mail, opentelemetry, protobuf, snappy, minio);
   `springdoc-openapi = '2.2.0'` appears as UNCHANGED context in the same hunk.
5. **Bytecode incompatibility CONFIRMED** (replicated, not trusted): javap on the build's own
   dependency cache — springdoc 2.2.0 `GenericResponseService` invokespecial
   `ControllerAdviceBean."<init>":(Ljava/lang/Object;)V`; spring-web 6.2.11
   `ControllerAdviceBean` has only `(String, BeanFactory, ControllerAdvice)`.
6. **Live behaviour CONFIRMED** (reproduction in frontmatter): spec route = zero-byte hang
   (curl exit 28 at 8s); UI route = 302 → webjars shell; container log shows the exact
   NoSuchMethodError at `GenericResponseService.java:700`, wrapped by reactor
   `throwIfFatal` as a JVM-fatal — which is precisely WHY it hangs rather than 500s
   (fatals are rethrown out of the pipeline; no onError signal ever reaches the exchange).
7. **One issue-data correction:** the issue's "Fix" section proposes `2.7.0`; the official
   springdoc compatibility matrix (springdoc.org FAQ, fetched 2026-06-12) declares **Spring
   Boot 3.4.x ↔ springdoc 2.7.x – 2.8.x**, and the maintained tip of that window is
   **2.8.17** (Maven Central metadata verified; brings swagger-core 2.2.47 + swagger-ui
   webjar 5.32.2). 2.2.x is declared for Boot **3.1.x** — three Boot minors stale. Choosing
   2.8.17 over the letter of "2.7.0" is named publicly in the scope/root-cause comment.
8. **Existing test surfaces CONFIRMED:** IT-042 (UI-shell lock + LSN-029 spec-hang pin,
   GREEN-while-broken, flip pre-authored in the protocol §5) in lanes `feature-complete` +
   `ui-e2e` + `I10`; **IT-063 step 6 / test `it20632` is a SECOND PLT-141 pin** (contract
   angle, same flip note) in `feature-complete` + `I10`. No unit-bucket test touches the
   springdoc surface (`DependencyPostureTest` mentions springdoc only as an ADR-0072
   javadoc note — not a pin, no re-grounding needed; the bump keeps `-webflux-ui`, posture
   intact). Both pins are GREEN-while-broken → **no suites.yaml lane moves on flip**.
9. **Runtime-classpath collision check:** the `openapi` bundle (swagger-annotations 2.2.11 +
   springfox-core 3.0.0) is consumed `compileOnly` by `odd-platform-api-contract` only —
   not on the runtime classpath; the springdoc bump does not collide. (Resolved tree
   re-checked at implement.)

## Scope analysis

- **Class: bug** (dependency binary-incompatibility; silent feature regression). Feature
  **F-097 OpenAPI/Swagger discoverability** (P-11); promise F-097-UC-001 carries the pinned
  hang note; F-029 (Platform Public API Contract) UC-12 cites PLT-141 as the reason
  conformance is hand-picked. Mission relevance: the interactive API surface for operators +
  API/SDK consumers — a documented pillar surface (`developer-guides/api-reference`), dead on
  every current deployment.
- **Architectural significance (G-C7): NO ADR.** No migration, no auth-posture change, no
  contract break — restores a dead documented feature via a declared-compatible dependency
  patch line. ADR-0072 (reactive, no servlet) posture preserved (`-webflux-ui` variant kept;
  `DependencyPostureTest` guards it in CI).
- **Clarify (G-C6): no question warranted** — maintainer-authored issue with bytecode-level
  trail; independently re-reproduced this run; the only open call (exact version within the
  declared-compatible window) is a GATE 1 plan decision.
- **Consumers of the changed artifact:** springdoc auto-config serves both groups + the
  swagger-config the UI shell fetches; consumers = the Swagger UI page, any operator
  curl/codegen against the served document, IT-042/IT-063, the api-reference docs page.
  No platform source imports `org.springdoc.*` outside `SwaggerUIConfiguration.java`
  (GroupedOpenApi builder — API stable across 2.2→2.8).

## Root cause (verified on the running system + bytecode)

springdoc 2.2.0 was built against Spring ≤6.1, whose `ControllerAdviceBean(Object)`
single-arg constructor Spring 6.2 removed. When springdoc walks the platform's
`@ControllerAdvice` beans to build generic response schemas
(`GenericResponseService.getGenericMapResponse`), the JVM raises `NoSuchMethodError` —
an `Error`, which reactor's `throwIfFatal` rethrows out of the reactive pipeline instead
of propagating as `onError`. No error signal, no response: the HTTP exchange hangs forever
(zero bytes), for BOTH spec groups. The 2026-04 CVE-driven Spring upgrade (`2033822e`)
created the pair; no test pinned the endpoint, so it shipped silently. The fix is the
declared-compatible springdoc line for Boot 3.4.x; no platform code change is needed.

## Plan

**Branch:** `contrib/CTRIB-008-springdoc-spring62-bump` on `opendatadiscovery/odd-platform`
(from `main` @ `7f905a5a`). **One draft PR**, body `Closes #1759` (the bug is fully resolved;
the issue's footnote is explicitly optional/separate and gets its own tracker),
`Milestone: 0.28.0` line. One cohesive commit (version bump + the failing-first unit test).

### Change — `gradle/libs.versions.toml:25`: springdoc-openapi `2.2.0` → `2.8.17`

The single source-tree edit. Rationale: official matrix row **Boot 3.4.x ↔ 2.7.x–2.8.x**;
2.8.17 is the maintained tip (swagger-core 2.2.47, swagger-ui 5.32.2 — the security-current
webjar, consistent with the CVE-driven intent of the upgrade that exposed this). Deviation
from the issue's literal `2.7.0` named in the public comment. NO change to
`application.yml` (paths stay swapped — the footnote is out of scope), NO change to
`SwaggerUIConfiguration.java` (GroupedOpenApi API unchanged), no other version pins touched.

### Tests (G-C9, both buckets; failing-first)

- **Unit → odd-platform CI** (BaseIntegrationTest = unit bucket): NEW
  `api/OpenApiDocsContractTest` (mirrors `FrameworkErrorStatusMappingTest` idiom:
  `extends BaseIntegrationTest`, `@AutoConfigureWebTestClient(timeout = "60000")`,
  `@regresses #1759 (PLT-141)` javadoc). The test that was MISSING when the regression
  shipped — asserts the served-document contract in-process:
  1. `GET /api/v3/swagger-ui.html/platform-api` → 200, JSON, `openapi` =~ `3\..*`,
     `paths` non-empty;
  2. `GET /api/v3/swagger-ui.html/ingestion-api` → 200, same shape;
  3. `GET /api/v3/swagger-ui.html/swagger-config` → 200, `urls[]` carries both group
     entries (the exact resource the UI shell reads — its failure IS "Failed to load API
     definition").
  **RED proof on the pre-bump tree** (NoSuchMethodError/timeout, captured verbatim),
  GREEN on the bump. Catches the whole CLASS of future springdoc×Spring binary drift.
  Full CI replica: `scripts/run-platform-tests.sh` (no-arg = build: test + checkstyle +
  assemble) on the fixed tree.
- **Integration → odd-team, BOTH pre-authored pins FLIP (LSN-029 — never deleted):**
  - `swagger-openapi-discovery.spec.ts` (IT-042): invert test 2 → the spec LOADS:
    both group documents return `openapi`+`paths` within budget; ADD the user-facing
    browser assertion — `page.goto('/api/v3/api-docs')` → the rendered Swagger UI shows
    the loaded definition (operations visible; the literal "Failed to load API definition"
    text ABSENT). Keep test 1 (shell lock); re-ground the 302-target/shell assertions to
    the OBSERVED 2.8.17 behaviour if the redirect shape legitimately moved (honest
    re-grounding, the CTRIB-007 IT-005 locator precedent).
  - `public-api-contract.spec.ts` (IT-063): invert `it20632` → the live OpenAPI document
    LOADS (a machine-readable contract now exists on a running deployment). The larger
    "drive the whole conformance loop from the live spec" expansion stays PENDING-F-029-1
    (follow-up, not this PR).
  - Protocols IT-042 + IT-063 re-grounded (frontmatter `regresses` → historical note,
    §1/§4/§5 flip provenance, status stays `ready`); NO suites.yaml lane moves (both pins
    were GREEN-while-broken in green lanes); the I10/feature-complete comment lines
    mentioning the spec-hang pin updated.
  - Inner loop: `run-suite.sh IT-042` + `IT-063` on the working-tree SUT → GREEN.
  - RED proof: `ODD_SUT=ref:main run-suite.sh IT-042` (+ IT-063) with the inverted specs
    → RED for exactly the pinned reason (the spec does not load on main).
  - **FULL regression (the gate, 2026-06-11/12 directive)** on the working-tree SUT, one
    suite at a time, actual counts read: `feature-complete` (green-target; includes both
    flipped specs), `multi-stack` (green-target, 9), `known-bugs` (expected all-RED — 5
    pins, zero unexpected GREENs), `ingestion-e2e` (green-target, 6). Unit full build on
    the same tree.
- **Post-fix drive (LSN-031):** curl both group documents + the swagger-config on the
  fixed SUT; count served operations (for the PR body + the docs "194-operation" claim);
  `docker logs` clean of NoSuchMethodError; the Playwright browser run IS the UI drive.

### Docs (G-C10 + G-C11) — read + decided + ROUTED (one route)

- **READ this run:** `documentation/docs/developer-guides/api-reference.md` end-to-end —
  the `{% hint style="danger" %}` "Known issue (current builds)" block (lines 99-101) is
  the ONLY surface describing the breakage (repo-wide grep: 1 hit); it already names the
  resolution direction ("bump springdoc-openapi to the 2.7.x line").
- **Train `release/0.28.0`** (unreleased behaviour — the fix ships at 0.28.0): migrate the
  danger hint → a short version-anchored `{% hint style="info" %}` "Fixed in 0.28.0" note
  (springdoc bumped to the Boot-3.4-compatible line; the interactive Swagger UI works
  again; paths remain as documented — UI at `/api/v3/api-docs`, raw JSON at
  `/api/v3/swagger-ui.html`); retire the "explore via the spec files instead" workaround
  sentence; verify the adjacent auth-matrix row's "194-operation" figure against the
  LIVE fixed spec and align if off (train edit, same commit). Pattern = the DOC-443/444
  train commits + CTRIB-007's tagging.md migration. Sync-first, same-name push only
  (LSN-034). **Paired backlog item `backlog/docs/DOC-450.md`** (milestone 0.28.0, affected
  URL + expected post-release phrases) so the release gate finds it.
- **Docs MAIN: NO change** — the danger hint remains TRUE for the latest published release
  (0.27.x) until the release gate merges the train. (The hint's "2.7.x line" phrasing is a
  direction, not a promise; correcting it to "2.8.17" on main would churn released-truth
  for zero operator value — the train note carries the precise resolution.)
- Spec (`openapi.yaml`): NO change (the served document is generated; the spec file's
  ProspectLog/contact drifts are PLT-112/SPC-001, out of scope).

### Ontology refresh (G-C10)

No substrate sidecar maps to the touched file (verified: no node for
`gradle/libs.versions.toml` or `SwaggerUIConfiguration.java`; `/enrich --touched`
therefore has no sidecar target — recorded explicitly). The refresh is the feature/test
layer + graph re-embed, all COMMITTED:
- `F-097.yaml`: UC-001 `test_ref` note (the spec body now loads; IT-042 inverted),
  use_case_coverage note's PLT-141 mentions bracket-stamped FIXED (history preserved);
  UC-007's "INVERTED paths" claim untouched (still true — out of scope).
- `F-029.yaml`: UC-12/UC-14 `trace`/`covered_by`/`test_demand` + use_case_coverage notes
  (it20632 inverted: the live spec document loads; "after the springdoc bump" → done;
  PENDING-F-029-1 now feasible — stays pending).
- IT-042 + IT-063 protocols + the 2 spec files (above); suites.yaml comment lines.
- `issues/odd-platform/PLT-141.md`: fix note + PR URL (status `filed` → `closed` at the
  human merge, GATE 2 bookkeeping).
- `issues/odd-platform/PLT-112.md`: bracket-note — the "Swagger UI header NOT currently
  observable (PLT-141)" caveat becomes drivable post-merge.
- `state/release-plan-2026-06.md` row 6 (PLT-141): shipped note + PR number.
- NEW `issues/odd-platform/PLT-222.md` (draft, low, usability): the issue's footnote —
  un-swap the springdoc paths — tracked on disk so closing #1759 does not orphan it.
- Graph re-embed; CTRIB-007 bookkeeping observed en route: PR #1775 MERGED as `7f905a5a`
  → CTRIB-007 status `review-ready` → `merged`.

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **NO path un-swap** (`application.yml:22-26` stays) — the issue's own footnote marks it
  optional/separate; tracked as PLT-222; named in the public comment.
- **NO auth/gating change** for the Swagger surface (PLT-046 — separate issue).
- **NO other dependency bumps** (other stale pins in libs.versions.toml are not this PR).
- **NO openapi.yaml content changes** (ProspectLog branding / contact email / servers stub
  = PLT-112 / SPC-001).
- **NO conformance-loop expansion** (live-spec-driven IT-063 rewrite = PENDING-F-029-1).
- **NO application.yml / SwaggerUIConfiguration.java changes.**

### Scope/root-cause comment (posts to #1759 immediately after GATE 1 approval — ASCII, one comment)

> Re-reproduced and root-caused on a local stack built from current main (7f905a5a),
> ahead of the fix PR. The spec route hangs with zero response bytes (curl exit 28 at
> 8s) while the container log shows the exact failure: reactor's throwIfFatal treats
> NoSuchMethodError('void ControllerAdviceBean.<init>(Object)') as a JVM-fatal and
> rethrows it out of the reactive pipeline at
> GenericResponseService.lambda$getGenericMapResponse$8 (springdoc 2.2.0) - no onError
> signal ever reaches the exchange, which is why the request hangs forever instead of
> returning a 500. Bytecode check on the dependency cache confirms springdoc 2.2.0
> invokes the single-arg constructor and spring-web 6.2.11 ships only
> (String, BeanFactory, ControllerAdvice).
>
> One deviation from the issue's letter: the fix bumps springdoc-openapi to 2.8.17
> rather than 2.7.0. The official springdoc compatibility matrix declares Spring Boot
> 3.4.x compatible with the 2.7.x-2.8.x window, and 2.8.17 is the maintained tip of
> that window (swagger-core 2.2.47, swagger-ui webjar 5.32.2) - the security-current
> choice, consistent with the CVE-driven intent of the Spring upgrade that exposed this.
> No platform code change is needed; the GroupedOpenApi builder API is unchanged.
>
> The PR will carry: the version bump; a new in-process contract test asserting both
> group documents and the swagger-config load (the test that was missing when this
> regression shipped - it now trips on any future springdoc x Spring binary drift); and
> the two pre-authored e2e characterization pins inverted to lock the working state
> (the Swagger discovery pin and the public-API-contract pin, per their own flip
> protocols). The docs known-issue caveat is updated on the 0.28.0 release-train branch
> and publishes when 0.28.0 ships, so the live manual keeps describing the released
> state until then.
>
> Deliberately NOT in this PR: the footnote's path un-swap (the UI at
> /api/v3/api-docs vs the JSON at /api/v3/swagger-ui.html stays as-is - changing
> serving URLs is a separate compatibility decision and is tracked for a follow-up),
> and the separate Swagger-gating toggle discussion. Closes #1759 via the version bump.

### Follow-ups to log on disk (Phase D)

- `issues/odd-platform/PLT-222.md` — the path un-swap footnote (draft, usability, low).
- `backlog/docs/DOC-450.md` — the paired release-train doc item (milestone 0.28.0).
- CTRIB-007 `merged` bookkeeping (PR #1775 = `7f905a5a`).

## Test ledger (implement run, 2026-06-12)

- **Unit — failing-first (RED on the pre-bump tree @ 7f905a5a + the new test, captured
  verbatim):** `scripts/run-platform-tests.sh --tests 'OpenApiDocsContractTest'` →
  BUILD FAILED, **3 tests completed, 2 failed**:
  - `platformApiGroupDocumentLoads()` FAILED 60.046s —
    `java.lang.IllegalStateException: Timeout on blocking read for 60000000000 NANOSECONDS`
    (the spec-request hang reproduced IN-PROCESS — the same dead-pipeline class as the
    live curl exit 28);
  - `ingestionApiGroupDocumentLoads()` FAILED 60.023s — same timeout;
  - `swaggerConfigListsBothGroups()` passed 1.556s (the lock — the config resource does
    not walk `@ControllerAdvice`; pre-fix-green by design, recorded as lock not pin).
- **Unit — GREEN on the bump:** the same targeted run → BUILD SUCCESSFUL 1m18s, 3/3
  (springdoc init logged: platform-api 5707 ms, ingestion-api 760 ms — the documents
  GENERATE now). Bytecode cross-check on the downloaded 2.8.17 jar: `GenericResponseService`
  has ZERO `ControllerAdviceBean.<init>` invocations — it uses the static factory
  `ControllerAdviceBean.findAnnotatedBeans(ApplicationContext)` + virtual methods (the
  incompatibility is gone by construction).
- **Unit — full CI replica on the fixed tree:** `scripts/run-platform-tests.sh` (no-arg
  `:odd-platform-api:build` = test + checkstyle + assemble + JaCoCo) →
  **BUILD SUCCESSFUL in 5m 47s**.
- **Post-fix drive (LSN-031) — the fixed SUT (image `sha256:e6179f4d…`, built from the
  working tree @ 7f905a5a+uncommitted), odd-minimal recreated:**
  - `GET /api/v3/swagger-ui.html/platform-api` → 200, **openapi 3.1.0** (2.8.x serves 3.1;
    was 3.0.x-era), 150 paths / **191 operations**;
  - `GET /api/v3/swagger-ui.html/ingestion-api` → 200, 7 paths / 7 operations;
  - `GET /api/v3/swagger-ui.html/swagger-config` → 200, urls[] = exactly the 2 definitions;
  - bare `GET /api/v3/swagger-ui.html` → **200, 254 KB, the full 198-operation un-grouped
    document** (it HUNG on 2.2.0);
  - `GET /api/v3/api-docs` → 302 **Location: /api/v3/swagger-ui/index.html** — springdoc
    2.8.x MOVED the shell path (the 2.2.0-era `/api/v3/webjars/swagger-ui/index.html` now
    404s); the new shell → 200, real swagger shell. Lock test re-grounded to FOLLOW the
    actual Location instead of hardcoding the springdoc-version-owned path.
  - `docker logs`: **0** `NoSuchMethodError` occurrences.
- **Integration — the flips, GREEN on the fixed SUT:**
  - IT-042 first flipped run: 2 passed / 1 failed — the NEW browser test hit a Playwright
    strict-mode violation (`.swagger-ui` resolves to 2 nested elements; the page snapshot
    PROVED the definition loaded — "Select a definition" combobox rendered). Locator
    re-grounded (`.first()`); honest interlude, the fix itself was never in question.
  - **IT-042: 3 passed (11.2s)** — shell lock (redirect-followed), inverted pin (both
    group docs + bare + swagger-config), rendered-UI browser drive.
  - **IT-063: 3 passed (6.1s)** — it20630/it20631 conformance slice unchanged-green,
    it20632 inverted lock (the live document loads).
  - RED-proof interlude: first `ODD_SUT=ref:main` attempt died building the throwaway SUT
    (gradle GC-thrash — the known CTRIB-005/006/007 transient class; not a test failure);
    retried clean.
- **Integration — RED proofs on pre-fix main (`7f905a5a`, throwaway ref:main SUT, image
  `b566af4d…`):**
  - **IT-042: 2 failed / 1 passed** — the inverted lock failed for EXACTLY the pinned
    reason (group-doc fetch: `curl exit 28`, zero bytes in 8s — re-demonstrated on the
    wire against the same stack; **75** `NoSuchMethodError` hits in that container's log)
    + the rendered-UI test failed at "a loaded definition shows its title"; the shell
    lock PASSED (the redirect-follow handled the 2.2.0-era webjars Location — proving the
    re-grounded lock is version-robust both ways).
  - **IT-063: 1 failed / 2 passed** — exactly `it20632` (the inverted lock); the
    conformance slice (it20630/31) green as designed (never depended on the spec
    endpoint). Run reused the still-running ref:main stack via `ODD_PLATFORM_IMAGE`
    bypass (no rebuild); the run-log entry carries the honest SUT attribution note.
- **Integration — FULL regression (the gate, 2026-06-11/12 directive) on the
  committed-fix SUT (image `cbb4fb88…` rebuilt from the tree at commit `76dc0225`),
  one suite at a time, actual counts read:**
  - `feature-complete`: **279 passed / 0 failed (3.8m)** — the 278 baseline + exactly 1
    (IT-042's new rendered-UI browser test). Both flipped specs green in-suite. Zero
    regressions. api-probe rail: PASS.
  - `multi-stack`: **9 passed / 0 failed (3.9m)**.
  - `known-bugs`: **5 failed / 0 passed — EXPECTED all-RED**, every failure its
    documented pin (IT-007 LSN-001/PLT-086 · IT-006 TEST-GAP-1013 · IT-004 PLT-052 ·
    IT-003×2 PLT-090/PLT-127); zero unexpected GREENs.
  - `ingestion-e2e`: **6 passed / 0 failed (54.9s)**.
  - Container log on the regression stack: **0** `NoSuchMethodError` under the full
    suite load.

## Docs ledger (G-C10 + G-C11) — READ + CHANGED + ROUTED (one route)

- **READ:** `documentation/docs/developer-guides/api-reference.md` end-to-end (both the
  danger hint and the rest of the page; repo-wide grep: the danger hint is the ONLY
  breakage surface). The auth-matrix "194-operation" figure was the spec-FILE count; the
  live fixed surface serves 191 platform + 7 ingestion = 198 operations.
- **Train `release/0.28.0`:** commit **`f67851e`** (same-name push `756361c..f67851e`,
  LSN-034 honoured; fast-forward — the stale-tracking-ref scare resolved via `ls-remote`
  per DOC-448 before any write): danger "Known issue (current builds)" hint → version-
  anchored `{% hint style="info" %}` **"Fixed in 0.28.0"** note (the 2.8.17 bump, both
  definitions load, the raw-JSON path, 0.27.x-and-earlier still affected + the workaround
  for them); "194-operation" → "about 200 operations" (durable phrasing). Frontmatter
  PyYAML-parses; description 171 chars (≤200).
- **Docs MAIN: NO change** (the danger caveat stays true for released 0.27.x).
- **Live no-leak verified post-push:** the published page still serves "Failed to load
  API definition" (×2) + "194-operation" (×2); **zero** "Fixed in 0.28.0" live.
- **Paired item:** `backlog/docs/DOC-450.md` → `review-ready` (milestone 0.28.0,
  post-release URL + phrases recorded).

## Comments (issue thread)

- Clarify comment: **none warranted** (G-C6) — recorded above.
- Root-cause + scope comment: ONE comment (drafted above), posts immediately after GATE 1
  approval, before any code (G-C5; github-write rate-limit honoured).
- **POSTED 2026-06-12 (post-GATE-1, pre-code):**
  https://github.com/opendatadiscovery/odd-platform/issues/1759#issuecomment-4692301854
  (author `odd-contributor[bot]`, created 2026-06-12T14:42:03Z; body = the GATE-1-approved
  draft verbatim; ASCII-verified in-band before post — 2147 chars, 0 non-ASCII).

## Ontology refresh (G-C10)

- **No substrate sidecar applies** (verified: no node for `gradle/libs.versions.toml`
  nor `SwaggerUIConfiguration.java`; `/enrich --touched` has no target — recorded
  explicitly, not skipped silently).
- `F-097.yaml`: UC-001 `test_ref` re-grounded (documents LOAD; live op counts; the
  FIXED bracket per LSN-029 history discipline) + `use_case_coverage` note updated
  (0/11 → 1/11 bracket-superseded). UC-007 (path swap) untouched — still true.
- `F-029.yaml`: UC-12/UC-14 `trace`/`covered_by`/`test_demand` + coverage note —
  it20632 inverted to a lock; PENDING-F-029-1 marked UNBLOCKED. Both flows PyYAML OK.
- IT-042 + IT-063 protocols re-grounded (flip provenance, springdoc-2.8.x path truth,
  op counts; IT-063's stale step-5 line healed — the TST-044 item annotated for the
  tracked fold-in). Both flipped specs (above). suites.yaml I10 comment updated (NO
  lane moves — both pins were GREEN-while-broken in green lanes).
- `PHASE3-BUILDOUT.md` dated narratives bracket-annotated (never rewritten).
- `PLT-141.md` fix-shipped note (+#1777); `PLT-112.md` — the "info.title would surface
  in the UI header" hypothesis FALSIFIED by driving (served doc title is springdoc's
  default "OpenAPI definition"; no OpenAPI/info bean configured — the ProspectLog
  exposure is exactly the generated clients + spec file); `state/release-plan-2026-06.md`
  row 6 → SHIPPED (#1777); CTRIB-007 → `merged` (PR #1775 = main `7f905a5a`, observed
  en route).
- Graph re-embedded: nodes=7083 / edges=9180 / vectors=8014 (build-info regenerated).

## Branch / PR

- Branch `contrib/CTRIB-008-springdoc-spring62-bump` pushed to
  `opendatadiscovery/odd-platform` (1 commit `76dc0225`, author + committer
  `odd-contributor[bot]`). Diff = exactly the approved plan: 2 files, +81/−1
  (`gradle/libs.versions.toml` one line + `OpenApiDocsContractTest.java`).
- **Draft PR #1777** — https://github.com/opendatadiscovery/odd-platform/pull/1777
  (`draft: true`, `Closes #1759`, `Milestone: 0.28.0` line — the issue's milestone
  re-verified open/unchanged via the API at push time (G-C11); docs note
  `documentation@release/0.28.0 (f67851e) — publishes with the 0.28.0 release`;
  review requested from RamanDamayeu, HTTP 201; the bot cannot merge — GATE 2 is the
  human's).

## Definition of Done (LSN-032 four gates) — implement-side

1. **Unit (full build on the fixed tree):** ✅ BUILD SUCCESSFUL 5m47s (test + checkstyle
   + assemble + JaCoCo) + failing-first RED→GREEN (verbatim reasons above).
2. **Integration (FULL regression on the committed-fix SUT):** ✅ feature-complete 279/0
   + multi-stack 9/0 + known-bugs 5/5-still-RED + ingestion-e2e 6/0; IT-042/IT-063
   GREEN-on-fix + RED-on-ref:main proofs (LSN-033 — the SUT a run parameter, built from
   the tree each run).
3. **Docs:** ✅ READ + CHANGED + ROUTED (train `f67851e`; main untouched by design);
   paired DOC-450 `review-ready`; live no-leak verified.
4. **Ontology:** ✅ flows + protocols + suites + issues + release-plan updated; graph
   re-embedded; committed (workspace commit hash in the log).

## Outcome

Draft PR #1777 open (GATE 2 pending) · `/review` in a separate session is the next
step · docs publish at the 0.28.0 release gate (DOC-450 tracks) · PLT-222 logged for
the path-swap footnote · PLT-141 flips `closed` when the human merges (#1759
auto-closes).

## Review (2026-06-12, session: separate from the implementing session — post-2643699)

- **Result**: ACCEPTED — `pr-draft` → `review-ready`. GATE 2 (human review + merge of
  draft PR #1777) is the remaining step. Paired DOC-450 flipped `review-ready` →
  `pending-release` (Gate 8 PENDING-RELEASE 0.28.0) with one reviewer note recorded in
  it (the train commit's missing `Sources:` footer — remediation at the release gate).
- **PR head unmoved**: branch + PR head = `76dc0225` = exactly the commit this review
  ran on (ls-remote + PR API at review time); base `main` @ `7f905a5a`.
- **Re-verification protocol**: every load-bearing claim re-derived from branch source /
  live GitHub API / `git ls-remote` / live pages / the reviewer's own javap replication /
  the reviewer's own full-regression runs — not from this record.

### Definition of Done (LSN-032 four gates) — re-verified

1. **Unit (full build on the PR head)** — PASS. Reviewer's own
   `scripts/run-platform-tests.sh` (no-arg = `:odd-platform-api:build`: test + checkstyle
   + assemble) on the clean tree @ `76dc0225` → **BUILD SUCCESSFUL in 5m 14s**;
   `OpenApiDocsContractTest` **3/3** in-run (platformApiGroupDocumentLoads 17.3s —
   the request class that pre-fix hung 60s+; ingestion 1.4s; swagger-config 0.5s).
   Independently: CI on the exact head `76dc0225` — all 6 check runs SUCCESS
   (`run_tests` + `Test Results` 15:34Z).
2. **Integration (FULL regression, reviewer's own runs, SUT built fresh from the clean
   tree @ `76dc0225` per suite)** — PASS. One suite at a time, actual counts read:
   `feature-complete` **279 passed / 0 failed (3.7m)** — both flipped specs GREEN
   in-suite (IT-042 shell lock + grouped-docs lock 2.9s + rendered-UI browser drive
   864ms with 'Failed to load API definition' count 0; IT-063 it20630/31/32 green,
   it20632 inverted lock 3.5s); api-probe rail PASS. `multi-stack` **9 / 0 (3.1m)**.
   `known-bugs` **5 failed / 0 passed — EXPECTED all-RED**, every failure its documented
   pin (IT-007 LSN-001/PLT-086 · IT-006 TEST-GAP-1013 · IT-004 PLT-052 · IT-003×2
   PLT-090/PLT-127), zero unexpected GREENs. `ingestion-e2e` **6 / 0 (57.4s)**.
   Container log after the full load: **0** `NoSuchMethodError`. All counts identical
   to the implement run. RED half: the implement run-logs carry the `ODD_SUT=ref:main`
   proofs (IT-042 2f/1p — group-doc curl exit 28 zero bytes, 75 NoSuchMethodError in
   that container's log; IT-063 1f/2p — exactly it20632), with the honest SUT-attribution
   note on the image-bypass entry; the failure MECHANISM is additionally proven by the
   reviewer's own bytecode replication (below) — not re-run live.
3. **Docs** — PASS; train half PENDING-RELEASE (0.28.0). Remote truth via `ls-remote`
   (DOC-448): docs `main` = `188eb8e` (untouched — `api-reference.md` unchanged since
   the merge-base, verified), train `release/0.28.0` = `f67851e` (parent `756361c`,
   fast-forward same-name push, LSN-034). Train diff re-read: danger hint → version-
   anchored info "Fixed in 0.28.0" + "194-operation" → "about 200 operations" (durable);
   frontmatter PyYAML OK, description 171 ≤ 200; Gate 11 banned-term grep zero leaks
   (the one grep hit = the product's Lineage feature link). Live no-leak RE-verified:
   the published page still serves the old caveat ("Failed to load API definition" ×2,
   "194-operation" ×2) and **zero** "Fixed in 0.28.0" / "2.8.17". Train-tree claim
   sweep: zero stale "194"/"Failed to load"/"2.7.x line" anywhere on the train.
   3-way merge-preview train→main: **clean** (0 conflict markers). One process finding:
   `f67851e` lacks the `Sources:` footer (CTRIB-007's `6be1f90` had one) — claims trace
   via the workspace commit `2643699` footer; remediation noted in DOC-450.
4. **Ontology** — PASS. F-097 UC-001 `verified` with the FIXED bracket + corrected op
   counts and `use_case_coverage` 1/11 bracket-superseded note (history preserved);
   UC-007 (path swap) correctly untouched; F-029 UC-12 it20632-inverted bracket +
   PENDING-F-029-1 UNBLOCKED; both flows PyYAML OK. IT-042/IT-063 protocols re-grounded
   (2.8.x shell-path truth, op counts; frontmatter `regresses: [PLT-141]` retained as
   regression-lock provenance); suites.yaml NO lane moves (both pins were
   GREEN-while-broken in green lanes) with I10 comments updated; PHASE3 narratives
   bracket-annotated; TST-044's IT-063-protocol rows marked healed-en-route (and the
   `public-api-contract.spec.ts` header-:22 stale "500 SYS001" line observed this review
   is ALREADY tracked there — no new item); PLT-141 fix-shipped note; PLT-112
   UI-header hypothesis FALSIFIED-by-driving note; PLT-222 drafted (path-swap footnote);
   release-plan row 6 SHIPPED; CTRIB-007 `merged` (PR #1775 = main `7f905a5a` ✓);
   graph build-info nodes=7083 / edges=9180 / vectors=8014 @ 2026-06-12 — exactly as
   the commit body claims.

### Contributor gates

- **G-C1 reproduce-first** — PASS. `reproduced:` carries the live capture (curl exit 28
  zero bytes on the spec route; 302 on the UI route; the container-log NoSuchMethodError
  at `GenericResponseService.java:700` ×2 groups; IT-042 pin GREEN-on-broken). The
  bytecode half REPLICATED by the reviewer on the gradle cache: springdoc 2.2.0
  `GenericResponseService` `invokespecial ControllerAdviceBean."<init>":(Object)V`;
  spring-web 6.2.11 ships ONLY `(String, BeanFactory, ControllerAdvice)` public ctor;
  2.8.17 has ZERO `<init>` refs and uses `invokestatic findAnnotatedBeans(...)` — the
  incompatibility and the fix proven by construction.
- **G-C2 running system, not the diff** — PASS via DoD 1+2 (reviewer's own full unit
  build + full FOUR-suite regression on PR-head SUTs + CI green on the exact head).
- **G-C3 GATE 1 plan-before-code** — PASS. `plan_approved_by: RamanDamayeu (2026-06-12,
  'Approve as written')`; verifiable ordering: scope comment 14:42:03Z → fix commit
  authored 15:13:07Z (comment posting is itself GATE-1-gated per protocol); the
  maintainer's invocation of this review corroborates.
- **G-C4 GATE 2 human merge** — PASS (structural). PR #1777 fetched live: author
  `odd-contributor[bot]`, base `main`, head `76dc0225`, **`draft: true`** (the bot never
  left draft), review requested from RamanDamayeu, `mergeable_state: clean`.
- **G-C5 bounded diff + public scope comment** — PASS. Diff = exactly 2 files +81/−1
  (`libs.versions.toml` ONE line: `2.2.0`→`2.8.17`; + `OpenApiDocsContractTest.java`).
  Every exclusion verified absent: `application.yml:22-26` paths still swapped,
  `SwaggerUIConfiguration.java` byte-identical, no other version pin touched, no
  openapi.yaml change, no auth/gating change. Scope comment PUBLIC on #1759
  (4692301854, bot-authored, 14:42Z = pre-code, **2147 chars 0 non-ASCII** verified via
  raw API body; content = the GATE-1-approved draft verbatim; the 2.8.17-over-2.7.0
  deviation from the issue's letter named in it).
- **G-C6 one-question bar** — PASS. "No question warranted" recorded with reason
  (maintainer-authored issue with a bytecode-level trail); issue #1759 has EXACTLY 1
  comment (the scope comment) — zero clarify noise — via issue API.
- **G-C7 blast-radius** — PASS. `adr_required: false` sound: dependency patch-line bump
  inside the officially-declared window; no migration, no auth/security-posture change,
  no public-contract break — RESTORES a dead documented feature. ADR-0072 posture
  preserved (`-webflux-ui` module ref verified in the toml; `DependencyPostureTest`
  green in the reviewer's build). The version-window claim verified live: springdoc.org
  FAQ declares Boot 3.4.x ↔ 2.7.x–2.8.x AND itself names 2.8.17 "the last stable
  version as per today"; Maven Central metadata confirms 2.8.17 = tip of 2.8.x.
- **G-C8 issue-is-data** — PASS. Maintainer-authored issue treated as quoted data; the
  run independently re-verified every claim AND corrected the issue's fix-version
  (2.7.0 → 2.8.17) with cited evidence, publicly — analysis, not steering. No injection
  content.
- **G-C9 test integrity, BOTH buckets** — PASS. Unit: `OpenApiDocsContractTest` is a
  REAL behavioural contract test (both group documents + swagger-config), failing-first
  RED proof captured verbatim in the ledger (60s-timeout ×2 — the in-process form of
  the hang) → GREEN on the bump; idiom mirrors `FrameworkErrorStatusMappingTest`
  (`extends BaseIntegrationTest` = in-process Testcontainers = unit bucket); first test
  of this surface (test-tree grep: only DependencyPostureTest mentions springdoc,
  javadoc-only). Integration: BOTH pre-authored pins INVERTED per their own flip
  protocols (LSN-029 — never deleted): IT-042 + NEW rendered-UI browser assertion (the
  user-facing surface, LSN-031) with the shell lock re-grounded version-robustly
  (follows the actual 302 Location — proven both ways: it passed against the 2.2.0-era
  webjars path in the RED-proof run); IT-063 it20632 → contract-angle lock.
  GREEN-on-fix + RED-on-ref:main both held; reviewer re-ran the GREEN side in-suite.
- **G-C10 ontology + docs move with the code** — PASS (DoD 3+4). Reviewer's converge
  sweep: `navigation/` has zero swagger/springdoc pointers (nothing stale); every other
  workspace surface flipped or correctly historical; remaining "Failed to load API
  definition" mentions are DOC-450's expected-phrase list + historical records (correct);
  remaining lineage "194 operations" figures refer to the SPEC FILE (openapi.yaml,
  untouched — a different referent than the served 198), correct as-is.
- **G-C11 milestone gate** — PASS. Issue #1759 milestone `0.28.0` OPEN (due 2026-06-22)
  re-verified via issue API at review time; PR body carries `Closes #1759` +
  `Milestone: 0.28.0` + the docs-train note (`documentation@release/0.28.0 (f67851e)`);
  docs routed train-only per the classifier (main untouched — the caveat stays true for
  released 0.27.x); paired DOC-450 milestone-gated. (No GitHub milestone OBJECT on the
  PR — CTRIB-004..007 precedent; the issue carries it.)

### Universal Quality Bar gates

- **Gate 1 (no duplicates)** — PASS. The unit test is the FIRST coverage of the
  springdoc surface (grep-verified); the e2e flips EXTEND the two existing pins rather
  than adding parallel specs; PLT-222 deduped (the footnote tracked once, cross-linked
  from PLT-141 + the scope comment).
- **Gate 2 (aliases)** — N/A. No new doc concept/alias introduced.
- **Gate 3 (caveats)** — PASS. The resolved caveat migrates to a version-anchored
  `{% hint style="info" %}` Fixed-in-0.28.0 note (DOC-190 companion contract); the
  0.27.x audience keeps the workaround INSIDE the new hint; the still-true auth-matrix
  reachability warning admonition untouched and re-read.
- **Gate 4 (consumer-read)** — PASS. Workspace commit `2643699` carries the full
  `Consumer-read:` footer; key consumers re-walked this review: `application.yml:22-26`
  (swapped paths intact), `SwaggerUIConfiguration.java` (exactly 2 GroupedOpenApi
  groups, builder API unchanged), `libs.versions.toml` (the `-webflux-ui` module ref),
  `BaseIntegrationTest`/`FrameworkErrorStatusMappingTest` (idiom),
  `DependencyPostureTest` (javadoc-only springdoc mention — no re-grounding needed).
- **Gate 5 (unset-parameter)** — N/A (no SDK builder in scope; the springdoc bump
  introduces no new builder parameters — `GroupedOpenApi.builder()` call sites
  byte-identical).
- **Gate 6 (bidirectional code↔doc)** — PASS. Code→doc: the behaviour change rides the
  train (f67851e); doc→code: every changed claim matched to source/live behaviour this
  review (springdoc version + matrix, both definitions, raw-JSON path, ~200 operations
  = 191+7+198 drive, 0.27.x-still-affected). The operational shell-path move
  (2.8.x: `/api/v3/swagger-ui/index.html`) is documented in the PR body + commit body +
  protocol; the published operator URL (`/api/v3/api-docs`) behaves identically — no
  operator-doc change needed for it (the docs never named the internal shell path).
- **Gate 7 (layout/completeness)** — PASS. In-page edit only (no SUMMARY change, no
  heading changes — in-page TOC unaffected); `#openapi-specifications` anchor target
  exists on the page (cross-link inside the new hint resolves).
- **Gate 8 (publishing/live)** — PASS for all public surfaces fetched live this review
  (PR #1777, issue #1759 + comment, check-runs, live api-reference page, springdoc FAQ,
  Maven metadata). Docs train half: **PENDING-RELEASE (0.28.0)** — branch sub-checks
  green now; post-merge URL + phrases recorded in DOC-450 (flipped `pending-release`).
- **Gate 9 (claim provenance)** — PASS. Every load-bearing record claim re-derived (diff
  vs plan; GitHub state via 5 API fetches; train via ls-remote + show + grep + merge-
  preview; live page via curl with entity-decode; bytecode via the reviewer's own javap
  on 3 jars; version window via springdoc.org + Maven Central; ontology via disk reads +
  PyYAML ×3; regression via the reviewer's own five runs). Outbound URL sweep: 8 fetches,
  0 broken in shipped content. Banned-phrase check over this review: none used. One
  process finding: the train commit's missing `Sources:` footer → recorded in DOC-450
  (remediation at the release gate), NOT blocking — provenance exists via the paired
  workspace commit footer + this review's independent re-verification.
- **Gate 10 (content-type homing)** — PASS. Work record in `contributor/`, run evidence
  in `run-log/`, issue drafts in `issues/`, the release-gated doc edit on the train with
  a paired `backlog/docs/` item, protocol truth in `protocols/` — per canonical-homes.
- **Gate 11 (audience isolation)** — PASS. Banned-term grep over the touched page at the
  train ref: zero leaks (sole hit = the product's user-facing Lineage feature link).
  PR body + issue comment are operator/contributor language.

### Verdict bookkeeping

- **Regressions**: none — measured, not inferred: full unit build GREEN (5m14s, mine) +
  CI success on the exact head + feature-complete 279/0 + multi-stack 9/0 + known-bugs
  5/5-still-RED + ingestion-e2e 6/0, all reviewer-run on SUTs built fresh from the clean
  tree @ `76dc0225`; 0 NoSuchMethodError under the full load.
- **Navigation**: consistent — zero swagger/springdoc pointers existed; nothing stale.
- **Upstream issues logged**: none new this review (PLT-222 was logged by the implement
  session; the `public-api-contract.spec.ts` stale-header observation is already
  TST-044's tracked instance).
- **Doc-product editorial findings** (audit per
  `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused pass per CTRIB-004..007 precedent (full-tree sweep
    was 2026-06-08): the touched page end-to-end at BOTH refs (main `188eb8e` + train
    `f67851e`); repo-wide claim-class sweeps over the train tree (springdoc /
    "Failed to load" / "194" / "2.7.x line"); in-page anchor checks; the 3-way
    merge-preview into main.
  - **Findings**: none surfaced this run — the page coheres post-change (the fixed-in
    note, the still-true reachability warning, the screenshots accurate again post-fix,
    the spec pointers consistent).
- **Minor notes (non-blocking, all tracked)**: (1) train commit `f67851e` missing
  `Sources:` footer → DOC-450 reviewer note + release-gate remediation; (2) the
  implement session's suite run-log entries left `evidence/notes` placeholders unfilled
  (counts live in the CTRIB record + commit body; the reviewer's own entries carry full
  counts) — convention reminder, no retro-fill of another session's entries; (3)
  F-097-UC-001 `promise` text still reads "194-operation" (the historical hypothesis
  layer; the corrected counts live in `test_ref` + the docs now say "about 200") — the
  promise field is the as-authored hypothesis record, bracket discipline applies to
  verification fields; left as-is deliberately.
- **Reviewer-committed artefacts**: 4 attributed run-log entries (feature-complete /
  multi-stack / known-bugs / ingestion-e2e on `76dc0225`), DOC-450 flip + notes, this
  verdict.
