---
id: CTRIB-008
github_issue_number: 1759
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1759
class: bug
milestone: "0.28.0"
status: pr-draft  # all four DoD gates met on the branch content; /review (separate session) then GATE 2 remain
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
