const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/integration',
  timeout: 60000,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  use: { baseURL: 'http://127.0.0.1:8080' },
  webServer: {
    command: 'npx webpack serve --mode=development',
    url: 'http://127.0.0.1:8080/player.min.js',
    reuseExistingServer: !process.env.CI,
  },
});
