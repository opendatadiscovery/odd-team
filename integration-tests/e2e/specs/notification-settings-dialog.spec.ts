import { test, expect, type Page } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-092 — F-198 Notification Settings dialog: the react-hook-form dialog on the Alerts tab
 * opens, renders its four alert-type fields, and round-trips a saved halt window back into the form.
 *
 * Protocol: integration-tests/protocols/IT-092-notification-settings-dialog.md
 * Gates: validates F-198 (F-198-UC-10 save->persist->reload round-trip; F-198-UC-01 the trigger is
 *        permission-gated and visible to a permitted user). Mutation surface sibling to F-014.
 *
 * GROUND TRUTH (read + curl before assert):
 *  - Mount: DataEntityAlerts.tsx:53-60 wraps the <NotificationSettings> trigger button
 *    (text "Notification settings") in <WithPermissions permissionTo=DATA_ENTITY_ALERT_CONFIG_UPDATE>.
 *    On odd-minimal (auth.type=DISABLED) /api/identity/whoami returns admin WITH
 *    DATA_ENTITY_ALERT_CONFIG_UPDATE (verified via curl), so WithPermissions renders the trigger.
 *  - On click (NotificationSettings.tsx:122-129) the dialog opens AND dispatches
 *    fetchDataEntityAlertsConfig({dataEntityId}) -> GET /api/dataentities/{id}/alert_config.
 *  - The dialog (NotificationSettings.tsx:55-106) renders the title "Notification settings", a helper
 *    line, and four <AlertTypeRange> rows whose labels (AlertTypeRange.tsx:24-29 namesMap) are
 *    "Backwards incompatible schema change", "Failed data quality test", "Failed job",
 *    "Distribution anomaly", plus an "Apply" submit button.
 *  - Round-trip (UC-10): a pre-seeded FUTURE incompatible_schema_halt_until is returned by
 *    alert_config and AlertTypeRange.getRangeToEnableNotification (lines 58-79) renders a
 *    "<duration> to turn on" caption + sets showEndTime — the saved value loaded back into the form.
 *    Verified schema: alert_halt_config(data_entity_id PK, *_halt_until timestamps).
 *
 * Ids: 20920-20921 (oddrn //e2e-it092/, names it092_*). Idempotent.
 */
const ENT = 20920;
const NAME = 'it092_notif_entity';

async function seedEntity(id: number, name: string): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [id, `//e2e-it092/db-${id}`, `e2e-it092-${id}`]
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $1, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = '{1}'`,
    [id, `//e2e-it092/db-${id}/tables/${name}`, name]
  );
}

// Pre-seed a FUTURE incompatible-schema halt window (or clear it when daysAhead is null).
async function seedHaltConfig(id: number, daysAhead: number | null): Promise<void> {
  await dbQuery('DELETE FROM alert_halt_config WHERE data_entity_id = $1', [id]);
  if (daysAhead != null) {
    await dbQuery(
      `INSERT INTO alert_halt_config (data_entity_id, incompatible_schema_halt_until)
       VALUES ($1, NOW() + make_interval(days => $2::int))`,
      [id, daysAhead]
    );
  }
}

async function cleanup(): Promise<void> {
  await dbQuery('DELETE FROM alert_halt_config WHERE data_entity_id = $1', [ENT]);
  await dbQuery('DELETE FROM data_entity WHERE id = $1', [ENT]);
  await dbQuery('DELETE FROM data_source WHERE id = $1', [ENT]);
}

const alertConfigFetch = (page: Page, id: number) =>
  page.waitForResponse(
    r =>
      new RegExp(`/api/dataentities/${id}/alert_config`).test(r.url()) &&
      r.request().method() === 'GET' &&
      r.ok()
  );

