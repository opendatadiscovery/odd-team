---
id: CTRIB-013
github_issue_number: 1741
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1741
class: bug  # REMOTE attachment SDK builder leaves region unset -> AWS S3 restricted to us-east-1 (the canonical LSN-002 code-side residue)
milestone: "0.28.0"  # VERIFIED 2026-06-14 via GitHub API: #1741 is OPEN, milestone 0.28.0 is OPEN (due 2026-06-22). G-C11 SATISFIED. The fix is for UNRELEASED behaviour (no .region knob exists in any tag) -> ships in 0.28.0.
status: pending-release   # /review PASS 2026-06-15 (separate session, opus-4-8): full unit build GREEN re-run on the reviewed commit 6a9d2db8 (474 tests / 0 fail / 0 err, checkstyle clean, BUILD SUCCESSFUL 6m40s, both flipped pins fresh-green); IT-008 e2e:PASS on a fresh SUT built from 6a9d2db8 (digest 1a693f47). All contributor gates (G-C1..G-C13) + doc gates PASS. Integration scope this session = IT-008 only (maintainer-directed; the only spec exercising the @ConditionalOnProperty(REMOTE) change). Flipped pr-draft -> review-ready. NEXT: GATE 2 (human) merges DRAFT PR #1784; maintainer pushes DOC-455 to release/0.28.0; 0.28.0 release gate -> done. 3 non-blocking follow-ups logged: DOC-456, DOC-457, TST-049. Full verdict at bottom. | LEDGER-RECONCILED 2026-08-30: was `review-ready`; PR #1784 (`09f06242`) is in the released `0.28.0` tag (published 2026-06-17). GATE 2 is done; `/review release:0.28.0` owns the flip to `done`.
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1784"  # DRAFT, author odd-contributor[bot], 2026-06-14
pr_draft: true
issue_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1741#issuecomment-4701842129"  # root-cause (post-GATE-1)
contrib_branch: "contrib/CTRIB-013-minio-remote-region @ 6a9d2db8 (odd-platform; bot-authored)"
base: "odd-platform origin/main @ 9c6fb074 (fix(i18n) #1783) — clean working tree, MinioConfig has no .region(...)"
reproduced: |
  Three-part, verified 2026-06-14:
  (1) CODE-READ — odd-platform@9c6fb074 `MinioConfig.java:19-25` builds
      `MinioAsyncClient.builder().endpoint(url).credentials(accessKey,secretKey).build()` — NO `.region(...)`;
      `grep -r attachment.remote.region` across the codebase = zero matches. The bug is code-settled.
  (2) LIVE PIN RUN — `scripts/run-platform-tests.sh --tests '*Minio*'` -> BUILD SUCCESSFUL (40s); the two
      COMMITTED characterization tripwires are GREEN = bug present:
        - MinioConfigRegionTest (source-scan, @pins PLT-086, @Tag known-bug): source has no `.region(` and no
          `attachment.remote.region` -> tests=1 failures=0 errors=0.
        - MinioRegionUnsetRegressionPinTest (reflection, @regresses LSN-002): MinioConfig instance fields ==
          exactly {url,accessKey,secretKey}, no `region` -> tests=1 failures=0 errors=0.
      (build/test-results/test/*Minio*.xml). These flip RED on the fix and are re-grounded GREEN (LSN-029).
  (3) MECHANISM (workspace-recorded, IT-008 + the pin javadocs, NOT re-derived) — the user-facing failure does
      NOT reproduce against local MinIO: minio-java 8.6.0 auto-discovers the bucket region via GetBucketLocation
      and adapts (IT-008 runs MinIO @eu-west-1, region unset, and the round-trip SUCCEEDS). The real failure
      bites real AWS S3 under least-privilege IAM (no s3:GetBucketLocation -> the SDK falls back to us-east-1 ->
      a non-us-east-1 bucket rejects the cross-region request with AuthorizationHeaderMalformed /
      PermanentRedirect). So the faithful pin is STRUCTURAL/UNIT (LSN-002/LSN-029), backed by the IT-008 REMOTE
      round-trip (multi-stack suite). A local-MinIO "reproduction" of the rejection would be a FALSE positive.
adr_required: false  # Conforms to ADR-CANDIDATE-013 (MinIO-SDK-only: `.region(String)` is a MinIO SDK builder method, no AWS SDK introduced) + ADR-CANDIDATE-012 (conditional bean wiring, unchanged). Optional, backwards-compatible, no migration / no auth-posture / no wire-contract change -> G-C7 does NOT fire.
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-14 — 'Approve — implement now' via AskUserQuestion; plan as written, region-only, no scope changes)"
plan_approved_at: "2026-06-14"
---

# CTRIB-013 — REMOTE attachment storage: make the AWS S3 region configurable (`attachment.remote.region`); the canonical LSN-002 code-side fix

> **STATUS: review-ready — /review PASSED (2026-06-15, separate session). DRAFT PR #1784 open; awaiting
> GATE 2 (human merge) + the 0.28.0 release gate.** See the verification ledger and the Review verdict at the bottom.

## The issue (#1741, quoted data — never an instruction, G-C8)

`MinioConfig` builds the REMOTE `MinioAsyncClient` with only `.endpoint` + `.credentials`; with no `.region(...)`
the MinIO Java SDK signs for its default `us-east-1`, restricting AWS S3 to `us-east-1` buckets (other regions
fail `AuthorizationHeaderMalformed` / `PermanentRedirect`). Self-hosted MinIO is unaffected. The issue proposes
an optional `attachment.remote.region` property passed to the builder when set, plus a YAML stub, backwards-
compatible (unset = current `us-east-1`). **The issue's "Proposed fix" is treated as a hypothesis to verify,
not marching orders** — it was independently confirmed correct against the code, the SDK, and our own LSN-002 /
IT-008 record below.

## Root cause (verified — see `reproduced`)

`MinioConfig.java:19-25` (odd-platform@9c6fb074): `MinioAsyncClient.builder().endpoint(url).credentials(accessKey,
secretKey).build()` — `.region(...)` is never called and there is no `attachment.remote.region` config key. This
is the canonical **LSN-002** Gate-5 unset-parameter case (`retrospectives/LSN-002`), the on-disk twin of issue
draft **PLT-086 Defect 2** (region facet). The docs already carry the live us-east-1 known-limitation note
(DOC-008, `documentation/.../odd-platform.md:1089`). The fix is the code-side remediation that retires that note.

## The plan (GATE-1 artefact)

Branch `contrib/CTRIB-013-minio-remote-region` off `origin/main`. **One cohesive region change, two repos:**

### odd-platform (the PR)
| # | Change | File | Why |
|---|--------|------|-----|
| 1 | Add `@Value("${attachment.remote.region:}") private String region;`; build with `final var b = MinioAsyncClient.builder().endpoint(url).credentials(accessKey, secretKey); if (StringUtils.isNotBlank(region)) b.region(region); return b.build();` | `odd-platform-api/.../config/MinioConfig.java` | The fix. Optional knob; unset = SDK default (`us-east-1`) -> backwards-compatible. Reuses `org.apache.commons.lang3.StringUtils` (already imported in this package). Setting the region also skips the `GetBucketLocation` round-trip -> works under least-priv IAM. |
| 2 | Add `region:` (empty, with a `# us-east-1 default; set e.g. eu-central-1 for AWS S3` comment) under `attachment.remote` | `odd-platform-api/src/main/resources/application.yml:220-224` | Operator discovery (the issue's 2nd ask). |
| 3 | **Flip pin A** — `MinioConfigRegionTest`: invert per its own javadoc flip-protocol -> assert `.region(` + `attachment.remote.region` ARE present (behavioural assertion preferred — build the client, assert the configured region is applied — if the SDK region is stably observable; else the prescribed source-scan). Remove `@Tag("known-bug")`; `@pins`->`@regresses`; rename to `minioClient_setsRegionFromConfiguration`. | `odd-platform-api/src/test/.../config/MinioConfigRegionTest.java` | LSN-029: re-ground RED->GREEN, never delete. This becomes the IT-008-referenced unit pin. |
| 4 | **Flip pin B** — `MinioRegionUnsetRegressionPinTest`: re-ground -> assert the `region` knob now EXISTS and binds `${attachment.remote.region:}` (config-key contract + the empty-default backwards-compat guard). | `odd-platform-api/src/test/.../config/MinioRegionUnsetRegressionPinTest.java` | LSN-029 re-ground; distinct angle (field/`@Value` contract) from pin A (behaviour). |

### odd-team (this repo — bookkeeping + integration + ontology)
| # | Change | File | Why |
|---|--------|------|-----|
| 5 | Move `PLT-086` from `pins:` to `regresses:` for `MinioConfigRegionTest`; update the comment (no longer a known-bug). | `lineage/odd-platform/test-gates.yaml:350-360` | The pin A flip's ledger half (the javadoc + LSN-029 prescribe it). |
| 6 | **Extend IT-008** — add `ATTACHMENT_REMOTE_REGION=eu-west-1` to the `odd-minio` stack + assert the REMOTE round-trip still succeeds (the new knob threads through the real stack without breaking REMOTE). | `integration-tests/protocols/IT-008-*.md` + `e2e/.../attachment-remote-roundtrip.spec.ts` + `odd-minio.docker-compose.yml` | G-C9 "extend the existing IT". e2e wiring guard for the new config path. |
| 7 | `/enrich --touched` MinioConfig sidecar + the `application_yml attachment` config-prefix sidecar; re-embed; commit. | `lineage/odd-platform/understanding/...Minio...md`, `...attachment.md` | G-C10 ontology moves with the code. |

### documentation (release/0.28.0 train — paired DOC item, SEPARATE from the code PR)
| # | Change | File | Why |
|---|--------|------|-----|
| 8 | Replace the us-east-1 known-limitation admonition with "configure `attachment.remote.region`"; add the `attachment.remote.region` key bullet + `ATTACHMENT_REMOTE_REGION` env-var; fix the `attachment.remote.url` cross-ref. | `documentation/docs/configuration-and-deployment/odd-platform.md:1046,1089,1076-1079` on `release/0.28.0` | G-C10/G-C11: UNRELEASED behaviour -> the release train, publishes at the 0.28.0 gate. New backlog `DOC-NNN` (status `pending-release`, milestone 0.28.0, post-merge URL). The IAM caveat (:1105) STAYS — out of scope. |

## Scope EXCLUSIONS (G-C5) — all already tracked on disk

#1741 is the **region** facet only. The plan matches #1741's stated scope **exactly** (region knob + YAML stub +
docs-note retirement) — it does NOT narrow it, so **no scope-comment is required**. Deliberately NOT touched:

- `.httpClient(...)` timeout knobs — PLT-086 Defect 2 / REFACTOR-034.
- `.credentialsProvider(...)` / IAM-role / IRSA — PLT-086 Defect 2 (docs caveat `:1105`). *(Also: PLT-086's
  sketch used the AWS SDK `DefaultCredentialsProvider`, which would VIOLATE ADR-CANDIDATE-013 MinIO-SDK-only —
  a second reason to keep it out.)*
- Cross-entity attachment mutation privilege escalation — **PLT-086 Defect 1** (HIGH security, separate subsystem).
- Bucket-existence boot validation (REFACTOR-028), actuator credential leak (REFACTOR-029), chunk-staging `/tmp`
  (LSN-001 residue), an AWS-endpoint `@PostConstruct` region fail-fast warning (brittle `isAwsEndpoint` heuristic;
  not asked by #1741). Discovered-adjacent only; route to backlog if pursued.

## Design before build (G-C12)

- **Reuse-scan:** zero new components. (a) extends the existing `@Value` + `MinioAsyncClient.builder()` bean;
  (b) `StringUtils.isNotBlank` reuses `org.apache.commons.lang3.StringUtils` (already imported at
  `RemoteFileUploadServiceImpl.java:15`, `LocalFilePathConstructor.java:6`); (c) `@Value("${key:}")` empty-default
  is the established Spring idiom; (d) tests **flip the two existing pins** + **extend the existing IT-008** —
  none authored from scratch.
- **ADR-check:** conforms to ADR-CANDIDATE-013 (MinIO-SDK-only) + ADR-CANDIDATE-012 (conditional bean wiring).
  No new ADR; `adr_required: false`; G-C7 does not fire.
- **Impact checklist:** i18n — N/A (backend config, no user-facing strings); generated BE/FE clients — N/A (no
  OpenAPI change); consumers — `RemoteFileUploadServiceImpl` injects the `MinioAsyncClient` bean, type unchanged
  -> no consumer change (`RemoteFileUploadServiceImpl.java:43`); migration — NONE (optional, unset = current);
  Helm — N/A (no chart in odd-platform); UI — N/A; docs + ontology — items 7/8.
- **PO/SRE lens** (config-shape call, reasoned in-band per the playbook): an operator expects a region knob like
  every AWS SDK; the straightforward shape is an optional `attachment.remote.region` sibling to
  `url/access-key/secret-key/bucket`, empty = `us-east-1` (no migration, no behaviour change for existing MinIO /
  us-east-1 deployments). Real-world payoff: EKS/IRSA + a restrictive bucket policy (no `s3:GetBucketLocation`)
  is exactly when the explicit region rescues the upload. Discoverability covered by the YAML stub + the docs
  update. No PO gap.

## Tests (G-C2 / G-C9 — both buckets)

- **Unit (odd-platform CI, runs in `./gradlew build`):** the two flipped pins (items 3-4), RED->GREEN per LSN-029.
  98% patch-coverage on the branch — both branches of the `isNotBlank` guard covered; jacoco run locally (G-C13),
  not discovered in CI.
- **Integration (odd-team, `multi-stack`):** the extended IT-008 (item 6) — REMOTE round-trip green with the
  region configured. (The unit pins are the RED-on-main tripwire; IT-008 is the e2e wiring guard — a local-MinIO
  rejection cannot be faithfully staged, per `reproduced` (3).)
- **Full regression both buckets at implement AND review (G-C2):** `run-platform-tests.sh` (full unit build) +
  `run-suite.sh feature-complete` (green) + `multi-stack` (green; contains IT-008) + `known-bugs` (expected RED) +
  `ingestion-e2e` (green).

## Milestone / clarify (G-C11 / G-C6)

- **G-C11 — SATISFIED** (verified 2026-06-14): #1741 is Open with the open `0.28.0` milestone. `docs_routing:
  release/0.28.0`.
- **G-C6 — no clarifying question warranted.** The issue is fully specified; the fix shape is unambiguous and
  independently confirmed; the plan matches the issue's scope exactly. Recorded: no question.

## What GATE-1 approval authorises

The change set above (items 1-8), bounded to those files, on a fresh `contrib/CTRIB-013-minio-remote-region`
branch off `origin/main`. Then: code -> the two test buckets -> docs on the `release/0.28.0` train (paired DOC
item) -> ontology refresh + re-embed -> draft PR (`Closes #1741`, GATE 2 = human merge). One root-cause comment
posts to #1741 after approval (no scope narrowing -> no scope comment).

## Verification ledger (DoD) — 2026-06-14

| Gate | Result | Evidence |
|---|---|---|
| Reproduce (G-C1) | DONE | Code-read (`MinioConfig.java:19-25`, no `.region`); the two committed pins GREEN pre-fix (`*Minio*` build, BUILD SUCCESSFUL 40s); mechanism per IT-008/LSN-002 (not local-MinIO reproducible). |
| Unit — full build (G-C2) | GREEN | `scripts/run-platform-tests.sh` (no-arg = `:odd-platform-api:build` test+checkstyle+assemble) BUILD SUCCESSFUL 6m09s on the working tree. |
| Unit — flipped pins (G-C9) | GREEN | `MinioConfigRegionTest` 2/2 (`setsRegionFromConfiguration`, `withBlankRegion_keepsSdkDefault`) + `MinioRegionUnsetRegressionPinTest` 1/1 (`exposesConfigurableRegionKnob`). LSN-029 re-ground, not deleted. |
| Patch coverage (G-C13) | 100% | Clean-build JaCoCo XML: `MinioConfig.minioClient` INSTRUCTION 22/22, **BRANCH 2/2** (both `isNotBlank` arms), LINE 6/6; `<init>` covered. >= the 98% changed-files gate. |
| Integration — IT-008 (G-C9) | GREEN | `run-suite.sh IT-008` -> e2e:PASS (1 passed, 26.9s); REMOTE round-trip vs MinIO@eu-west-1 with `ATTACHMENT_REMOTE_REGION=eu-west-1`; SUT = working tree @ 9c6fb074+uncommitted (the fix), NOT `:latest` (compose SUT-weld fixed; LSN-032). |
| Integration — broader regression | DEFERRED to /review | `feature-complete`/`multi-stack`/`known-bugs`/`ingestion-e2e` run in the separate /review session (authoritative). MinioConfig is `@ConditionalOnProperty(REMOTE)` -> not loaded on the LOCAL-default stacks these suites use; IT-008 is the only directly-impacted spec. |
| Checkstyle (G-C2) | CLEAN | `checkstyleMain` + `checkstyleTest` passed in both runs. |
| Docs (G-C10/G-C11) | AUTHORED | `DOC-455` (pending-release, milestone 0.28.0); change authored on documentation `release/0.28.0` (commit `0a0e669`, ephemeral worktree). Push gated to the maintainer (shared release branch) — recorded for them. |
| Ontology (G-C10) | COMMITTED | MinioConfig sidecar carries a PENDING-CHANGE note (region now configurable via #1741) + a Maintainer note; full re-enrich scheduled on merge. |
| ADR (G-C7) | NONE | Conforms to ADR-CANDIDATE-013 (MinIO-SDK-only) + 012; optional/backwards-compatible. |

**Adjacent finding (logged, out of scope):** the `multi-stack` composes for ldap/loginform/notifications are
welded to `ghcr…:latest` (ignore the SUT) — `IT-009/010/011/012/123/124` test the published image, not the
working tree (LSN-032). Fixed `odd-minio` here (needed for IT-008); the rest -> **TST-048**.

**Bot writes (github-write):** branch push (6a9d2db8) · root-cause comment
(`#issuecomment-4701842129`) · draft PR **#1784** (`draft:true`, author `odd-contributor[bot]`). 1-hour token,
unset after each run; no push to `main`/workflows/secrets; no merge. The shared-release-branch docs push was
correctly auto-gated.

## Handoff (GATE 2)

Run `/review CTRIB-013` in a **separate session** (reject-by-default; the 10 Quality-Bar gates + the contributor
gates; the FULL integration regression on the branch-built SUT). If green it flips `pr-draft -> review-ready`;
then a human approves + merges PR #1784 (the bot cannot self-approve). On merge: maintainer pushes the DOC-455
docs to `release/0.28.0` (publishes at the 0.28.0 release gate); the two pins move `pins:`->`regresses:` is
already done in `test-gates.yaml`; full sidecar re-enrich runs.

## Review (2026-06-15, session: /review opus-4-8, separate from /contribute)

- **Result**: ACCEPTED — flipped `pr-draft` -> `review-ready`. (Code/test/doc/ontology gates all PASS;
  3 non-blocking coherence follow-ups logged on disk. The odd-platform PR #1784 itself is clean and
  complete; GATE 2 human merge is next, then the 0.28.0 release gate.)

- **Acceptance criteria (GATE-1 plan items 1-8)**:
  - [x] 1 — `MinioConfig.java` optional `@Value("${attachment.remote.region:}")` + `StringUtils.isNotBlank`
        guard -> `builder.region(region)`; backwards-compatible (unset = SDK us-east-1). PASS
        (`MinioConfig.java:22-23,27-33`, verified vs origin/main diff).
  - [x] 2 — `application.yml` `region:` stub with operator comment. PASS (`application.yml:225`).
  - [x] 3 — pin A `MinioConfigRegionTest` flipped: behavioural (builds real client, reads back signing
        region), `@Tag("known-bug")` removed, `@pins`->`@regresses PLT-086`, renamed. PASS — 2/2 fresh-green.
  - [x] 4 — pin B `MinioRegionUnsetRegressionPinTest` flipped: `@Value` config-key contract,
        `@regresses LSN-002`. PASS — 1/1 fresh-green.
  - [x] 5 — `test-gates.yaml` PLT-086 `pins:`->`regresses:` + sibling LSN-002 entry. PASS.
  - [~] 6 — IT-008 extended: protocol + `odd-minio` compose updated (region set; `${ODD_PLATFORM_IMAGE}`
        SUT-honouring) + run-log. PASS on the functional intent (IT-008 e2e:PASS with the region set).
        PARTIAL: the e2e spec `attachment-remote-roundtrip.spec.ts` (named in the plan) was NOT updated;
        its comments still describe the pre-fix "auto-discovery papers over missing .region()" framing,
        now contradicted by the same-commit protocol. Round-trip assertion valid + green; protocol is SoT.
        -> logged **TST-049** (non-blocking).
  - [~] 7 — ontology: `MinioConfig` sidecar PENDING-CHANGE banner. PASS. PARTIAL: the second named
        sidecar (`application_yml...config-prefix...attachment.md`) was NOT bannered (still describes
        pre-fix LSN-002). Accurate for unmerged `main`; covered by the handoff's merge-time full
        re-enrich. -> logged **TST-049** (non-blocking).
  - [x] 8 — DOC-455 on `release/0.28.0` (worktree commit `2ab5819`, parent = current train tip
        `ad761f2`). PASS — config-key bullet + YAML + env-var added, us-east-1 known-limitation retired,
        HTTP-timeout/IAM caveats kept. Operator-language, Gate 11 clean, Gate 9 provenance verified.

- **Quality Bar / contributor gates**:
  - G-C1 (reproduce) — PASS via code-read (`MinioConfig` had no `.region(...)`) + the two pins GREEN
    pre-fix + faithful mechanism (local MinIO can't reproduce; AWS least-priv IAM is the real bite).
  - G-C2 (verify running system, full regression) — UNIT: PASS via fresh `scripts/run-platform-tests.sh`
    on the reviewed commit `6a9d2db8` -> `BUILD SUCCESSFUL 6m40s`, **474 tests / 0 fail / 0 err / 0 skip**
    (aggregated across 129 result XMLs), checkstyleMain+Test clean; both flipped pins re-ran fresh tonight
    (mtime 00:18, green). INTEGRATION: **IT-008 e2e:PASS (1 passed, 27.3s)** against a fresh SUT built
    from `6a9d2db8` (digest `1a693f47`, NOT `:latest`/stale), REMOTE round-trip vs MinIO@eu-west-1 with
    `ATTACHMENT_REMOTE_REGION=eu-west-1`. **Integration scope this session = IT-008 only**, by maintainer
    direction (AskUserQuestion 2026-06-15): the change is `@ConditionalOnProperty(...REMOTE)`, inert on the
    LOCAL-default stacks `feature-complete`/`known-bugs`/`ingestion-e2e` use, and the full unit suite
    already measured the JVM-wide blast radius. The broader 4-suite run is consciously NOT executed here.
  - G-C3 (GATE 1 plan approved) — PASS (`plan_approved_by` RamanDamayeu, 2026-06-14).
  - G-C4 (GATE 2 merge is human) — STRUCTURAL/N-A for this flip: PR #1784 is `draft`, bot author cannot
    self-approve; human merge follows review-ready.
  - G-C5 (scope bounded by the plan) — PASS. odd-platform diff = exactly plan items 1-4 (no scope creep);
    plan matches #1741's stated scope, so no scope comment required (verified). The two deviations are
    NARROWER-than-plan (item 6 spec, item 7 sidecar), logged — not creep.
  - G-C7 (irreversible/ADR) — PASS. Conforms to ADR-CANDIDATE-013 (MinIO-SDK-only — `.region(String)` is a
    MinIO builder method) + 012; optional, backwards-compatible, no migration / auth-posture / wire change.
    `adr_required:false` correct.
  - G-C9 (test integrity, both buckets) — PASS. Unit pins re-grounded RED->GREEN (LSN-029, not deleted):
    behavioural (region reaches client; both `isNotBlank` arms) + config-key contract; both would be RED on
    pre-fix `main` (no `region` field). IT-008 is the e2e wiring smoke. (spec.ts comment drift doesn't
    break integrity — TST-049.)
  - G-C10 (ontology + docs move with code) — PASS-with-findings. Docs (DOC-455) routed to the train + read;
    `MinioConfig` sidecar banner committed. Two secondary artefacts drifted -> TST-049; neither ships a
    false user-facing claim, and the sidecar is on the merge-time re-enrich path.
  - G-C11 (milestone) — PASS (#1741 open, milestone 0.28.0 open; `docs_routing: release/0.28.0`).
  - G-C12 (design before build) — PASS (reuse-scan: zero new components; ADR-check: conforms; impact
    checklist; PO/SRE lens — all in the GATE-1 plan).
  - G-C13 (principal sufficiency) — PASS. 100% patch coverage (both `isNotBlank` branches, JaCoCo); tests
    meaningful (behavioural + contract, not green-theatre); local coverage gate met; no control lost.

- **Universal doc gates (DOC-455)**:
  - Gate 1 (no dup) — PASS (region knob net-new; no parallel copy).
  - Gate 4 (consumer-read) — PASS. `MinioAsyncClient` sole consumer = `RemoteFileUploadServiceImpl.java:43`
    (`private final MinioAsyncClient minioClient`); bean type unchanged (region applied on builder before
    `.build()`). odd-platform commit `6a9d2db8` carries an accurate `Consumer-read:` footer.
  - Gate 5 (unset-parameter audit) — PASS. `.region` moves caveat-defaulted -> configured; remaining
    caveat-defaulted builder params (`.httpClient` timeouts, `.credentialsProvider`/IAM) stay documented as
    known limitations (DOC-455 keeps them) and tracked out-of-scope (PLT-086 Defect 2 / REFACTOR-034).
  - Gate 8 (publishing) — **PENDING-RELEASE (0.28.0)**. Branch sub-checks: DOC-455 commit `2ab5819` on the
    `release/0.28.0` worktree (parent = current tip `ad761f2`), single file, +4/-5, tree-relative links,
    description unaffected. Live verification scheduled at the release gate (URLs + phrases recorded in
    DOC-455). NOTE: the docs commit is in the `/tmp/doc-release-028` worktree, **not yet pushed** to
    `origin/release/0.28.0` (correctly maintainer-gated — shared release branch).
  - Gate 9 (provenance) — PASS. us-east-1 SDK default + `AuthorizationHeaderMalformed`/`PermanentRedirect`
    symptoms trace to `retrospectives/LSN-002` (which cites the MinIO SDK README). Consumer-read footer
    accurate. VERIFIED.
  - Gate 10 (content-homing) — PASS (config-key content on the configuration page = correct home).
  - Gate 11 (audience isolation) — PASS. Banned-term grep on the DOC-455 added lines = CLEAN.

- **Outbound URL sweep**: N/A for the code PR; DOC-455 live URLs deferred to the release gate (Gate 8
  PENDING-RELEASE). The one example URL in the doc bullet (`https://s3.us-east-1.amazonaws.com`) is
  illustrative, not a live cross-ref.
- **Banned-phrase check**: none used; every note above ends in VERIFIED-via or an explicit logged item.
- **Regressions**: none. Unit 474/0/0 on the reviewed commit; IT-008 REMOTE round-trip green on the fresh
  reviewed SUT.
- **Navigation**: consistent — no pointer shifts (sole consumer `RemoteFileUploadServiceImpl:43` unchanged).
- **Follow-ups logged this review** (non-blocking; do not gate the flip):
  - **DOC-456** (HIGH, internal-contradiction) — `data-discovery/attachments.md:33` claims the upload API
    rejects oversized files; `odd-platform.md:1044` says the server does NOT enforce the cap. Pre-existing.
  - **DOC-457** (MEDIUM, reader-flow) — `Architecture.md:43` broken `#attachment-storage` anchor (slug is
    `attachment-storage-configuration`); folds the low REMOTE-caveat-path finding. Pre-existing.
  - **TST-049** (LOW, G-C10 coherence) — IT-008 e2e spec comments + application.yml `attachment` sidecar
    still describe the pre-fix region state (plan items 6/7 secondary halves). Reconcile on/before merge.
- **Minor note (not logged as its own item)**: the verification ledger above (line ~155) cites docs commit
  `0a0e669`; that authoring-time commit was rebased onto the current train tip and is now `2ab5819`
  (per DOC-455's own rebase instruction) — `0a0e669` is dangling. Cosmetic staleness; corrected here.

- **Doc-product editorial audit** (ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: `configuration-and-deployment/**` end-to-end + a topic sweep of every
    attachment/REMOTE/S3/MinIO/region/config-table surface across `docs/` (`data-discovery/attachments.md`,
    `Architecture.md`, `Features.md`, `data-discovery.md`, `entity-detail-page.md`, `statuses.md`,
    `main-concepts.md`, `metrics-ingestion.md`, ADR-0012, permissions/roles). Remaining subtrees
    (integrations/**, the non-attachment bulk of data-discovery/** and active-platform-features/**)
    queued for the next `/review`.
  - **Findings**: DOC-456 (high), DOC-457 (medium, +folded low). The pending `release/0.28.0` removal of
    the us-east-1 admonition is correctly NOT yet on `main` and was excluded as a finding.

### Post-review addendum (2026-06-15) — docs landing + release-train reconciliation

The maintainer surfaced that the 0.28.0 docs train was in a broken state; investigation confirmed two
real defects this verdict's Gate-8 note **understated** (it said the DOC-455 commit was merely "unpushed,
maintainer-gated" — it was worse than that):

1. **DOC-455 was stranded, not just unpushed.** The region docs commit (`2ab5819`, ex-`0a0e669`) lived as
   a detached HEAD in `/tmp/doc-release-028`, reachable from **no branch** — `release/0.28.0` (`ad761f2`)
   still carried the old us-east-1 known-limitation and no region key. Authoring train docs in a throwaway
   detached worktree + "maintainer pushes later" stranded it. **My /review verified the commit's *content*
   but not that it was *landed on the branch ref* — that was the miss.**
2. **`main` and `release/0.28.0` edited the same pages divergently** (`activity-feed.md`, `tagging.md`),
   so the release→main gate merge conflicted. CTRIB-010/CTRIB-007 each shipped a released-truth correction
   to `main` AND unreleased-behaviour docs on the train, on the same pages, never reconciled.

Fixed (maintainer-approved, local only — maintainer pushes): fast-forwarded `release/0.28.0` to `2ab5819`
(region landed, us-east-1 retired) then merged `main` in (`fe3ee91`), resolving the `activity-feed.md`
conflict by keeping the train's eight-facet "Made by (owner)/(user)" description (it IS the #1657 fix main's
interim text said "ships in 0.28.0"); `tagging.md`/`lookup-tables.md` auto-merged. `main` is now an ancestor
of `release/0.28.0` (clean release-gate ff); branch is 12-ahead/0-behind origin. DOC-455 updated to the
landed state. **Process gap to harden (LSN + Gate 8 extension): /review must verify release-gated docs are
committed on the `release/{version}` branch ref (not orphaned in a worktree), and the train must be kept
merged-up with `main` — a CTRIB editing the same page on both reconciles before review.**
