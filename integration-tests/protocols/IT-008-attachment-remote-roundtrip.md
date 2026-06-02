---
id: IT-008
title: "REMOTE (S3/MinIO) attachment storage uploads + serves a file end-to-end (round-trip)"
gates:
  validates: [F-027]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minio
automation: "e2e:specs/attachment-remote-roundtrip.spec.ts"
plan_ref: "I2 (attachment storage) — Tier-2b; the REMOTE happy-path salvaged from the LSN-002 investigation"
status: ready
expected_result: "GREEN — REMOTE round-trips. Also the empirical evidence that LSN-002 does NOT reproduce against a vanilla MinIO (the SDK auto-discovers region); LSN-002 is pinned structurally in odd-platform (a unit test), not here."
---

# IT-008 — REMOTE attachment storage round-trip (S3/MinIO)

> **A GREEN feature-validation for F-027's REMOTE backend** (previously zero e2e
> coverage). It uploads a file through the real upload protocol to a platform configured
> with `attachment.storage=REMOTE` against a MinIO server, then downloads it back —
> proving the object is stored in and served from the S3 bucket. It is self-contained:
> it brings up its own REMOTE/MinIO stack (distinct ports/project from odd-minimal).

## 1. What this checks
With `attachment.storage=REMOTE`, an uploaded attachment must be stored in the S3 bucket
(via `MinioConfig` → `MinioAsyncClient` → `RemoteFileUploadServiceImpl.putObject`) and
served back on download (`getObject`). PASS = the downloaded bytes equal the uploaded
file.

**Why the store is eu-west-1 (and the LSN-002 connection):** this stack runs MinIO with
`MINIO_SITE_REGION=eu-west-1` — NOT us-east-1. That makes this run double as the
empirical record that **LSN-002 does not reproduce against a vanilla MinIO**:
`MinioConfig` builds the client without `.region(...)`, but minio-java auto-discovers the
bucket region via `GetBucketLocation` and adapts, so the upload succeeds. The real
LSN-002 (no region knob → only works against us-east-1) bites **real AWS S3 under
least-privilege IAM** (no `s3:GetBucketLocation` → the SDK falls back to us-east-1 →
cross-region requests rejected), which a local MinIO cannot faithfully reproduce. That
defect is pinned **structurally** in odd-platform (`MinioConfigRegionTest`, `@regresses
PLT-086`) — a unit test asserting `MinioConfig` sets `.region(...)` from a config key and
that `attachment.remote.region` exists. See `retrospectives/LSN-002`.

**Operator-facing value:** confirms REMOTE/S3 storage actually works end-to-end (the
durable alternative to the LOCAL default that IT-007 shows is lossy).

## 2. Preparation — build the test stand
- **Stack**: `odd-minio` — `lineage/_extractor/probe-stacks/odd-minio.docker-compose.yml`
  (postgres + MinIO@eu-west-1 + a one-shot `mc` bucket-init for `odd` + the platform with
  `ATTACHMENT_STORAGE=REMOTE`). Distinct ports (platform 18081, pg 15433, minio 19000) +
  project `oddminio`, so it coexists with the shared odd-minimal stack. The spec brings it
  up/tears it down; manually: `docker-compose -p oddminio -f lineage/_extractor/probe-stacks/odd-minio.docker-compose.yml up -d`.
- **Auth/config**: `AUTH_TYPE=DISABLED`; `ATTACHMENT_REMOTE_URL=http://probe-minio:9000`, `ACCESS_KEY/SECRET_KEY=minioadmin`, `BUCKET=odd`.
- **Browser toolchain**: Node 18+ (workspace pins 24) → `cd integration-tests/e2e && npm install`. No browser needed (REST + docker).
- **Seed**: a data entity (id 2008) inserted into the stack's DB (the spec's `seedEntity`).

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18081/actuator/health` → `{"status":"UP"}`
- MinIO live + bucket: `docker logs probe-minio-init` → "bucket odd ready"; `curl -s http://localhost:19000/minio/health/live -o /dev/null -w '%{http_code}'` → `200`.
- Seed present: `psql "$ODD_MINIO_DB_URL" -c "SELECT id FROM data_entity WHERE id=2008;"` → `2008`.

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh feature-complete`
  (or `cd integration-tests/e2e && ODD_STACK_EXTERNAL=1 npx playwright test attachment-remote-roundtrip` to skip the unused odd-minimal bring-up).
- **Manual (human-carryable)**: with the stack up, upload (`POST /api/dataentities/2008/files/uploads` `{"fileName":"x.txt"}` → upload_id; `POST .../uploads/{upload_id}/chunks` multipart `file=@x.txt index=0`; `PUT .../uploads/{upload_id}` → file_id), then `curl http://localhost:18081/api/dataentities/2008/files/{file_id}` → the original bytes. Confirm the object is in the bucket: `mc ls --recursive local/odd`.

## 5. What it checks — assertions
- **PASS** when: the download returns the exact uploaded bytes — REMOTE storage round-trips.
- **FAIL** when: upload or download fails, or the bytes differ — REMOTE/S3 storage is broken (a real regression). (Note: this is the GREEN-target suite — a failure here is a true regression, not a known bug.)

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`; Playwright trace under
`integration-tests/e2e/test-results/` on failure. Log fields:
`date · stack_commit · runner · outcome · evidence (upload+download status, bytes match) · notes`.

## Cross-references
- Source: F-027 (REMOTE backend) · `MinioConfig.java` · `RemoteFileUploadServiceImpl` · `retrospectives/LSN-002-minio-region-unset.md`
- The LSN-002 pin proper (NOT this test): odd-platform unit test `MinioConfigRegionTest` (`@regresses PLT-086`) — asserts `.region(...)` is set from a configurable `attachment.remote.region`. Vanilla MinIO can't reproduce LSN-002 (proven by this run), so the regression pin is structural.
- Sibling: **IT-007** (LOCAL durability — the lossy default REMOTE is the durable alternative to).
- Related: **ADR-0012** (attachment storage boot-selection — LOCAL vs REMOTE).
- Plan: `lineage/odd-platform/test-plan.md` batch I2 (attachment storage) + Tier-2b.
- Automation: `integration-tests/e2e/specs/attachment-remote-roundtrip.spec.ts` (stack `helpers/minio-stack.ts`; upload `helpers/attachments.ts`).
