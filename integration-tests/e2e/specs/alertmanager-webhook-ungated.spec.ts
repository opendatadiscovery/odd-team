import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-115 — F-007 AlertManager webhook: UNGATED cross-tenant alert creation.
 *
 * Protocol: integration-tests/protocols/IT-115-alertmanager-webhook-ungated.md
 * Gates: validates F-007 (UC: unauthenticated_payload_trust + cross_tenant_alert_creation +
 *        untrusted_input_to_rendered_text). SECURITY-class.
 *
 * GROUND-BEFORE-ASSERT (read at authoring time):
 *  - AlertManagerController.java:21-26 — `@PostMapping("ingestion/alert/alertmanager")` 4-line
 *    handler: no @PreAuthorize, no @Secured, no @ConditionalOnProperty, no header inspection,
 *    no @Valid. Delegates `req.getAlerts()` verbatim to AlertService.handleExternalAlerts.
 *  - AlertServiceImpl.java:178 — `setDataEntityOddrn(externalAlert.getLabels().get("entity_oddrn"))`
 *    maps the UNTRUSTED webhook label straight onto AlertPojo.dataEntityOddrn — no DataEntity
 *    existence/ownership/permission check between controller and INSERT. type is HARDCODED
 *    DISTRIBUTION_ANOMALY (line 177); status OPEN.
 *  - AlertServiceImpl.java:168/185 — the untrusted Prometheus `generatorURL` is rebuilt via
 *    UriComponentsBuilder and embedded verbatim into the chunk description
 *    (`String.format("Distribution Anomaly. URL: %s", queryUrl)`).
 *  - SecurityConstants WHITELIST_PATHS[2] = `/ingestion/**` exempts the path under every UI auth
 *    mode; under auth.type=DISABLED the whole chain is permitAll. The IngestionDataEntitiesFilter
 *    binds `/ingestion/entities` POST only — it does NOT cover this path.
 *
 * GROUNDED LIVE (2026-06-07, no-credential, auth.type=DISABLED stack):
 *  - POST a single-alert payload with labels.entity_oddrn = a SEEDED target entity → HTTP 200,
 *    exactly ONE `alert` row appears on that entity: status=1 (OPEN), type=4 (DISTRIBUTION_ANOMALY).
 *  - chunk description read back verbatim:
 *      "Distribution Anomaly. URL: http://prometheus.example/graph?g0.moment_input=...&g0.end_input=..."
 *    (the attacker-supplied generatorURL is rendered into stored text).
 *  - A payload naming a NON-EXISTENT entity_oddrn → HTTP 400 USR003 "Database constraint violation":
 *    the `alert_fk_data_entity FOREIGN KEY (data_entity_oddrn) REFERENCES data_entity(oddrn)` rejects
 *    it. So the PRECISE characterization is: an anonymous caller forges an OPEN alert on ANY *existing*
 *    data entity it names — REGARDLESS OF OWNERSHIP — but cannot invent a brand-new oddrn.
 *
 * Relationship to IT-062 (no duplication): IT-062 pins the *empty-payload auth posture* of this
 * endpoint (`{alerts:[]}` → 200, request reaches the handler without a credential). IT-115 pins the
 * F-007-specific *forge*: the side effect — an actual cross-tenant alert ROW with a DB read-back —
 * which IT-062 explicitly defers to the per-feature protocol.
 *
 * LSN-029 characterization pins — GREEN under the current ungated posture; they FLIP RED the day the
 * webhook gains an auth gate (S2S token / signature) OR a server-side entity_oddrn ownership check.
 *
 * Operator caveat (why pin it): on a network-reachable deployment the AlertManager webhook lets ANY
 * caller (anonymous under DISABLED; any authenticated user otherwise) inject false-positive OPEN
 * alerts attributed to OTHER teams' data entities. Combined with the cross-owner global "All" alerts
 * tab (PLT-121) those forged alerts are visible platform-wide and indistinguishable from real ones.
 * Filed: PLT-014 (webhook hardening) + PLT-003 (filter does not cover the path).
 *
 * Responsible disclosure: this spec asserts THAT the exposure is reachable + reads back a NON-SENSITIVE
 * marker (a synthetic oddrn + a fake prometheus URL). It does not forge a signature, dump secrets, or
 * exploit a real tenant.
 *
 * Namespacing: it115_ names, //e2e-it115/ oddrns, ids 21150-21159. Idempotent (DELETE-then-act).
 */
const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';

const SRC_ID = 21150;
const TARGET_ID = 21151; // a real entity OWNED by nobody the attacker controls — the "victim" entity
const TARGET_ODDRN = '//e2e-it115/target_entity';
const ABSENT_ODDRN = '//e2e-it115/does_not_exist_21159';

// Seed ONE real data entity (the FK target). The attacker does NOT own it; that is the point —
// the webhook attributes a forged alert to it with no ownership check.
async function seedTargetEntity(): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [SRC_ID, '//e2e-it115/ds', 'it115-ds'],
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, view_count, source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [TARGET_ID, TARGET_ODDRN, 'it115_target', SRC_ID],
  );
}

