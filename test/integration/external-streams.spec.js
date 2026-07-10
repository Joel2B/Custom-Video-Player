const { expect, test } = require('@playwright/test');

test('public HLS stream initializes external adapter', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <video id="player" width="640" height="360">
      <source src="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" type="application/x-mpegURL">
    </video>
  `);
  await page.addScriptTag({ url: '/player.min.js' });
  await page.evaluate(() => window.fluidPlayer('player'));

  await expect
    .poll(() => page.evaluate(() => Boolean(window.fluidPlayerDebug.at(-1).internals.streaming.hls)), {
      timeout: 30000,
    })
    .toBe(true);
});

test('public DASH stream initializes external adapter', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <video id="player" width="640" height="360">
      <source src="https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd" type="application/dash+xml">
    </video>
  `);
  await page.addScriptTag({ url: '/player.min.js' });
  await page.evaluate(() => window.fluidPlayer('player'));

  await expect
    .poll(() => page.evaluate(() => Boolean(window.fluidPlayerDebug.at(-1).internals.streaming.dash)), {
      timeout: 30000,
    })
    .toBe(true);
});
