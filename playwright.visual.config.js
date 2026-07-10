const { defineConfig } = require('@playwright/test');

const port = process.env.VISUAL_PORT || '8082';
const serverCommand = process.env.VISUAL_SERVER_COMMAND || `npx webpack serve --mode=development --port ${port}`;

module.exports = defineConfig({
  testDir: './test/visual',
  workers: 1,
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.001,
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: serverCommand,
    url: `http://127.0.0.1:${port}/player.min.js`,
    reuseExistingServer: process.env.VISUAL_REUSE_SERVER === 'true',
  },
});
