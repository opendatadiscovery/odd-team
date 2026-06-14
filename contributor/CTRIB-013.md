---
id: CTRIB-013
github_issue_number: 1741
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1741
class: bug  # REMOTE attachment SDK builder leaves region unset -> AWS S3 restricted to us-east-1 (the canonical LSN-002 code-side residue)
milestone: "0.28.0"  # VERIFIED 2026-06-14 via GitHub API: #1741 is OPEN, milestone 0.28.0 is OPEN (due 2026-06-22). G-C11 SATISFIED. The fix is for UNRELEASED behaviour (no .region knob exists in any tag) -> ships in 0.28.0.
status: pr-draft  # GATE-1 APPROVED + implemented + verified; DRAFT PR #1784 open (Closes #1741). DoD met (full unit build green; MinioConfig patch coverage 100%; IT-008 green on the working-tree SUT; docs authored DOC-455; ontology noted). A SEPARATE /review session flips review-ready; GATE 2 (human) merges. Broader integration regression (feature-complete/known-bugs/ingestion-e2e) deferred to /review — MinioConfig is @ConditionalOnProperty(REMOTE), not loaded on the LOCAL-default stacks those suites use.
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

> **STATUS: pr-draft — GATE-1 approved, implemented, verified; DRAFT PR #1784 open. Awaiting a separate
> `/review` session + GATE 2 (human merge).** See the verification ledger at the bottom.

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
