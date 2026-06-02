import * as path from 'node:path';
import { composeUp, composeDown } from './stack';

// Self-contained notifications/WAL stack: Postgres (wal_level=logical) + the platform with
// the WAL-driven notification subsystem ENABLED + webhook sender → a webhook-echo stub.
// Distinct ports/names/project (oddnotif) from the other stacks. __dirname is e2e/helpers.
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-notifications.docker-compose.yml',
);
const PROJECT = 'oddnotif';

export const NOTIF_BASE_URL = process.env.ODD_NOTIF_BASE_URL ?? 'http://localhost:18084';
export const NOTIF_DB_URL =
  process.env.ODD_NOTIF_DB_URL ??
  'postgresql://odd-platform:odd-platform-password@localhost:15436/odd-platform';

export const upNotificationsStack = (): Promise<void> =>
  composeUp({
    compose: COMPOSE,
    project: PROJECT,
    healthUrl: `${NOTIF_BASE_URL}/actuator/health`,
    label: 'notifications/WAL (enabled + webhook stub)',
  });

export const downNotificationsStack = (): Promise<void> =>
  composeDown({ compose: COMPOSE, project: PROJECT });

// NB: end-to-end delivery (alert → WAL → webhook stub) is observable manually against this
// stack (the compose includes a webhook-echo stub at probe-webhook-stub) — `docker logs
// probe-webhook-stub` shows received notifications — but it is NOT a stable automated gate:
// ADR-0044's slot-before-publication create-order can wedge the subscriber on a fresh boot
// ("publication does not exist"), so IT-011 pins the deterministic slot/publication
// lifecycle instead. See the IT-011 protocol cross-references for the filed wedge bug.
