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

test('configuration merge ignores prototype pollution keys', async ({ page }) => {
  await loadPlayer(page, '<video id="player" width="640" height="360"></video><video id="second"></video>');

  const state = await page.evaluate(() => {
    const options = JSON.parse(`{
      "__proto__":{"polluted":"root"},
      "layoutControls":{
        "constructor":{"prototype":{"polluted":"constructor"}},
        "menu":{"prototype":{"polluted":"menu"}}
      }
    }`);
    const nested = Object.create(null);
    nested.__proto__ = { polluted: 'null-prototype' };
    options.layoutControls.contextMenu = nested;

    window.fluidPlayer('player', options);
    window.fluidPlayer('second');
    const players = window.fluidPlayerDebug.slice(-2).map((entry) => entry.internals);

    return {
      object: Object.prototype.polluted,
      function: Function.prototype.polluted,
      array: Array.prototype.polluted,
      ownConstructor: Object.hasOwn(players[0].config.layoutControls, 'constructor'),
      ownPrototype: Object.hasOwn(players[0].config.layoutControls.menu, 'prototype'),
      firstMenu: players[0].config.layoutControls.menu.autoPlay,
      secondMenu: players[1].config.layoutControls.menu.autoPlay,
    };
  });

  expect(state).toEqual({
    object: undefined,
    function: undefined,
    array: undefined,
    ownConstructor: false,
    ownPrototype: false,
    firstMenu: true,
    secondMenu: true,
  });
});

test('pause stops media while it is buffering', async ({ page }) => {
  await loadPlayer(page, '<video id="player" width="640" height="360"></video>');

  const pauseCalls = await page.evaluate(() => {
    const media = document.getElementById('player');
    Object.defineProperty(media, 'paused', { configurable: true, value: false });
    Object.defineProperty(media, 'readyState', { configurable: true, value: 1 });
    media.pause = () => window.pauseCalls++;
    window.pauseCalls = 0;

    window.fluidPlayer('player').pause();
    return window.pauseCalls;
  });

  expect(pauseCalls).toBe(1);
});

test('rejected manual play does not enable muted autoplay fallback', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" width="640" height="360"></video>');
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const state = await page.evaluate(async () => {
    const media = document.getElementById('player');
    const api = window.fluidPlayer('player');

    media.volume = 0.7;
    media.muted = false;

    await api.play().catch(() => {});
    await Promise.resolve();

    return { muted: media.muted, volume: media.volume };
  });

  expect(state).toEqual({ muted: false, volume: 0.7 });
});

test('rejected autoplay retries muted', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <video id="player" width="640" height="360">
      <source src="/static/sample.webm" type="video/webm">
    </video>
  `);
  await page.evaluate(() => {
    localStorage.clear();
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return window.playCalls === 1
        ? Promise.reject(new DOMException('Blocked', 'NotAllowedError'))
        : Promise.resolve();
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const state = await page.evaluate(async () => {
    const media = document.getElementById('player');
    window.fluidPlayer('player', {
      layoutControls: { autoPlay: { active: true } },
    });
    await new Promise((resolve) => setTimeout(resolve));

    return { muted: media.muted, volume: media.volume, playCalls: window.playCalls };
  });

  expect(state).toEqual({ muted: true, volume: 0, playCalls: 2 });
});

test('rejected muted autoplay does not retry indefinitely', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <video id="player" width="640" height="360">
      <source src="/static/sample.webm" type="video/webm">
    </video>
  `);
  await page.evaluate(() => {
    localStorage.clear();
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const state = await page.evaluate(async () => {
    const media = document.getElementById('player');
    window.fluidPlayer('player', {
      layoutControls: { autoPlay: { active: true } },
    });
    await new Promise((resolve) => setTimeout(resolve));

    return { muted: media.muted, playCalls: window.playCalls };
  });

  expect(state).toEqual({ muted: true, playCalls: 2 });
});

test('autoplay does not run without a valid source', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" width="640" height="360"></video>');
  await page.evaluate(() => {
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const playCalls = await page.evaluate(() => {
    window.fluidPlayer('player', {
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'no-source-autoplay' },
    });
    return window.playCalls;
  });

  expect(playCalls).toBe(0);
});

