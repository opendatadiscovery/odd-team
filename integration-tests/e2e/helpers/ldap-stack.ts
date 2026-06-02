import * as path from 'node:path';
import { composeUp, composeDown } from './stack';

// Self-contained LDAP (enforcing) stack: OpenLDAP seeded with one NON-admin user (alice)
// + the platform with auth.type=LDAP. LDAP is the only locally-reproducible mode that
// wires the AuthorizationCustomizer AND gives a real per-user role, so a USER-role
// principal (no admin-groups → USER) with no policies is correctly DENIED a gated admin
// mutation (403). Distinct ports/names/project (oddldap) from the other stacks.
// __dirname is e2e/helpers → three up to the workspace root.
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-ldap.docker-compose.yml',
);
const PROJECT = 'oddldap';

export const LDAP_BASE_URL = process.env.ODD_LDAP_BASE_URL ?? 'http://localhost:18083';
// Seeded in the openldap init container; no admin-groups configured → maps to USER role.
export const LDAP_USER = { username: 'alice', password: 'alicepassword' };

export const upLdapStack = (): Promise<void> =>
  composeUp({
    compose: COMPOSE,
    project: PROJECT,
    healthUrl: `${LDAP_BASE_URL}/actuator/health`,
    label: 'LDAP (enforcing, non-admin user)',
  });

export const downLdapStack = (): Promise<void> => composeDown({ compose: COMPOSE, project: PROJECT });
