import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { composeCmd } from './helpers/docker';

const COMPOSE = path.resolve(
  __dirname,
  '../../lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml',
);

export default async function globalTeardown(): Promise<void> {
  if (process.env.ODD_STACK_EXTERNAL === '1') return;
  console.log('[e2e] tearing down odd-minimal stack (volumes destroyed)…');
  execSync(`${composeCmd()} -f "${COMPOSE}" down -v`, { stdio: 'inherit' });
}
