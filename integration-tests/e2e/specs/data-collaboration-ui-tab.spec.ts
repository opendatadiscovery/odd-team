import { test, expect, type Page } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-091 — F-197 Data Collaboration UI Tab: characterize the three-panel Discussions UI
 * composition under no-Slack-config (the operator-visible surface of F-038's backend chain).
 *
 * Protocol: integration-tests/protocols/IT-091-data-collaboration-ui-tab.md
 * Gates: validates F-197 (H-008 infinite-scroll messages panel mounts; the three-panel shell
 *        composes). Sibling to IT-090 (F-038 backend no-config state); this is the UI-composition
 *        characterization.
 *
 * GROUND TRUTH (read before assert):
 *  - DataCollaboration.tsx:64-78 composes a 3-column shell: <Channels/> (left) + <MessagesList/>
 *    (middle) + <CurrentMessage/> (right).
 *  - Left  (Channels -> DataEntityChannelsAutocomplete.tsx:111-112): a channel picker with
 *    label "Channels" / placeholder "Search channel".
 *  - Middle (MessagesList): InfiniteScroll list; empty => "No messages" (MessagesList.tsx:70).
 *  - Right (CurrentMessage -> NoMessage.tsx, the default `''` sub-route): "Messages are not
 *    selected" + "Select a message to see discussions".
 *  - The messages endpoint returns {"items":[]} (200) on odd-minimal (DataEntityController, always
 *    on); Slack channel calls 500 (no working workspace). CHARACTERIZATION (LSN-029): pins the
 *    CURRENT no-config composition, not an ideal Slack-connected one.
 *
 * Ids: 20910-20911 (oddrn //e2e-it091/, names it091_*). Idempotent.
 */
const ENT = 20910;
const NAME = 'it091_collab_ui_entity';

async function seedEntity(id: number, name: string): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [id, `//e2e-it091/db-${id}`, `e2e-it091-${id}`]
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $1, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = '{1}'`,
    [id, `//e2e-it091/db-${id}/tables/${name}`, name]
  );
}

async function cleanup(): Promise<void> {
  await dbQuery('DELETE FROM data_entity WHERE id = $1', [ENT]);
  await dbQuery('DELETE FROM data_source WHERE id = $1', [ENT]);
}

// Best-effort wait for the messages fetch. react-query can resolve/cache the request before the
// listener catches it (memory: initialData masks early assertions), so we race it with a short
// timeout — the DOM assertions below are the real gate, not the network catch.
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

test.describe('F-197 Data Collaboration UI Tab — three-panel composition (no-config)', () => {
  test.beforeAll(async () => {
    await cleanup();
    await seedEntity(ENT, NAME);
  });

  test.afterAll(async () => {
    await cleanup();
  });

  // F-197-H-008 (characterization): the three-panel Discussions shell composes — the left channel
  // picker, the middle messages panel, and the right current-message panel all render. SUCCESS path.
  test('the three-panel Discussions shell composes its panels', async ({ page }) => {
    const fetched = messagesSettled(page, ENT);
    await page.goto(`/dataentities/${ENT}/discussions`);
    await fetched;

    // Left panel — the channel picker (label "Channels"). The autocomplete renders even though
    // the backing Slack channel call fails (the picker is a static control; results just stay empty).
    await expect(
      page.getByText('Channels', { exact: true }).first(),
      'the left panel must render the Channels picker'
    ).toBeVisible({ timeout: 10_000 });

    // Middle panel — the messages list, empty -> "No messages".
    await expect(
      page.getByText('No messages').first(),
      'the middle panel must render the messages list (empty -> "No messages")'
    ).toBeVisible({ timeout: 10_000 });

    // Right panel — the current-message no-selection state.
    await expect(
      page.getByText('Messages are not selected').first(),
      'the right panel must render the current-message no-selection state'
    ).toBeVisible({ timeout: 10_000 });
  });

  // CORNER (characterization): the right panel also renders its helper line — confirms the
  // NoMessage default sub-route composed fully (not just a bare title).
  test('the current-message panel renders its no-selection helper text', async ({ page }) => {
    const fetched = messagesSettled(page, ENT);
    await page.goto(`/dataentities/${ENT}/discussions`);
    await fetched;

    await expect(
      page.getByText('Select a message to see discussions').first(),
      'the right panel must render the "Select a message to see discussions" helper line'
    ).toBeVisible({ timeout: 10_000 });
  });
});
