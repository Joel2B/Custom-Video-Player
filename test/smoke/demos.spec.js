const { expect, test } = require('@playwright/test');

const demos = [
  'custom_context.html',
  'dash_live.html',
  'dash_vod.html',
  'hls_live.html',
  'hls_vod.html',
  'hls_vod_basic_audio.html',
  'hls_vod_basic_subtitles.html',
  'hls_vod_fps.html',
  'hls_vod_preload.html',
  'hls_vod_with_hls_js.html',
  'skip_return.html',
  'vod_basic.html',
  'vod_basic_autohide.html',
  'vod_basic_by_ref.html',
  'vod_basic_multiple.html',
  'vod_basic_subtitles.html',
  'vod_basic_vtt.html',
  'vod_basic_vtt_static.html',
  'vod_extended.html',
  'vod_error.html',
  'vod_responsive.html',
];

for (const demo of demos) {
  test(`${demo} initializes`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.route('https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js', (route) =>
      route.fulfill({ path: require.resolve('../static/mock-hls-quality.js') }),
    );
    await page.route('https://cdn.dashjs.org/v5.0.3/dash.all.min.js', (route) =>
      route.fulfill({ path: require.resolve('../static/mock-dash.js') }),
    );
    await page.route(/\.(mp4|mkv|m3u8|mpd)(\?.*)?$/i, (route) => route.abort());

    const response = await page.goto(`/${demo}`, { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBe(true);

    const expectedPlayers = demo === 'vod_basic_multiple.html' ? 2 : 1;
    await expect(page.locator('.fluid_video_wrapper')).toHaveCount(expectedPlayers);

    if (demo === 'hls_vod_preload.html') {
      await expect.poll(() => page.evaluate(() => Boolean(window.fluidPlayerDebug.at(-1).internals.streaming.hls))).toBe(true);
      await page.locator('#start-loading').click();
      expect(await page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.streaming.hls.startLoadCalled)).toBe(true);
    }

    if (demo === 'vod_error.html') {
      const error = page.locator('.fluid_video_error');
      await expect(error).toBeVisible();
      await expect(error).toHaveAttribute('role', 'alert');
      await expect(error).toHaveText('This video format is not supported.');
    }

    expect(errors).toEqual([]);
  });
}
