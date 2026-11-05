import { defineConfig } from '@playwright/test';

const url = process.env['E2E_URL'];
export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: process.env['SHOTS'] ? [] : ['**/_*.spec.ts'], // screenshot helpers run only on request
  timeout: 30_000,
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 2, // Keep WebGL browser suites within the local runner budget; avoid competing GPU-heavy contexts.
  reporter: [['list']],
  use: { baseURL: url ?? 'http://127.0.0.1:5173', viewport: { width: 1280, height: 720 } },
  webServer: url ? undefined : { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }, { name: 'firefox', use: { browserName: 'firefox' } }],
});
