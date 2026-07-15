import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Load .env.local so tests use the TEST database, not production.
// Never run tests against production — always have .env.local pointing to your test Supabase project.
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Start the dev server automatically before running tests.
  // Dev server uses .env.local → test DB.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
