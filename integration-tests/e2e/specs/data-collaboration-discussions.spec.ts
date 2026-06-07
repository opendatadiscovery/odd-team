import { test, expect, type Page } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-090 — F-038 Data Collaboration (Slack Discussions): characterize what the Discussions tab
 * renders on odd-minimal, where Slack is NOT usably configured.
 *
 * Protocol: integration-tests/protocols/IT-090-data-collaboration-discussions.md
 * Gates: validates F-038 (F-038-UC-10: on a deployment where Discussions cannot deliver, the tab
 *        still mounts and the messages surface is empty — the user-observable no-config state).
 *
 * GROUND TRUTH (read + curl before assert):
 *  - Route: DataEntityDetailsRoutes.tsx:106-117 mounts `<DataCollaboration />` at `discussions`
 *    (RestrictedRoute on !isStatusDeleted; NO permission wrapper). Tab: DataEntityDetailsTabs.tsx:96-99.
 *  - On the RUNNING odd-minimal stack (verified via curl 2026-06):
 *      GET /api/dataentities/{id}/messages      -> 200 {"items":[]}   (served by DataEntityController,
 *                                                  NOT @ConditionalOnDataCollaboration — always on)
 *      GET /api/datacollaboration/.../channels  -> 500 SYS001         (DataCollaborationController IS
 *                                                  registered — datacollaboration.enabled=true — but
 *                                                  Slack calls fail: no working workspace/token)
 *    So the feature flag is ON but Slack is non-functional — the realistic operator no-config state.
 *  - With messages = [] the middle panel shows the hardcoded "No messages" placeholder
 *    (MessagesList.tsx:69-71, EmptyContentPlaceholder text='No messages'). The right panel shows
 *    "Messages are not selected" (NoMessage.tsx) since no :messageId is in the route.
 *  - This is a CHARACTERIZATION (LSN-029): it pins the CURRENT no-config rendered state. It does
 *    NOT assert an ideal Slack-connected experience (none is reachable here).
 *
 * Ids: 20900-20901 (oddrn //e2e-it090/, names it090_*). Idempotent.
 */
const ENT = 20900;
const NAME = 'it090_discussions_entity';

async function seedEntity(id: number, name: string): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [id, `//e2e-it090/db-${id}`, `e2e-it090-${id}`]
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $1, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = '{1}'`,
    [id, `//e2e-it090/db-${id}/tables/${name}`, name]
  );
}

async function cleanup(): Promise<void> {
  await dbQuery('DELETE FROM data_entity WHERE id = $1', [ENT]);
  await dbQuery('DELETE FROM data_source WHERE id = $1', [ENT]);
}

// Best-effort wait for the messages fetch. react-query can resolve/cache the request before the
// listener catches it (memory: initialData masks early assertions), so we race it with a short
// timeout — the DOM assertions are the real gate, not the network catch.
function messagesSettled(page: Page, id: number): Promise<unknown> {
  return Promise.race([
    page
      .waitForResponse(
        r =>
          new RegExp(`/api/dataentities/${id}/messages`).test(r.url()) &&
          r.request().method() === 'GET',
        { timeout: 8_000 }
      )
      .catch(() => null),
    page.waitForTimeout(8_000),
  ]);
}

test.describe('F-038 Data Collaboration — Discussions tab no-Slack-config state', () => {
  test.beforeAll(async () => {
    await cleanup();
    await seedEntity(ENT, NAME);
  });

  test.afterAll(async () => {
    await cleanup();
  });

  // F-038-UC-10 (characterization): the Discussions tab mounts and, with no Slack messages,
  // renders the empty messages placeholder. SUCCESS path for the no-config rendered state.
  test('the Discussions tab renders the empty "No messages" state', async ({ page }) => {
    const fetched = messagesSettled(page, ENT);
    await page.goto(`/dataentities/${ENT}/discussions`);
    await fetched;

    // Middle panel: with messages=[] the hardcoded "No messages" placeholder renders.
    await expect(
      page.getByText('No messages').first(),
      'with no Slack messages the Discussions messages panel must show the empty "No messages" state'
    ).toBeVisible({ timeout: 10_000 });
  });

  // CORNER (characterization): the right ("current message") panel shows the no-selection state
  // since the route carries no :messageId. Confirms the tab composes its panels even with no data.
  test('the Discussions tab shows the no-message-selected panel', async ({ page }) => {
    const fetched = messagesSettled(page, ENT);
    await page.goto(`/dataentities/${ENT}/discussions`);
    await fetched;

    await expect(
      page.getByText('Messages are not selected').first(),
      'the current-message panel must render the "Messages are not selected" no-selection state'
    ).toBeVisible({ timeout: 10_000 });
  });
});
