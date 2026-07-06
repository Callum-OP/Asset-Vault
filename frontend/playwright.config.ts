import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the Vite dev server (which proxies API routes to
// the backend). Two suites:
//   • e2e/mocked — network is stubbed with page.route, so these need NO backend
//     and run anywhere (CI included). This is the always-on suite.
//   • e2e/live   — hit the real FastAPI backend + seeded Postgres. Each test
//     skips itself when the backend isn't reachable, so `npm run test:e2e`
//     stays green with just the frontend up.
//
// The dev server proxies the API to 127.0.0.1:8000 by default; override with
// VITE_API_TARGET (see vite.config.ts). Use 127.0.0.1 for the backend on
// Windows so it doesn't try IPv6 ::1 while uvicorn binds IPv4.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mocked',
      testDir: './e2e/mocked',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'live',
      testDir: './e2e/live',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the frontend dev server for the tests and reuse a running one locally.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
