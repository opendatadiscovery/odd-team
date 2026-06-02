import * as path from 'node:path';
import { composeUp, composeDown } from './stack';

// Self-contained LOGIN_FORM (enforcing) stack: the platform with auth.type=LOGIN_FORM,
// so every non-whitelisted route requires authentication (ADR-0074). Distinct
// ports/names/project from odd-minimal (DISABLED) so IT-009 can contrast the two modes
// in one run. __dirname is e2e/helpers → three up to the workspace root.
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-loginform.docker-compose.yml',
);
const PROJECT = 'oddlf';

export const LOGINFORM_BASE_URL = process.env.ODD_LOGINFORM_BASE_URL ?? 'http://localhost:18082';
// The shared odd-minimal stack (DISABLED) is the other half of the ADR-0074 contrast.
export const DISABLED_BASE_URL = process.env.ODD_BASE_URL ?? 'http://localhost:18080';

export const upLoginFormStack = (): Promise<void> =>
  composeUp({
    compose: COMPOSE,
    project: PROJECT,
    healthUrl: `${LOGINFORM_BASE_URL}/actuator/health`,
    label: 'LOGIN_FORM (enforcing)',
  });

export const downLoginFormStack = (): Promise<void> =>
  composeDown({ compose: COMPOSE, project: PROJECT });
