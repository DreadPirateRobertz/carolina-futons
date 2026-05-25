/**
 * Playwright config for e2e a11y specs (cf-hcjq and siblings).
 *
 * Separate from parity/playwright.config.js which covers visual/functional
 * parity between legacy and Next.js builds. These specs run against the
 * staging Wix site and are non-blocking in CI (continue-on-error: true).
 */

import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.(js|ts)$/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    ignoreHTTPSErrors: true,
    // Wix pages need extra time to hydrate
    actionTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
