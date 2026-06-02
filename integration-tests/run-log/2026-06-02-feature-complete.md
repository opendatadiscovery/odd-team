## 2026-06-02 — IT-008 REMOTE attachment round-trip (Tier-2b) + the LSN-002 finding
- runner: AI-assisted (Claude Opus 4.8) — `ODD_STACK_EXTERNAL=1 npm test -- attachment-remote-roundtrip`, Node v24.13.0; self-managed `odd-minio` stack (postgres + MinIO@eu-west-1 + bucket-init + platform REMOTE), brought up/torn down by the spec.
- protocol: IT-008 (test_class integration — REST upload/download against an S3/MinIO backend; no browser). validates F-027 (REMOTE).
- outcome: **GREEN (1 passed, 43s incl. stack up ~27s + down).** Upload (initiate→chunk→complete) → download returned the exact bytes → REMOTE attachment storage round-trips against an S3-compatible store. Goes in `feature-complete` + `I2-attachment-storage`. A future RED here = a real REMOTE-storage regression.

### LSN-002 investigation result (why IT-008 is GREEN, not a RED region pin)
The original Tier-2b intent was a RED "MinIO non-us-east-1" pin for LSN-002 (MinioConfig builds MinioAsyncClient without `.region(...)`). **Empirically disproven this session:** with MinIO `MINIO_SITE_REGION=eu-west-1` and the platform REMOTE-pointed at it, the upload+download SUCCEEDED — minio-java 8.6.0 auto-discovers the bucket region via `GetBucketLocation` and adapts, so the missing `.region()` is papered over against a cooperative store. The real LSN-002 bites **real AWS S3 under least-privilege IAM** (no `s3:GetBucketLocation` → SDK falls back to us-east-1 → cross-region requests rejected) — not reproducible with a local MinIO.

**Decision (maintainer-chosen):** pin LSN-002 STRUCTURALLY, not via integration.
- LSN-002 pin = `odd-platform` unit test `MinioConfigRegionTest` (`@regresses PLT-086`, branch `test/adr-enforcement-units`, commit `9ce4f18f`) — source-scan asserting MinioConfig sets `.region(...)` from `attachment.remote.region`. RED until fixed. **Awaiting the maintainer's gradle run** (CI gate; the agent cannot run gradlew).
- The MinIO stack built for the investigation was salvaged as IT-008 (the REMOTE happy-path above) — net-new F-027 REMOTE coverage.

### spec defects this session surfaced + fixed
- The attachment initiate field is `fileName` (camelCase) — one of the ~8 camelCase contract outliers (ADR-0072); a live re-confirmation (also hit in IT-007).
- IT-007/IT-008 share the 3-step upload via `helpers/attachments.uploadAttachment` (extracted to avoid duplication).

## 2026-06-02 — IT-009 auth-mode boundary (Tier-3 foundation)
- runner: AI-assisted (Claude Opus 4.8) — `npm test -- auth-mode-boundary`, Node v24.13.0; shared odd-minimal (DISABLED :18080, from global-setup) + self-managed `odd-loginform` stack (LOGIN_FORM :18082, project oddlf).
- protocol: IT-009 (test_class integration — REST; no browser). enforces ADR-0074 · TEST-GAP-778.
- outcome: **GREEN (1 passed, 51s).** `/api/dataentities/classes` → 200 under DISABLED (permitAll), 401/302 under LOGIN_FORM (authenticated required). The auth-mode switch enforces authentication. `feature-complete` + `I1-auth-mode-authz`.
- spec defect fixed mid-run: first probe `/api/owners` returned 500 under DISABLED (needs page/size query params — the UI always sends them; bare it 500s). Switched to `/api/dataentities/classes` (static reference, no params, 200 under DISABLED, not whitelisted).
- helper refactor verified: extracted the generic stack lifecycle to `helpers/stack.ts`; `minio-stack.ts` now delegates to it (IT-008 re-ran GREEN, confirming the refactor). `loginform-stack.ts` is the new thin wrapper.
- scope note: LOGIN_FORM proves only the AUTHENTICATION boundary (every credential = ADMIN, AuthorizationCustomizer inert). The RBAC/cross-owner authz bugs need DISTINCT-permission users → an LDAP tier (group→role mapping; the only locally-reproducible enforcing mode with per-user distinction). That is the next Tier-3 sub-batch — assessment pending.
