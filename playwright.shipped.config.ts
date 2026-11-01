import { defineConfig } from '@playwright/test';

// Checks the SHIPPED build with no dev seams: against a local `vite preview` by default, or any URL in LIVE_URL (the live site).
const url = process.env['LIVE_URL'];
export default defineConfig({
  testDir: 'tests/shipped',
  timeout: 120_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: url ?? 'http://127.0.0.1:4173/', viewport: { width: 1280, height: 720 } },
  webServer: url ? undefined : { command: 'npm run build && npm run preview', url: 'http://127.0.0.1:4173/', reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }, { name: 'firefox', use: { browserName: 'firefox' } }],
});
