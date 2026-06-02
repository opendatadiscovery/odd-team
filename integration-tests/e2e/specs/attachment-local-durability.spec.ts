import { test, expect, type APIRequestContext } from '@playwright/test';
import { seedAttachmentEntity } from '../helpers/db';
import { recreatePlatformContainer } from '../helpers/docker';

/**
 * IT-007 — attachment LOCAL-storage durability (the LSN-001 landmine).
 *
 * Protocol: integration-tests/protocols/IT-007-attachment-local-durability.md
 * Gates: validates F-027 (Attachment Lifecycle) · regresses PLT-086 (LSN-001 family).
 *
 * The bug (LSN-001): `attachment.storage` defaults to `LOCAL`
 * (`LocalFileUploadServiceImpl @ConditionalOnProperty(matchIfMissing=true)`), which
 * writes uploaded files to the platform container's own filesystem at
 * `attachment.local.path` = `/tmp/odd/attachments/{entityId}/{name}`
 * (application.yml:215-219). That path is NOT a persistent volume, so a container
 * recreate / redeploy / Kubernetes pod restart wipes it — while the attachment's DB
 * record survives. The platform then lists a file it can no longer serve: silent data
 * loss for any operator who trusted the default. (`retrospectives/LSN-001`.)
 *
 * Why this is API-driven (not a browser click): the defect is storage durability, and
 * the user-observable loss IS the failed download (the same GET the UI's download
 * button calls) — there is no UI-only facet a browser would catch that the download
 * does not. What makes this a real integration test rather than an API probe is the
 * real container-lifecycle event in the middle (a recreate, which no probe performs).
 * The upload replicates the UI client's exact 3-step protocol (initiate → chunk →
 * complete), so it exercises the same write path a user does.
 *
 * EXPECTED RESULT TODAY: RED. After the recreate the file is gone but still listed.
 * Goes green when LOCAL is backed by a persistent volume by default (or the durable
 * REMOTE backend is the shipped default).
 */

// Replicates the UI's upload calls (DataEntityAttachmentApi): initiate (JSON {fileName})
// → upload one chunk (multipart {file,index}) → complete (PUT). Returns the new file's
// id (DataEntityFile.id). NB: `fileName` is one of the contract's ~8 camelCase outliers
// (ADR-0072 serialization-naming) — NOT snake_case `file_name`; the server validates it
// as `fileName` (a live confirmation of why that ADR-0072 caveat exists).
async function uploadFile(
  request: APIRequestContext,
  entityId: number,
  fileName: string,
  content: Buffer,
): Promise<number> {
  const init = await request.post(`/api/dataentities/${entityId}/files/uploads`, {
    data: { fileName },
  });
  expect(init.ok(), `initiate upload failed: ${init.status()} ${await init.text()}`).toBeTruthy();
  const uploadId = (await init.json()).id;

  const chunk = await request.post(
    `/api/dataentities/${entityId}/files/uploads/${uploadId}/chunks`,
    { multipart: { file: { name: fileName, mimeType: 'text/plain', buffer: content }, index: '0' } },
  );
  expect(chunk.ok(), `chunk upload failed: ${chunk.status()} ${await chunk.text()}`).toBeTruthy();

  const done = await request.put(`/api/dataentities/${entityId}/files/uploads/${uploadId}`);
  expect(done.ok(), `complete upload failed: ${done.status()} ${await done.text()}`).toBeTruthy();
  return (await done.json()).id;
}

test.describe('IT-007 attachment durability — an uploaded file must survive a platform restart', () => {
  test('a file uploaded under LOCAL storage is silently lost on container recreate (LSN-001 / PLT-086)', async ({
    request,
  }) => {
    test.setTimeout(180_000); // recreate + health-poll can exceed the default 60s

    // ---- arrange: an entity to attach to ----
    const entityId = await seedAttachmentEntity();
    const fileName = 'it007-durability-canary.txt';
    const content = Buffer.from(
      'IT-007 LSN-001 durability canary — this file must survive a redeploy.\n',
    );

    // ---- act 1: a user uploads a file (the UI's exact initiate→chunk→complete flow) ----
    const fileId = await uploadFile(request, entityId, fileName, content);

    // precondition: the platform has the file and serves the exact bytes back
    const before = await request.get(`/api/dataentities/${entityId}/files/${fileId}`);
    expect(
      before.ok(),
      `precondition: the just-uploaded file must download (got ${before.status()})`,
    ).toBeTruthy();
    expect(
      (await before.body()).equals(content),
      'precondition: the downloaded bytes match the uploaded file',
    ).toBeTruthy();

    // ---- act 2: the redeploy — recreate the platform container (DB kept) ----
    await recreatePlatformContainer();

    // ---- assert 1: the DB record SURVIVED (this is a redeploy, not a DB wipe) — the
    //      platform still lists the attachment, so it believes the file exists ----
    const list = await request.get(`/api/dataentities/${entityId}/attachments`);
    expect(list.ok(), `attachments list must load after recreate (got ${list.status()})`).toBeTruthy();
    const files: Array<{ id: number; name: string }> = (await list.json()).files ?? [];
    expect(
      files.some(f => f.id === fileId),
      `the attachment record must survive the recreate (DB container kept); listed=${JSON.stringify(files)}`,
    ).toBeTruthy();

    // ---- assert 2 (THE GATE): the file CONTENT is gone — LSN-001 silent data loss ----
    const after = await request.get(`/api/dataentities/${entityId}/files/${fileId}`);
    const served = after.ok() && (await after.body()).equals(content);
    expect(
      served,
      `An uploaded attachment must survive a platform restart. After recreating the platform ` +
        `container, downloading file ${fileId} returned status ${after.status()} while the ` +
        `attachment is STILL listed — LOCAL stored it on the container's ephemeral ` +
        `/tmp/odd/attachments (application.yml:215-219), which the redeploy wiped. The platform ` +
        `claims a file it can no longer serve: silent data loss (LSN-001 / PLT-086 / F-027). ` +
        `Fix: back LOCAL with a persistent volume by default, or ship durable REMOTE as the default.`,
    ).toBeTruthy();
  });
});
