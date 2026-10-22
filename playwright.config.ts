import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local (e.g. CI renderer runs); app tests read their env from the shell instead.
}

const withApp = process.env.PW_APP === '1';

const appProjects: PlaywrightTestConfig['projects'] = withApp
  ? [
      {
        name: 'app',
        testDir: 'tests/e2e/app',
        use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000' },
      },
    ]
  : [];

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [...appProjects],
  webServer: withApp
    ? {
        command: 'pnpm dev',
        url: 'http://localhost:3000/login',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