async function openDialog(page: Page, id: number): Promise<void> {
  await page.goto(`/dataentities/${id}/alerts`);
  await page.waitForLoadState('networkidle');
  const trigger = page.getByRole('button', { name: 'Notification settings' });
  await expect(
    trigger.first(),
    'a user WITH DATA_ENTITY_ALERT_CONFIG_UPDATE must see the Notification settings trigger'
  ).toBeVisible({ timeout: 10_000 });
  const fetched = alertConfigFetch(page, id);
  await trigger.first().click();
  await fetched; // the on-open fetchDataEntityAlertsConfig resolves
}

test.describe('F-198 Notification Settings dialog — open, fields, round-trip', () => {
  test.afterAll(async () => {
    await cleanup();
  });

  // F-198-UC-01 + dialog composition (confirmed): the permission-gated trigger is visible, the
  // dialog opens, and all four alert-type fields render. SUCCESS path.
  test('the dialog opens and renders its four alert-type fields', async ({ page }) => {
    await cleanup();
    await seedEntity(ENT, NAME);
    await seedHaltConfig(ENT, null); // no pre-existing config — a clean form

    await openDialog(page, ENT);

    const dialog = page.getByRole('dialog');
    await expect(dialog, 'the Notification settings dialog must open').toBeVisible({
      timeout: 10_000,
    });
    for (const label of [
      'Backwards incompatible schema change',
      'Failed data quality test',
      'Failed job',
      'Distribution anomaly',
    ]) {
      await expect(
        dialog.getByText(label).first(),
        `the dialog must render the "${label}" alert-type field`
      ).toBeVisible({ timeout: 10_000 });
    }
    // the submit control of the react-hook-form dialog.
    await expect(
      dialog.getByRole('button', { name: 'Apply' }),
      'the dialog must render its Apply submit button'
    ).toBeVisible();
  });

  // F-198-UC-10 (confirmed): a saved halt window loads back into the dialog. We seed a FUTURE
  // incompatible_schema_halt_until in the DB (the persisted state a prior save would produce),
  // open the dialog, and assert the form reflects it via the "<duration> to turn on" caption that
  // AlertTypeRange renders ONLY when a future halt value is present. This is the reload half of the
  // save->persist->reload round-trip, proven against DB ground truth.
  test('a persisted halt window loads back into the dialog (round-trip reload)', async ({
    page,
  }) => {
    await cleanup();
    await seedEntity(ENT, NAME);
    await seedHaltConfig(ENT, 3); // incompatible_schema halted until NOW()+3 days

    // sanity: the persisted value is what the API will return into the form.
    const rows = await dbQuery<{ incompatible_schema_halt_until: string | null }>(
      'SELECT incompatible_schema_halt_until FROM alert_halt_config WHERE data_entity_id = $1',
      [ENT]
    );
    expect(
      rows[0]?.incompatible_schema_halt_until,
      'the halt window must be persisted before the reload assertion'
    ).toBeTruthy();

    await openDialog(page, ENT);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // The future halt value loaded -> AlertTypeRange shows the "... to turn on" remaining-time caption.
    await expect(
      dialog.getByText(/to turn on/i).first(),
      'the saved future halt window must load back into the form (the "... to turn on" caption renders)'
    ).toBeVisible({ timeout: 10_000 });
  });

  // CORNER (negative): with NO persisted halt config, the dialog opens but renders no
  // "... to turn on" caption — the form is clean. Proves the reload assertion above is data-driven.
  test('with no persisted config the dialog form is clean (no remaining-time caption)', async ({
    page,
  }) => {
    await cleanup();
    await seedEntity(ENT, NAME);
    await seedHaltConfig(ENT, null);

    await openDialog(page, ENT);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // the four fields are present (proves the dialog rendered fully) ...
    await expect(
      dialog.getByText('Backwards incompatible schema change').first()
    ).toBeVisible({ timeout: 10_000 });
    // ... but with no halt set, no "... to turn on" remaining-time caption appears.
    await page.waitForTimeout(500);
    await expect(
      dialog.getByText(/to turn on/i),
      'with no persisted halt window the form must show no remaining-time caption'
    ).toHaveCount(0);
  });
});
