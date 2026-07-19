const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

const video = (source, type, fallback = '') => `
  <video id="player" width="640" height="360">
    <source src="${source}" type="${type}">
    ${fallback}
  </video>
`;

test('HLS initializes local adapter and detaches cleanly', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/media/hls', 'application/x-mpegURL'));

  await page.evaluate(() =>
    window.fluidPlayer('player', {
      hls: { url: '/static/mock-hls.js' },
    }),
  );

  await expect
    .poll(() => page.evaluate(() => Boolean(window.fluidPlayerDebug.at(-1).internals.streaming.hls)))
    .toBe(true);

  const state = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;

    return {
      source: player.streaming.hls.source,
      sameInstance: player.streaming.hls === window.mockHlsInstances[0],
    };
  });

  expect(state).toEqual({ source: 'https://example.test/media/hls', sameInstance: true });

  await page.evaluate(() => window.fluidPlayerDebug.at(-1).instance.destroy());
  expect(await page.evaluate(() => window.mockHlsInstances[0].destroyed)).toBe(true);
});

test('DASH initializes local adapter and detaches cleanly', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  await page.evaluate(() =>
    window.fluidPlayer('player', {
      dash: { url: '/static/mock-dash.js' },
    }),
  );

  await expect
    .poll(() => page.evaluate(() => Boolean(window.fluidPlayerDebug.at(-1).internals.streaming.dash)))
    .toBe(true);

  const state = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    return {
      source: player.streaming.dash.source,
      sameInstance: player.streaming.dash === window.mockDashInstances[0],
    };
  });

  expect(state).toEqual({ source: 'https://example.test/media/dash', sameInstance: true });

  await page.evaluate(() => window.fluidPlayerDebug.at(-1).instance.destroy());
  expect(await page.evaluate(() => window.mockDashInstances[0].resetCalled)).toBe(true);
});

test('failed streaming script falls back to next source', async ({ page }) => {
  await page.route('**/missing-hls.js', (route) => route.fulfill({ status: 404, body: '' }));

  await loadPlayer(
    page,
    video(
      'https://example.test/video.m3u8',
      'application/x-mpegURL',
      '<source src="https://example.test/fallback.mp4" type="video/mp4">',
    ),
  );

  await page.evaluate(() =>
    window.fluidPlayer('player', {
      hls: { url: '/missing-hls.js' },
    }),
  );

  await expect
    .poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.currentSource.src))
    .toBe('https://example.test/fallback.mp4');
});

test('failed streaming script without fallback shows final error', async ({ page }) => {
  await page.route('**/missing-hls.js', (route) => route.fulfill({ status: 404, body: '' }));
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() =>
    window.fluidPlayer('player', {
      hls: { url: '/missing-hls.js' },
    }),
  );

  await expect(page.locator('.fluid_video_error')).toHaveText(
    'A network error prevented the video from loading.',
  );
  await expect(page.locator('.fluid_video_error')).toBeVisible();
});

test('failed DASH script falls back to next source', async ({ page }) => {
  await page.route('**/missing-dash.js', (route) => route.fulfill({ status: 404, body: '' }));

  await loadPlayer(
    page,
    video(
      'https://example.test/video.mpd',
      'application/dash+xml',
      '<source src="https://example.test/fallback.mp4" type="video/mp4">',
    ),
  );

  await page.evaluate(() =>
    window.fluidPlayer('player', {
      dash: { url: '/missing-dash.js' },
    }),
  );

  await expect
    .poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.currentSource.src))
    .toBe('https://example.test/fallback.mp4');
});

test('streaming script timeout falls back to next source', async ({ page }) => {
  test.setTimeout(25000);
  await page.route('**/hanging-hls.js', () => {});

  await loadPlayer(
    page,
    video(
      'https://example.test/video.m3u8',
      'application/x-mpegURL',
      '<source src="https://example.test/fallback.mp4" type="video/mp4">',
    ),
  );

  await page.evaluate(() =>
    window.fluidPlayer('player', {
      hls: { url: '/hanging-hls.js' },
    }),
  );

  await expect
    .poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.currentSource.src), { timeout: 20000 })
    .toBe('https://example.test/fallback.mp4');
});

test('source change invalidates pending HLS initialization', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.route('**/slow-hls.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ path: require.resolve('../static/mock-hls.js') });
  });

  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    const api = window.fluidPlayer('player', { hls: { url: '/slow-hls.js' } });
    api.src({ src: 'https://example.test/replacement.mp4', type: 'video/mp4' });
  });

  await page.waitForTimeout(250);

  const state = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    return { source: player.currentSource.src, hls: player.streaming.hls };
  });

  expect(state).toEqual({ source: 'https://example.test/replacement.mp4', hls: null });
  expect(errors).toEqual([]);
});
