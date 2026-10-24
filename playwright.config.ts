import net from 'net';
import { defineConfig } from '@playwright/test';
import { outDir } from './tests/e2e/env';

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });

// Picked once in the runner, then inherited by the workers (they load this file again and find it set).
process.env.PW_PORT ??= String(await freePort());

export default defineConfig({
  testDir: './tests/e2e',
  // *.e2e.ts, not *.spec.ts: vitest (npm test) would pick up a *.spec.ts.
  testMatch: '**/*.e2e.ts',
  outputDir: `${outDir()}/.pw`,
  timeout: 90_000,
  retries: 0,
  fullyParallel: true,
  workers: Number(process.env.PW_WORKERS || 4),
  reporter: [['list']],
  globalSetup: './tests/e2e/global.ts',
  globalTeardown: './tests/e2e/teardown.ts',
  use: {
    baseURL: `http://localhost:${process.env.PW_PORT}`,
    // CI: the Chromium that `npx playwright install chromium` fetches. On a machine without it: PW_CHANNEL=msedge (or chrome).
    channel: process.env.PW_CHANNEL || undefined,
    deviceScaleFactor: 1,
    // A screen that cannot be reached must fail fast so it is recorded as unreachable, not eat the whole test timeout.
    actionTimeout: 10_000,
    navigationTimeout: 30_000
  },
  webServer: {
    command: 'npx tsx tests/e2e/server.ts',
    url: `http://localhost:${process.env.PW_PORT}/health`,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