test('late autoplay rejection cannot mute a replacement source', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.setContent(`
    <video id="player" width="640" height="360">
      <source src="/static/sample.webm" type="video/webm">
    </video>
  `);
  await page.evaluate(() => {
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return new Promise((resolve, reject) => {
        window.rejectOldPlay = reject;
      });
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const state = await page.evaluate(async () => {
    const media = document.getElementById('player');
    const api = window.fluidPlayer('player', {
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'late-source-rejection' },
    });
    media.volume = 0.7;
    api.src({ src: '/replacement.webm', type: 'video/webm' });
    window.rejectOldPlay(new DOMException('Blocked', 'NotAllowedError'));
    await Promise.resolve();
    await Promise.resolve();

    return { muted: media.muted, volume: media.volume, playCalls: window.playCalls };
  });

  expect(state).toEqual({ muted: false, volume: 0.7, playCalls: 1 });
  expect(errors).toEqual([]);
});

test('late autoplay rejection is inert after destroy', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.setContent(`
    <video id="player" width="640" height="360">
      <source src="/static/sample.webm" type="video/webm">
    </video>
  `);
  await page.evaluate(() => {
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return new Promise((resolve, reject) => {
        window.rejectDestroyedPlay = reject;
      });
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const playCalls = await page.evaluate(async () => {
    const api = window.fluidPlayer('player', {
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'late-destroy-rejection' },
    });
    await api.destroy();
    window.rejectDestroyedPlay(new DOMException('Blocked', 'NotAllowedError'));
    await Promise.resolve();
    await Promise.resolve();
    return window.playCalls;
  });

  expect(playCalls).toBe(1);
  expect(errors).toEqual([]);
});

test('pause cancels waitInteraction retry timer', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <video id="player" width="640" height="360">
      <source src="/static/sample.webm" type="video/webm">
    </video>
  `);
  await page.evaluate(() => {
    localStorage.clear();
    window.mediaPlayCalls = 0;
    window.waitPlayCalls = 0;
    HTMLMediaElement.prototype.play = function () {
      if (this.id === 'player') {
        window.mediaPlayCalls++;
        return window.mediaPlayCalls === 1
          ? Promise.reject(new DOMException('Blocked', 'NotAllowedError'))
          : Promise.resolve();
      }
      window.waitPlayCalls++;
      return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });

  await page.evaluate(() => {
    window.playerApi = window.fluidPlayer('player', {
      layoutControls: { autoPlay: { active: true, waitInteraction: true } },
      storage: { key: 'wait-interaction-pause' },
    });
  });
  await expect.poll(() => page.evaluate(() => window.waitPlayCalls)).toBe(1);

  const state = await page.evaluate(async () => {
    const beforePause = window.waitPlayCalls;
    window.playerApi.pause();
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { beforePause, afterPause: window.waitPlayCalls };
  });

  expect(state).toEqual({ beforePause: 1, afterPause: 1 });
});

test('source change invalidates pending waitInteraction promise', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <video id="player" width="640" height="360">
      <source src="/static/sample.webm" type="video/webm">
    </video>
  `);
  await page.evaluate(() => {
    localStorage.clear();
    window.mediaPlayCalls = 0;
    window.resolveWaitInteraction = null;
    HTMLMediaElement.prototype.play = function () {
      if (this.id === 'player') {
        window.mediaPlayCalls++;
        return window.mediaPlayCalls === 1
          ? Promise.reject(new DOMException('Blocked', 'NotAllowedError'))
          : Promise.resolve();
      }
      return new Promise((resolve) => {
        window.resolveWaitInteraction = resolve;
      });
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });

  await page.evaluate(() => {
    window.playerApi = window.fluidPlayer('player', {
      layoutControls: { autoPlay: { active: true, waitInteraction: true } },
      storage: { key: 'wait-interaction-source' },
    });
  });
  await expect.poll(() => page.evaluate(() => typeof window.resolveWaitInteraction)).toBe('function');

  const toggleCalls = await page.evaluate(async () => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    let calls = 0;
    player.toggleMute = () => calls++;
    window.playerApi.src({ src: '/replacement.webm', type: 'video/webm' });
    window.resolveWaitInteraction();
    await Promise.resolve();
    return calls;
  });

  expect(toggleCalls).toBe(0);
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
