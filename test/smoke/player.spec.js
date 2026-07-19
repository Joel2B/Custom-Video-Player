const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

test('plays native WebM sources with explicit and inferred MIME types', async ({ page }) => {
  await page.route('**/media/typed', (route) =>
    route.fulfill({ contentType: 'video/webm', path: require.resolve('../static/sample.webm') }),
  );
  await loadPlayer(
    page,
    `<video id="typed" muted width="320" height="180">
      <source src="/static/sample.webm" type="video/webm">
    </video>
    <video id="inferred" muted width="320" height="180">
      <source src="/static/sample.webm">
    </video>
    <video id="opaque" muted width="320" height="180">
      <source src="/media/typed" type='video/webm; codecs="vp9, opus"'>
    </video>`,
  );

  await page.evaluate(async () => {
    const typed = window.fluidPlayer('typed');
    const inferred = window.fluidPlayer('inferred');
    const opaque = window.fluidPlayer('opaque');
    await Promise.all([typed.play(), inferred.play(), opaque.play()]);
  });

  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll('video')].every((video) => video.currentTime > 0)))
    .toBe(true);

  expect(
    await page.evaluate(() => window.fluidPlayerDebug.slice(-3).map(({ internals }) => internals.currentSource.type)),
  ).toEqual(['video/webm', 'video/webm', 'video/webm']);
});

for (const [code, name] of [
  [2, 'network'],
  [3, 'decode'],
  [4, 'unsupported format'],
]) {
  test(`${name} errors fall back without showing a final error`, async ({ page }) => {
    await loadPlayer(
      page,
      `<video id="player" muted width="320" height="180">
        <source src="/static/sample.webm?broken" type="video/webm">
        <source src="/static/sample.webm" type="video/webm">
      </video>`,
    );

    await page.evaluate((errorCode) => {
      window.fluidPlayer('player');
      const media = document.getElementById('player');
      Object.defineProperty(media, 'error', { configurable: true, value: { code: errorCode } });
      media.dispatchEvent(new Event('error'));
    }, code);

    await expect
      .poll(() =>
        page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.currentSource.src.endsWith('/static/sample.webm')),
      )
      .toBe(true);
    await expect(page.locator('.fluid_video_error')).toBeHidden();
  });
}

test('rejected source extension shows unsupported format error', async ({ page }) => {
  await loadPlayer(
    page,
    `<video id="player" width="320" height="180">
      <source src="/video.avi" type="video/x-msvideo">
    </video>`,
  );
  await page.evaluate(() => window.fluidPlayer('player'));

  await expect(page.locator('.fluid_video_error')).toHaveText('This video format is not supported.');
  await expect(page.locator('.fluid_video_error')).toBeVisible();
});

test('source without extension or type shows unsupported format error', async ({ page }) => {
  await loadPlayer(page, '<video id="player"><source src="/media/unknown"></video>');
  await page.evaluate(() => window.fluidPlayer('player'));

  await expect(page.locator('.fluid_video_error')).toHaveText('This video format is not supported.');
});

test('final media error shows its configurable reason and clears on new source', async ({ page }) => {
  await loadPlayer(
    page,
    `<video id="player" muted width="320" height="180">
      <source src="/static/sample.webm?broken" type="video/webm">
    </video>`,
  );

  await page.evaluate(() => {
    window.playerApi = window.fluidPlayer('player', {
      captions: { mediaErrorUnsupported: 'Custom unsupported format message.' },
    });
    const media = document.getElementById('player');
    Object.defineProperty(media, 'error', { configurable: true, value: { code: 4 } });
    media.dispatchEvent(new Event('error'));
  });

  const error = page.locator('.fluid_video_error');
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute('role', 'alert');
  await expect(error).toHaveAttribute('aria-live', 'assertive');
  await expect(error).toHaveText('Custom unsupported format message.');

  await page.evaluate(() => window.playerApi.src({ src: '/static/sample.webm', type: 'video/webm' }));
  await expect(error).toBeHidden();
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
