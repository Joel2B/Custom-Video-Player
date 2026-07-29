const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/smoke',
  testMatch: ['accessibility.spec.js', 'fullscreen.spec.js', 'layout.spec.js', 'locale.spec.js', 'vtt.spec.js'],
  workers: 1,
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  use: {
    baseURL: 'http://127.0.0.1:8080',
  },
  webServer: {
    command: 'npx webpack serve --mode=development',
    url: 'http://127.0.0.1:8080/player.min.js',
    reuseExistingServer: !process.env.CI,
  },
});
