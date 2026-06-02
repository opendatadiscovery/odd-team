import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { upNotificationsStack, downNotificationsStack, NOTIF_DB_URL } from '../helpers/notifications-stack';

/**
 * IT-011 — notifications WAL lifecycle: the subsystem (off by default) creates its
 * logical-replication infrastructure only when enabled.
 *
 * Protocol: integration-tests/protocols/IT-011-notifications-wal-lifecycle.md
 * Gates: enforces ADR-0040 (notifications off by default) + ADR-0044 (lazy slot+publication).
 *
 * The deterministic, load-bearing fact: with `notifications.enabled=false` (the default)
 * there is NO WAL subscriber and NO replication slot/publication; enabling it makes the
 * subscriber (advisory-lock leader, ADR-0043) lazily create a logical-replication slot
 * + a publication on the `alert` table (ADR-0044). Contrast: the shared odd-minimal
 * stack (disabled) vs the notifications stack (enabled).
 *
 * Why this pins the lifecycle and NOT end-to-end delivery: the WAL delivery chain is real
 * (manually it delivers an alert to a webhook in ~4s) but FLAKY on a fresh boot — ADR-0044's
 * slot-BEFORE-publication create-order can wedge the subscriber permanently with
 * `ERROR: publication "odd_platform_publication_alert" does not exist` when any WAL change
 * lands between slot- and publication-creation, with no recovery (no DROP path) — a real
 * bug filed separately (see the protocol's cross-references / run-log 2026-06-02). So the
 * STABLE gate is the slot/publication lifecycle, which is created either way.
 *
 * EXPECTED RESULT: GREEN. RED means the subsystem created WAL infra while disabled
 * (ADR-0040 regression) or failed to create it when enabled (ADR-0044 regression).
 *
 * Self-contained for the ON side (its own postgres+platform :18084); the OFF side is the
 * shared odd-minimal stack — so do NOT run focused with ODD_STACK_EXTERNAL=1.
 */

const DISABLED_DB_URL =
  process.env.ODD_DB_URL ?? 'postgresql://odd-platform:odd-platform-password@localhost:15432/odd-platform';
const SLOT = 'odd_platform_replication_slot';
const PUB = 'odd_platform_publication_alert';

async function countOn(dbUrl: string, sql: string, param: string): Promise<number> {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  try {
    return (await c.query(sql, [param])).rowCount ?? 0;
  } finally {
    await c.end();
  }
}
const slotCount = (dbUrl: string) =>
  countOn(dbUrl, 'SELECT 1 FROM pg_replication_slots WHERE slot_name = $1', SLOT);
const pubCount = (dbUrl: string) =>
  countOn(dbUrl, 'SELECT 1 FROM pg_publication WHERE pubname = $1', PUB);

test.describe('IT-011 notifications WAL lifecycle — WAL infra exists only when notifications are enabled', () => {
  test.beforeAll(async () => {
    test.setTimeout(300_000);
    await upNotificationsStack();
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await downNotificationsStack();
  });

  test('OFF (default) → no replication slot; ON → slot + publication lazily created (ADR-0040/0044)', async () => {
    test.setTimeout(120_000);

    // ---- OFF: the shared odd-minimal stack ships notifications disabled (ADR-0040) ----
    expect(
      await slotCount(DISABLED_DB_URL),
      `ADR-0040: notifications are off by default → no WAL subscriber, so no '${SLOT}' replication ` +
        `slot must exist on the default (odd-minimal) stack. (Is odd-minimal up? Don't run focused ` +
        `with ODD_STACK_EXTERNAL=1.)`,
    ).toBe(0);

    // ---- ON: enabling notifications lazily creates the slot + publication (ADR-0044) ----
    expect(
      await slotCount(NOTIF_DB_URL),
      `ADR-0044: with notifications enabled, the subscriber (advisory-lock leader) must lazily ` +
        `create the logical-replication slot '${SLOT}'.`,
    ).toBe(1);
    expect(
      await pubCount(NOTIF_DB_URL),
      `ADR-0044: with notifications enabled, the subscriber must lazily create the publication ` +
        `'${PUB}' on the alert table.`,
    ).toBe(1);
  });
});
