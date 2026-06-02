import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import {
  upMinioStack,
  downMinioStack,
  MINIO_BASE_URL,
  MINIO_DB_URL,
} from '../helpers/minio-stack';
import { uploadAttachment } from '../helpers/attachments';

/**
 * IT-008 — REMOTE attachment storage round-trips against a non-us-east-1 store.
 *
 * Protocol: integration-tests/protocols/IT-008-attachment-remote-roundtrip.md
 * Gates: validates F-027 (Attachment Lifecycle — REMOTE/S3 backend).
 *
 * A GREEN feature-validation: REMOTE attachment storage (MinioConfig → MinioAsyncClient)
 * must upload + serve a file end-to-end against an S3-compatible store. It runs against a
 * MinIO whose region is eu-west-1 (NOT us-east-1) — which is also the empirical evidence
 * that **LSN-002 does NOT reproduce against a vanilla MinIO**: minio-java auto-discovers
 * the bucket region via GetBucketLocation and adapts, so the missing `.region()` is
 * papered over here. The real LSN-002 (no `.region()`, no `attachment.remote.region`
 * knob) bites real AWS S3 under least-privilege IAM (no s3:GetBucketLocation), which a
 * local MinIO cannot faithfully reproduce; that defect is pinned STRUCTURALLY in
 * odd-platform (a unit test, `@regresses PLT-086`), not here.
 *
 * Self-contained: brings up its own REMOTE/MinIO stack (distinct ports/project from the
 * shared odd-minimal stack) in beforeAll and tears it down in afterAll.
 *
 * EXPECTED RESULT: GREEN — REMOTE round-trips. (If this ever goes RED, REMOTE storage is
 * broken against S3-compatible stores — a real regression.)
 */

const ENTITY_ID = 2008;

async function seedEntity(): Promise<void> {
  const c = new Client({ connectionString: MINIO_DB_URL });
  await c.connect();
  try {
    await c.query(`INSERT INTO data_source (id, oddrn, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
      ENTITY_ID,
      '//e2e-minio/db',
      'e2e-minio',
    ]);
    await c.query(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, view_count, source_created_at, source_updated_at)
       VALUES ($1,$2,$3,$4,1,0,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`,
      [ENTITY_ID, '//e2e-minio/db/tables/t', 't', ENTITY_ID],
    );
  } finally {
    await c.end();
  }
}

test.describe('IT-008 REMOTE attachment storage — round-trips against an S3/MinIO backend', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000); // stack bring-up (platform start_period ~30s + minio + bucket)
    await upMinioStack();
    await seedEntity();
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await downMinioStack();
  });

  test('upload → download round-trips against REMOTE/MinIO @ eu-west-1 (F-027 REMOTE)', async ({
    request,
  }) => {
    test.setTimeout(120_000);
    const fileName = 'it008-remote-roundtrip.txt';
    const content = Buffer.from('IT-008 REMOTE round-trip against an eu-west-1 MinIO bucket.\n');

    // upload via the UI's exact 3-step flow, against the REMOTE-backed platform
    const fileId = await uploadAttachment(request, MINIO_BASE_URL, ENTITY_ID, fileName, content);

    // download it back — proves the object was stored in + served from the S3 bucket
    const dl = await request.get(`${MINIO_BASE_URL}/api/dataentities/${ENTITY_ID}/files/${fileId}`);
    expect(dl.ok(), `REMOTE download must succeed (got ${dl.status()})`).toBeTruthy();
    expect(
      (await dl.body()).equals(content),
      `REMOTE storage must round-trip: the downloaded bytes must equal the uploaded file ` +
        `(stored in + served from the eu-west-1 MinIO bucket via MinioConfig/MinioAsyncClient). ` +
        `This run ALSO documents that LSN-002 does not reproduce against a vanilla MinIO — the SDK ` +
        `auto-discovers the bucket region; the missing-.region() defect is pinned structurally in ` +
        `odd-platform (MinioConfigRegionTest, @regresses PLT-086).`,
    ).toBeTruthy();
  });
});