async function clearAlertsFor(oddrn: string): Promise<void> {
  await dbQuery(
    `DELETE FROM alert_chunk ac USING alert a WHERE ac.alert_id = a.id AND a.data_entity_oddrn = $1`,
    [oddrn],
  );
  await dbQuery(`DELETE FROM alert WHERE data_entity_oddrn = $1`, [oddrn]);
}

// POST an AlertManager-shaped payload with NO Authorization header (the anonymous attacker).
async function postAlertManagerAnon(entityOddrn: string, generatorURL: string): Promise<number> {
  const res = await fetch(`${BASE}/ingestion/alert/alertmanager`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      alerts: [{ labels: { entity_oddrn: entityOddrn }, generatorURL, startsAt: '2026-06-07T00:00:00' }],
    }),
  });
  await res.text().catch(() => undefined);
  return res.status;
}

test.describe('F-007 AlertManager webhook — ungated cross-tenant alert creation', () => {
  test('PRIMARY: an anonymous caller forges an OPEN alert on an entity it does not own (no auth, no ownership check)', async () => {
    await seedTargetEntity();
    await clearAlertsFor(TARGET_ODDRN);

    const before = await dbQuery<{ n: string }>(
      `SELECT count(*)::int AS n FROM alert WHERE data_entity_oddrn = $1`,
      [TARGET_ODDRN],
    );
    expect(Number(before[0].n), 'arrange: target entity starts with zero alerts').toBe(0);

    // The forge: NO credential, attacker-chosen entity_oddrn pointing at the victim entity.
    const status = await postAlertManagerAnon(TARGET_ODDRN, 'http://prometheus.example/graph');
    expect(status, 'PRIMARY: the unauthenticated AlertManager POST is accepted (200) — no auth gate').toBe(200);

    // Ground truth (DB read-back, never the API): exactly ONE OPEN DISTRIBUTION_ANOMALY alert now sits
    // on the victim entity, attributed by the anonymous caller with no ownership/permission check.
    const after = await dbQuery<{ n: string; st: number; ty: number }>(
      `SELECT count(*)::int AS n, max(status) AS st, max("type") AS ty FROM alert WHERE data_entity_oddrn = $1`,
      [TARGET_ODDRN],
    );
    expect(
      Number(after[0].n),
      'PRIMARY: exactly one forged alert row is created on the victim entity (cross_tenant_alert_creation)',
    ).toBe(1);
    expect(after[0].st, 'the forged alert is OPEN (status=1)').toBe(1);
    expect(after[0].ty, 'type is hardcoded DISTRIBUTION_ANOMALY (=4) regardless of the AlertManager labels').toBe(4);
  });

  test('CORNER: the attacker-supplied generatorURL is rendered verbatim into the stored alert chunk description', async () => {
    await seedTargetEntity();
    await clearAlertsFor(TARGET_ODDRN);

    // A recognizable, NON-SENSITIVE marker host in the untrusted generatorURL (responsible disclosure:
    // we prove untrusted input reaches stored text, not that a real XSS payload executes).
    const marker = 'http://it115-untrusted-marker.example/graph';
    const status = await postAlertManagerAnon(TARGET_ODDRN, marker);
    expect(status, 'CORNER: the anonymous POST with a custom generatorURL is accepted (200)').toBe(200);

    const rows = await dbQuery<{ description: string }>(
      `SELECT ac.description FROM alert a JOIN alert_chunk ac ON ac.alert_id = a.id
       WHERE a.data_entity_oddrn = $1 LIMIT 1`,
      [TARGET_ODDRN],
    );
    expect(rows.length, 'a chunk row was created for the forged alert').toBe(1);
    // The service formats `Distribution Anomaly. URL: <generatorURL>` (AlertServiceImpl.java:185) — the
    // untrusted host lands verbatim in the persisted, operator-visible description text.
    expect(
      rows[0].description,
      'CORNER: untrusted generatorURL host is embedded verbatim in the stored chunk description (untrusted_input_to_rendered_text)',
    ).toContain('it115-untrusted-marker.example');
    expect(rows[0].description).toContain('Distribution Anomaly. URL:');
  });

  test('PRECISION PIN: a forged alert on a NON-EXISTENT oddrn is rejected by the DB FK (400) — the forge is bounded to EXISTING entities', async () => {
    // This sharpens the "cross-tenant" claim against over-statement: the webhook does not let an attacker
    // invent a brand-new oddrn — `alert_fk_data_entity` requires the referenced data_entity to exist.
    // The real exposure is forging onto any entity that DOES exist (the PRIMARY test), regardless of owner.
    await clearAlertsFor(ABSENT_ODDRN);
    const status = await postAlertManagerAnon(ABSENT_ODDRN, 'http://prometheus.example/graph');
    expect(
      status,
      'PRECISION: an alert referencing a non-existent data_entity oddrn is rejected (400) by the FK, not silently created',
    ).toBe(400);

    const after = await dbQuery<{ n: string }>(
      `SELECT count(*)::int AS n FROM alert WHERE data_entity_oddrn = $1`,
      [ABSENT_ODDRN],
    );
    expect(Number(after[0].n), 'no alert row is created for the non-existent oddrn').toBe(0);
  });
});
