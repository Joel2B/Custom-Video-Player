const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

test('plays native WebM sources with explicit and inferred MIME types', async ({ page }) => {
  await loadPlayer(
    page,
    `<video id="typed" muted width="320" height="180">
      <source src="/static/sample.webm" type="video/webm">
    </video>
    <video id="inferred" muted width="320" height="180">
      <source src="/static/sample.webm">
    </video>`,
  );

  await page.evaluate(async () => {
    const typed = window.fluidPlayer('typed');
    const inferred = window.fluidPlayer('inferred');
    await Promise.all([typed.play(), inferred.play()]);
  });

  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll('video')].every((video) => video.currentTime > 0)))
    .toBe(true);

  expect(
    await page.evaluate(() => window.fluidPlayerDebug.slice(-2).map(({ internals }) => internals.currentSource.type)),
  ).toEqual(['video/webm', 'video/webm']);
});

test('browser bundle initializes, emits events, destroys, and reinitializes', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" controls width="640" height="360"></video>');
  await page.addScriptTag({ url: '/player.min.js' });

  await expect.poll(() => page.evaluate(() => typeof window.fluidPlayer)).toBe('function');

  const initial = await page.evaluate(() => {
    window.playerApi = window.fluidPlayer('player');
    window.eventCount = 0;
    window.playerApi.on('volumechange', () => window.eventCount++);
    window.playerApi.setVolume(0.4);
    window.playerApi.setPlaybackSpeed(1.25);
    window.playerApi.toggleControlBar(false);
    document.getElementById('player').dispatchEvent(new Event('volumechange'));

    return {
      methods: ['play', 'pause', 'skipTo', 'setVolume', 'setPlaybackSpeed', 'on', 'once', 'off', 'destroy'].every(
        (name) => typeof window.playerApi[name] === 'function',
      ),
      wrapped: document.getElementById('player').parentElement.classList.contains('fluid_video_wrapper'),
      eventCount: window.eventCount,
      volume: document.getElementById('player').volume,
    };
  });

  expect(initial).toEqual({ methods: true, wrapped: true, eventCount: 1, volume: 0.4 });

  const validation = await page.evaluate(() => {
    const errors = [];

    for (const action of [
      () => window.fluidPlayer('missing'),
      () => window.playerApi.setVolume(2),
      () => window.playerApi.setPlaybackSpeed(0),
    ]) {
      try {
        action();
      } catch (error) {
        errors.push(error.name);
      }
    }

    return errors;
  });

  expect(validation).toEqual(['TypeError', 'RangeError', 'RangeError']);

  await page.evaluate(() => window.playerApi.destroy());
  await expect(page.locator('.fluid_video_wrapper')).toHaveCount(0);
  await expect(page.locator('body > video#player[controls]')).toHaveCount(1);

  const reinitialized = await page.evaluate(() => {
    const api = window.fluidPlayer('player');

    return {
      ready: typeof api.destroy === 'function',
      wrapped: document.getElementById('player').parentElement.classList.contains('fluid_video_wrapper'),
    };
  });

  expect(reinitialized).toEqual({ ready: true, wrapped: true });
});

test('destroy cancels pending streaming and restores global layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.route('**/fake-hls.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ contentType: 'application/javascript', body: 'window.Hls = function Hls() {};' });
  });

  await page.goto('/');
  await page.setContent(`
    <div id="theatre-root"><video id="player" controls width="640" height="360">
      <source src="https://example.test/video.m3u8" type="application/x-mpegURL">
    </video></div>
  `);

  await page.addScriptTag({ url: '/player.min.js' });

  const state = await page.evaluate(async () => {
    document.body.style.setProperty('overflow', 'clip', 'important');

    let api = window.fluidPlayer('player', {
      hls: { url: '/fake-hls.js' },
      layoutControls: {
        fullscreen: { fallback: 'force' },
      },
    });

    api.toggleFullScreen();
    await api.destroy();

    api = window.fluidPlayer('player', {
      layoutControls: {
        theatre: {
          advanced: { theatreElement: 'theatre-root', classToApply: 'is-theatre' },
        },
      },
    });

    document.querySelector('.fluid_control_theatre').click();
    await api.destroy();

    return {
      overflow: document.body.style.getPropertyValue('overflow'),
      priority: document.body.style.getPropertyPriority('overflow'),
      fullscreen: document.querySelector('.fluid_fullscreen_fallback') !== null,
      theatre: document.getElementById('theatre-root').classList.contains('is-theatre'),
    };
  });

  expect(state).toEqual({ overflow: 'clip', priority: 'important', fullscreen: false, theatre: false });
  await page.waitForTimeout(150);
  expect(errors).toEqual([]);
});
