import { defineConfig, devices } from '@playwright/test';

// Self-contained e2e integration harness (odd-team-owned, local-only).
//
// Drives the REAL ODD UI — the odd-platform image serves the bundled React app at
// :18080 (same image the upstream odd-platform/tests/ harness drives at :8080; we
// do NOT depend on that harness). Ground truth (view_count etc.) is read straight
// from Postgres so a measurement is never perturbed by an API read.
//
// The odd-minimal stack (platform + Postgres) is brought up / torn down by the
// global setup/teardown — no external prerequisite beyond Docker. Set
// ODD_STACK_EXTERNAL=1 to run against a stack you started yourself.
export default defineConfig({
  testDir: './specs',
  fullyParallel: false, // specs mutate shared DB state — keep them ordered
  workers: 1,
  retries: 0,           // a regression pin must never be masked by a retry
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  globalSetup: './global-setup',
  globalTeardown: './global-teardown',
  timeout: 60_000,
  use: {
    baseURL: process.env.ODD_BASE_URL ?? 'http://localhost:18080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
