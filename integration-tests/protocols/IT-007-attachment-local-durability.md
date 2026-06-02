---
id: IT-007
title: "An uploaded attachment must survive a platform restart; under LOCAL storage it is silently lost (durability)"
gates:
  validates: [F-027]
  enforces: []
  regresses: [PLT-086]
test_class: integration
stack: odd-minimal
automation: "e2e:specs/attachment-local-durability.spec.ts"
plan_ref: "I2 (attachment storage) — Tier-2 (needs a container recreate)"
status: ready
expected_result: "RED until LOCAL is backed by a persistent volume by default (or durable REMOTE is the default) — today a container recreate wipes /tmp/odd/attachments while the DB keeps the record. LSN-001 / PLT-086."
---

# IT-007 — attachment LOCAL-storage durability (the LSN-001 landmine)

> **This is the integration test for the LSN-001 data-loss landmine** (F-027 Attachment
> Lifecycle). It uploads a real file through the platform's exact upload protocol, then
> performs a real **container recreate** (the docker analogue of a redeploy / Kubernetes
> pod restart) and shows the file is gone while the platform still lists it. The
> upload/download go through the real REST API because the defect is *storage
> durability*, not the upload UI — the user-observable loss is the failed download, the
> same call the UI's download button makes; what makes this an integration test and not
> an API probe is the real container-lifecycle event in the middle.

## 1. What this checks
A file a user uploads to a data entity must **survive a platform restart**. **Known bug
(LSN-001 / PLT-086):** `attachment.storage` defaults to `LOCAL`
(`LocalFileUploadServiceImpl` `@ConditionalOnProperty(matchIfMissing=true)`), which
writes files to the platform container's own filesystem at `attachment.local.path` =
`/tmp/odd/attachments/{entityId}/{name}` (`application.yml:215-219`). That path is **not
a persistent volume**, so a container recreate / redeploy / K8s pod restart wipes it —
while the attachment's **DB record survives**. The platform then lists a file it can no
longer serve.

**Operator-facing consequence if it FAILS:** an operator runs ODD on Kubernetes (or any
container platform), uploads attachments, and the next deploy or pod reschedule silently
destroys every file — the UI still shows them, downloads fail, and there is no warning at
upload time. This is the exact 2026-04 incident `retrospectives/LSN-001` exists for.
Source: F-027 · PLT-086 · LSN-001 · `application.yml:215-219` · `LocalFileUploadServiceImpl` · TEST-GAP-024/051.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres). **Crucially, odd-minimal mounts NO
  volume for the platform and sets NO `attachment.*` env** — so the shipped LOCAL default
  applies and storage is the container's ephemeral filesystem (the real-world default).
  Auto bring-up; manually: `docker-compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`.
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default) — uploads need no token.
- **Browser toolchain**: Node 18+ (workspace pins 24) → `cd integration-tests/e2e && npm install`. One-time. (No Chromium needed — this protocol drives the REST API + docker, not a browser.)
- **Seed**: a data entity to attach to (`helpers/db.seedAttachmentEntity()`, id 2007).

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `psql "$ODD_DB_URL" -c "SELECT id FROM data_entity WHERE id=2007;"` → `2007`
- Storage is ephemeral (no volume): `docker inspect probe-odd-platform --format '{{json .Mounts}}'` → `[]` (or no mount at `/tmp/odd`).

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh known-bugs`
  (or `cd integration-tests/e2e && npx playwright test attachment-local-durability`).
- **Manual (human-carryable)**:
  1. Upload a file (the UI's 3-step flow): `POST /api/dataentities/2007/files/uploads` `{"file_name":"canary.txt"}` → note `id` (upload_id); `POST /api/dataentities/2007/files/uploads/{upload_id}/chunks` multipart `file=@canary.txt index=0`; `PUT /api/dataentities/2007/files/uploads/{upload_id}` → note `id` (file_id).
  2. Download it: `curl -fsS http://localhost:18080/api/dataentities/2007/files/{file_id} -o out.bin` → bytes match `canary.txt`.
  3. **Recreate the platform container** (the redeploy): `docker-compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d --force-recreate --renew-anon-volumes --no-deps probe-odd-platform`; wait for `/actuator/health` UP.
  4. List attachments: `curl -s http://localhost:18080/api/dataentities/2007/attachments` → the file is still in `files[]` (record survived).
  5. Download again: `curl -i http://localhost:18080/api/dataentities/2007/files/{file_id}` → **fails / not the original bytes** (file gone).

## 5. What it checks — assertions
- **PASS** when: after the recreate the file still downloads with the original bytes (LOCAL is durable / a persistent volume / REMOTE).
- **FAIL (expected today)** when: after the recreate the attachment is **still listed** (DB record survived — proving this is a redeploy, not a DB wipe) **but the download fails or returns the wrong bytes** — the LOCAL ephemeral store was wiped: silent data loss.
- **FAIL (setup)** when: the upload or the pre-recreate download fails — the stand/feature is broken before the durability check (fix the stand, not a real signal).

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`; Playwright trace under
`integration-tests/e2e/test-results/` on failure. Log fields:
`date · stack_commit · runner · outcome · evidence (download status/bytes before vs after recreate; whether still listed) · notes`.

## Cross-references
- Source: F-027 · PLT-086 · `retrospectives/LSN-001-attachment-ephemeral-default.md` · `application.yml:215-219` · `LocalFileUploadServiceImpl` · `LocalFilePathConstructor` · TEST-GAP-024/051
- Sibling Tier-2 (not this test): attachment **LSN-002** REMOTE/MinIO non-`us-east-1` region (`TEST-GAP-052`) — needs a MinIO stack profile; authored separately.
- Related: **ADR-0012** (attachment storage boot-selection — the LOCAL/REMOTE decision this durability gap lives under).
- Plan: `lineage/odd-platform/test-plan.md` batch I2 (attachment storage) + the Tier-2 e2e build-out.
- Automation: `integration-tests/e2e/specs/attachment-local-durability.spec.ts` (seed `helpers/db.seedAttachmentEntity`; recreate `helpers/docker.recreatePlatformContainer`).
- Fix that flips this GREEN: back LOCAL with a persistent volume by default (Helm/compose), or ship durable REMOTE as the default; then move IT-007 to `feature-complete`.
