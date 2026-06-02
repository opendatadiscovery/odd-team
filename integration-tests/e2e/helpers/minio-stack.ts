import * as path from 'node:path';
import { composeUp, composeDown } from './stack';

// Self-contained REMOTE/MinIO stack (postgres + MinIO@eu-west-1 + bucket-init + the
// platform with attachment.storage=REMOTE). Distinct ports/names/project from the shared
// odd-minimal stack, so the two coexist; IT-008 brings it up/tears it down itself.
// __dirname is e2e/helpers → three up to the workspace root.
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-minio.docker-compose.yml',
);
const PROJECT = 'oddminio';

export const MINIO_BASE_URL = process.env.ODD_MINIO_BASE_URL ?? 'http://localhost:18081';
export const MINIO_DB_URL =
  process.env.ODD_MINIO_DB_URL ??
  'postgresql://odd-platform:odd-platform-password@localhost:15433/odd-platform';

// This stack is ALWAYS self-managed by the spec (dedicated — eu-west-1, REMOTE config);
// ODD_STACK_EXTERNAL (which governs the shared odd-minimal stack) does not apply here.
export const upMinioStack = (): Promise<void> =>
  composeUp({
    compose: COMPOSE,
    project: PROJECT,
    healthUrl: `${MINIO_BASE_URL}/actuator/health`,
    label: 'REMOTE/MinIO (eu-west-1)',
  });

export const downMinioStack = (): Promise<void> => composeDown({ compose: COMPOSE, project: PROJECT });
