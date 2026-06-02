import { expect, type APIRequestContext } from '@playwright/test';

// Replicates the UI client's (DataEntityAttachmentApi) 3-step upload: initiate (JSON
// {fileName}) → upload one chunk (multipart {file,index}) → complete (PUT). Returns the
// new file's id (DataEntityFile.id). `baseURL` is '' to use the Playwright config's
// baseURL (relative URLs), or an absolute base (e.g. http://localhost:18081) to target a
// different stack. NB: the initiate field is `fileName` (camelCase) — one of the
// contract's ~8 camelCase outliers (ADR-0072 serialization naming), NOT `file_name`.
export async function uploadAttachment(
  request: APIRequestContext,
  baseURL: string,
  entityId: number,
  fileName: string,
  content: Buffer,
): Promise<number> {
  const init = await request.post(`${baseURL}/api/dataentities/${entityId}/files/uploads`, {
    data: { fileName },
  });
  expect(init.ok(), `initiate upload failed: ${init.status()} ${await init.text()}`).toBeTruthy();
  const uploadId = (await init.json()).id;

  const chunk = await request.post(
    `${baseURL}/api/dataentities/${entityId}/files/uploads/${uploadId}/chunks`,
    { multipart: { file: { name: fileName, mimeType: 'text/plain', buffer: content }, index: '0' } },
  );
  expect(chunk.ok(), `chunk upload failed: ${chunk.status()} ${await chunk.text()}`).toBeTruthy();

  const done = await request.put(`${baseURL}/api/dataentities/${entityId}/files/uploads/${uploadId}`);
  expect(done.ok(), `complete upload failed: ${done.status()} ${await done.text()}`).toBeTruthy();
  return (await done.json()).id;
}
