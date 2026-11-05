import { defineConfig, devices } from '@playwright/test';
import { getTarget } from './targets.mjs';

const target = getTarget();

export default defineConfig({
  testDir: './tests',
  // The Pi is small, keep the load light
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }], ['list']] : [['list']],
  timeout: 60_000,
  use: {
    baseURL: target.baseURL,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Waits for the deployed version, every other project depends on it
      name: 'deploy',
      testMatch: /deploy\.setup\.mjs/,
      timeout: 15 * 60_000,
    },
    {
      name: 'public',
      testMatch: /public\.spec\.mjs/,
      dependencies: ['deploy'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'public-mobile',
      testMatch: /public\.spec\.mjs/,
      dependencies: ['deploy'],
      use: { ...devices['Pixel 7'] },
    },
    ...(target.loginSecret
      ? [
          {
            // Signs the test trainer in once and saves its session for the trainer project
            name: 'login',
            testMatch: /login\.setup\.mjs/,
            dependencies: ['deploy'],
          },
          {
            name: 'trainer',
            testMatch: /trainer\.spec\.mjs/,
            dependencies: ['login'],
            use: { ...devices['Desktop Chrome'], storageState: target.storageStatePath },
          },
        ]
      : []),
    ...(target.adminLoginSecret && target.runsAdmin
      ? [
          {
            name: 'login-admin',
            testMatch: /login-admin\.setup\.mjs/,
            dependencies: ['deploy'],
          },
          {
            name: 'admin',
            testMatch: /admin\.spec\.mjs/,
            dependencies: ['login-admin'],
            use: { ...devices['Desktop Chrome'], storageState: target.adminStorageStatePath },
          },
        ]
      : []),
  ],
});
