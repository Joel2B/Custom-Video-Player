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

  await expect(page.locator('.fluid_video_error')).toHaveText('A network error prevented the video from loading.');
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
  test.setTimeout(35000);
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
    .poll(() => page.evaluate(() => window.fluidPlayerDebug?.at(-1)?.internals.currentSource.src), { timeout: 30000 })
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

test('HLS autoplay survives a source change before attachment', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/first.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    window.playCalls = 0;
    Object.defineProperty(document.getElementById('player'), 'paused', { configurable: true, get: () => true });
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };

    const api = window.fluidPlayer('player', {
      hls: { url: '/static/mock-hls.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'hls-source-change' },
    });
    api.src({
      src: 'https://example.test/second.m3u8',
      type: 'application/x-mpegURL',
    });
  });

  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.mockHlsInstances[0].source)).toBe(
    'https://example.test/second.m3u8',
  );

  const state = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    return {
      streamReady: player.streamReady,
      pendingStreamPlay: player.pendingStreamPlay,
      playCalls: window.playCalls,
    };
  });

  expect(state).toEqual({ streamReady: true, pendingStreamPlay: null, playCalls: 1 });
});

test('pending HLS autoplay reapplies to a native source', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  const state = await page.evaluate(async () => {
    const media = document.getElementById('player');
    Object.defineProperty(media, 'paused', { configurable: true, get: () => true });
    window.playCalls = 0;
    media.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };

    const api = window.fluidPlayer('player', {
      hls: { url: '/static/mock-hls.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'hls-native-source-change' },
    });
    api.src({ src: '/static/sample.webm', type: 'video/webm' });
    await Promise.resolve();

    const player = window.fluidPlayerDebug.at(-1).internals;
    return {
      source: player.currentSource.src,
      pendingStreamPlay: player.pendingStreamPlay,
      playCalls: window.playCalls,
    };
  });

  expect(state).toEqual({ source: '/static/sample.webm', pendingStreamPlay: null, playCalls: 1 });
});

test('DASH receives autoplay without an early media play attempt', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  await page.evaluate(() => {
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };
    window.fluidPlayer('player', {
      dash: { url: '/static/mock-dash.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'dash-autoplay' },
    });
  });

  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.[0]?.autoPlay)).toBe(true);
  expect(await page.evaluate(() => window.playCalls)).toBe(0);
});

test('manual play pending HLS attachment does not trigger muted autoplay fallback', async ({ page }) => {
  await page.route('**/slow-hls.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ path: require.resolve('../static/mock-hls.js') });
  });
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
    };
    window.fluidPlayer('player', { hls: { url: '/slow-hls.js' } });
    document.querySelector('.fluid_control_playpause').click();
  });

  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.[0]?.source)).toBe(
    'https://example.test/video.m3u8',
  );

  const state = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    return {
      muted: player.media.muted,
      volume: player.media.volume,
      pendingStreamPlay: player.pendingStreamPlay,
      playCalls: window.playCalls,
    };
  });

  expect(state).toEqual({ muted: false, volume: 1, pendingStreamPlay: null, playCalls: 1 });
});

test('native HLS consumes pending autoplay after canplay', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.canPlayType = (type) => (type === 'application/vnd.apple.mpegurl' ? 'maybe' : '');
  });
  await page.goto('/');
  await page.setContent(video('https://example.test/video.m3u8', 'application/x-mpegURL'));
  await page.evaluate(() => {
    delete window.fluidPlayer;
    delete window.fluidPlayerDebug;
    HTMLMediaElement.prototype.canPlayType = (type) => (type === 'application/vnd.apple.mpegurl' ? 'maybe' : '');
    Object.defineProperty(document.getElementById('player'), 'paused', { configurable: true, get: () => true });
    window.playCalls = 0;
    document.getElementById('player').load = () => {};
    document.getElementById('player').play = () => {
      window.playCalls++;
      return Promise.resolve();
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });
  await page.evaluate(() => {
    window.fluidPlayer('player', {
      hls: { overrideNative: false },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'native-hls-autoplay' },
    });
  });

  await expect
    .poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.pendingStreamPlay?.autoplayAttempt))
    .toBe(true);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const streaming = window.fluidPlayerDebug.at(-1).internals.streaming;
        return streaming.hlsController?.native === true && streaming.hls === null;
      }),
    )
    .toBe(true);

  await page.evaluate(() => {
    window.fluidPlayerDebug.at(-1).internals.sourceFailed = false;
    document.getElementById('player').dispatchEvent(new Event('canplay'));
  });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const player = window.fluidPlayerDebug.at(-1).internals;
        return {
          streamReady: player.streamReady,
          pendingStreamPlay: player.pendingStreamPlay,
          playCalls: window.playCalls,
        };
      }),
    )
    .toEqual({ streamReady: true, pendingStreamPlay: null, playCalls: 1 });
});

test('API play waits for HLS manifest and pause cancels a pending request', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    window.mockHlsOptions = { autoAttach: false, autoManifest: false };
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };
    window.playerApi = window.fluidPlayer('player', { hls: { url: '/static/mock-hls.js' } });
  });

  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(1);

  const pending = await page.evaluate(() => {
    window.pendingPlayResult = null;
    window.playerApi.play().then(
      () => (window.pendingPlayResult = 'resolved'),
      (error) => (window.pendingPlayResult = error.name),
    );
    window.mockHlsInstances[0].emit(window.Hls.Events.MEDIA_ATTACHED);
    return { playCalls: window.playCalls, result: window.pendingPlayResult };
  });

  expect(pending).toEqual({ playCalls: 0, result: null });

  await page.evaluate(() => window.playerApi.pause());
  await expect.poll(() => page.evaluate(() => window.pendingPlayResult)).toBe('AbortError');

  await page.evaluate(() => window.mockHlsInstances[0].emit(window.Hls.Events.MANIFEST_PARSED, { levels: [] }));
  expect(await page.evaluate(() => window.playCalls)).toBe(0);

  await page.evaluate(() => window.playerApi.play());
  await expect.poll(() => page.evaluate(() => window.playCalls)).toBe(1);
});

test('HLS plays only after manifest and starts manual loading once', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    window.mockHlsOptions = { autoAttach: false, autoManifest: false };
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };
    window.playerApi = window.fluidPlayer('player', {
      hls: {
        url: '/static/mock-hls.js',
        config: (settings) => ({ ...settings, autoStartLoad: false }),
      },
    });
  });

  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(1);
  await page.evaluate(() => {
    window.playerApi.play();
    window.playerApi.play();
    window.mockHlsInstances[0].emit(window.Hls.Events.MEDIA_ATTACHED);
  });

  expect(await page.evaluate(() => ({ play: window.playCalls, load: window.mockHlsInstances[0].startLoadCalls }))).toEqual(
    { play: 0, load: 1 },
  );

  await page.evaluate(() => window.mockHlsInstances[0].emit(window.Hls.Events.MANIFEST_PARSED, { levels: [] }));
  await expect.poll(() => page.evaluate(() => window.playCalls)).toBe(1);
});

test('stale HLS callbacks cannot mutate replacement source', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await loadPlayer(page, video('https://example.test/first.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    window.mockHlsOptions = { autoAttach: false, autoManifest: false };
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };
    window.playerApi = window.fluidPlayer('player', {
      hls: { url: '/static/mock-hls.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'stale-hls' },
    });
  });

  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(1);
  await page.evaluate(() =>
    window.playerApi.src({ src: 'https://example.test/second.m3u8', type: 'application/x-mpegURL' }),
  );
  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(2);

  await page.evaluate(() => {
    const oldHls = window.mockHlsInstances[0];
    oldHls.emit(window.Hls.Events.MEDIA_ATTACHED);
    oldHls.emit(window.Hls.Events.MANIFEST_PARSED, { levels: [] });
    oldHls.emit(window.Hls.Events.ERROR, { fatal: true, type: 'unknown' });
  });

  expect(await page.evaluate(() => ({ oldSources: window.mockHlsInstances[0].loadedSources, play: window.playCalls }))).toEqual(
    { oldSources: [], play: 0 },
  );

  await page.evaluate(() => {
    const currentHls = window.mockHlsInstances[1];
    currentHls.emit(window.Hls.Events.MEDIA_ATTACHED);
    currentHls.emit(window.Hls.Events.MANIFEST_PARSED, { levels: [] });
  });
  await expect.poll(() => page.evaluate(() => window.playCalls)).toBe(1);
  expect(errors).toEqual([]);
});

test('blocked DASH autoplay retries muted once and manual play does not', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  await page.evaluate(() => {
    window.playerApi = window.fluidPlayer('player', {
      dash: { url: '/static/mock-dash.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'dash-blocked-autoplay' },
    });
  });
  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.length)).toBe(1);

  const autoplayState = await page.evaluate(() => {
    const dash = window.mockDashInstances[0];
    dash.emit(window.dashjs.MediaPlayer.events.PLAYBACK_NOT_ALLOWED);
    dash.emit(window.dashjs.MediaPlayer.events.PLAYBACK_NOT_ALLOWED);
    return { muted: dash.media.muted, volume: dash.media.volume, playCalls: dash.playCalls };
  });
  expect(autoplayState).toEqual({ muted: true, volume: 0, playCalls: 1 });

  const manualState = await page.evaluate(() => {
    const dash = window.mockDashInstances[0];
    dash.media.muted = false;
    dash.media.volume = 1;
    document.querySelector('.fluid_control_playpause').click();
    dash.emit(window.dashjs.MediaPlayer.events.PLAYBACK_NOT_ALLOWED);
    return { muted: dash.media.muted, volume: dash.media.volume, playCalls: dash.playCalls };
  });
  expect(manualState).toEqual({ muted: false, volume: 1, playCalls: 2 });
});

test('manual HLS play is aborted when switching to another HLS source', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/first.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    window.mockHlsOptions = { autoAttach: false, autoManifest: false };
    window.playerApi = window.fluidPlayer('player', { hls: { url: '/static/mock-hls.js' } });
  });
  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(1);

  const result = await page.evaluate(async () => {
    const play = window.playerApi.play().then(
      () => 'resolved',
      (error) => error.name,
    );
    window.playerApi.src({ src: 'https://example.test/second.m3u8', type: 'application/x-mpegURL' });
    return play;
  });

  expect(result).toBe('AbortError');
});

test('terminal HLS failure rejects pending API play', async ({ page }) => {
  await page.route('**/missing-pending-hls.js', (route) => route.fulfill({ status: 404, body: '' }));
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  const result = await page.evaluate(async () => {
    const api = window.fluidPlayer('player', { hls: { url: '/missing-pending-hls.js' } });
    return api.play().then(
      () => 'resolved',
      (error) => error.name,
    );
  });

  expect(result).toBe('AbortError');
  await expect(page.locator('.fluid_video_error')).toBeVisible();
});

test('API play waits for DASH adapter initialization', async ({ page }) => {
  await page.route('**/slow-dash.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ path: require.resolve('../static/mock-dash.js') });
  });
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  await page.evaluate(() => {
    window.nativePlayCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.nativePlayCalls++;
      return Promise.resolve();
    };
    window.playerApi = window.fluidPlayer('player', { dash: { url: '/slow-dash.js' } });
    window.dashPlayPromise = window.playerApi.play();
  });

  expect(await page.evaluate(() => window.nativePlayCalls)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.[0]?.playCalls)).toBe(1);
  expect(await page.evaluate(() => Promise.race([window.dashPlayPromise.then(() => 'resolved'), Promise.resolve('pending')]))).toBe(
    'pending',
  );
  await page.evaluate(() =>
    window.mockDashInstances[0].emit(window.dashjs.MediaPlayer.events.PLAYBACK_PLAYING),
  );
  await page.evaluate(() => window.dashPlayPromise);
});

test('DASH pause prevents a late autoplay retry', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  await page.evaluate(() => {
    window.playerApi = window.fluidPlayer('player', {
      dash: { url: '/static/mock-dash.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'dash-pause-autoplay' },
    });
  });
  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.length)).toBe(1);

  const state = await page.evaluate(() => {
    const dash = window.mockDashInstances[0];
    window.playerApi.pause();
    dash.emit(window.dashjs.MediaPlayer.events.PLAYBACK_NOT_ALLOWED);
    return {
      muted: dash.media.muted,
      playCalls: dash.playCalls,
      pauseCalls: dash.pauseCalls,
    };
  });

  expect(state).toEqual({ muted: false, playCalls: 0, pauseCalls: 1 });
});

test('streaming fallback preserves autoplay on a native source', async ({ page }) => {
  await page.route('**/missing-autoplay-hls.js', (route) => route.fulfill({ status: 404, body: '' }));
  await loadPlayer(
    page,
    video(
      'https://example.test/video.m3u8',
      'application/x-mpegURL',
      '<source src="/static/sample.webm" type="video/webm">',
    ),
  );

  await page.evaluate(() => {
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };
    window.fluidPlayer('player', {
      hls: { url: '/missing-autoplay-hls.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'stream-fallback-autoplay' },
    });
  });

  await expect.poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.currentSource.src)).toBe(
    'http://127.0.0.1:8080/static/sample.webm',
  );
  await page.evaluate(() => document.getElementById('player').dispatchEvent(new Event('canplay')));
  await expect.poll(() => page.evaluate(() => window.playCalls)).toBe(1);
});

test('DASH fallback preserves autoplay on a native source', async ({ page }) => {
  await loadPlayer(
    page,
    video(
      'https://example.test/media/dash',
      'application/dash+xml',
      '<source src="/static/sample.webm" type="video/webm">',
    ),
  );

  await page.evaluate(() => {
    window.playCalls = 0;
    HTMLMediaElement.prototype.play = () => {
      window.playCalls++;
      return Promise.resolve();
    };
    window.fluidPlayer('player', {
      dash: { url: '/static/mock-dash.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'dash-fallback-autoplay' },
    });
  });
  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.length)).toBe(1);

  await page.evaluate(() => {
    window.mockDashInstances[0].emit(window.dashjs.MediaPlayer.events.ERROR, { error: { code: 25 } });
  });
  await expect.poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.currentSource.src)).toBe(
    'http://127.0.0.1:8080/static/sample.webm',
  );
  await page.evaluate(() => document.getElementById('player').dispatchEvent(new Event('canplay')));
  await expect.poll(() => page.evaluate(() => window.playCalls)).toBe(1);
});

test('play rejects immediately after a terminal stream failure', async ({ page }) => {
  await page.route('**/missing-terminal-hls.js', (route) => route.fulfill({ status: 404, body: '' }));
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  const results = await page.evaluate(async () => {
    const api = window.fluidPlayer('player', { hls: { url: '/missing-terminal-hls.js' } });
    const first = await api.play().then(
      () => 'resolved',
      (error) => error.name,
    );
    const second = await api.play().then(
      () => 'resolved',
      (error) => error.name,
    );
    return { first, second };
  });

  expect(results).toEqual({ first: 'AbortError', second: 'NotSupportedError' });
});

test('DASH pause during adapter loading cancels autoplay', async ({ page }) => {
  await page.route('**/slow-paused-dash.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ path: require.resolve('../static/mock-dash.js') });
  });
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  await page.evaluate(() => {
    const api = window.fluidPlayer('player', {
      dash: { url: '/slow-paused-dash.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'dash-loading-pause' },
    });
    api.pause();
  });

  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.[0]?.autoPlay)).toBe(false);
  expect(await page.evaluate(() => window.mockDashInstances[0].playCalls)).toBe(0);
});

test('pending manual DASH play overrides configured autoplay', async ({ page }) => {
  await page.route('**/slow-manual-dash.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ path: require.resolve('../static/mock-dash.js') });
  });
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  await page.evaluate(() => {
    const api = window.fluidPlayer('player', {
      dash: { url: '/slow-manual-dash.js' },
      layoutControls: { autoPlay: { active: true } },
      storage: { key: 'dash-pending-manual' },
    });
    window.pendingDashPlay = api.play();
  });

  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.[0]?.playCalls)).toBe(1);
  const state = await page.evaluate(async () => {
    window.mockDashInstances[0].emit(window.dashjs.MediaPlayer.events.PLAYBACK_PLAYING);
    await window.pendingDashPlay;
    const dash = window.mockDashInstances[0];
    return { autoPlay: dash.autoPlay, playCalls: dash.playCalls };
  });
  expect(state).toEqual({ autoPlay: false, playCalls: 1 });
});

test('HLS fatal recovery is bounded by error type', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    window.mockHlsOptions = { autoAttach: false, autoManifest: false };
    window.playerApi = window.fluidPlayer('player', { hls: { url: '/static/mock-hls.js' } });
  });
  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(1);

  const network = await page.evaluate(async () => {
    const hls = window.mockHlsInstances[0];
    const result = window.playerApi.play().then(
      () => 'resolved',
      (error) => error.name,
    );
    for (let index = 0; index < 3; index++) {
      hls.emit(window.Hls.Events.ERROR, { fatal: true, type: window.Hls.ErrorTypes.NETWORK_ERROR });
    }
    return { result: await result, startLoadCalls: hls.startLoadCalls, destroyCalls: hls.destroyCalls };
  });
  expect(network).toEqual({ result: 'AbortError', startLoadCalls: 2, destroyCalls: 1 });
});

test('HLS media recovery swaps codec once before terminal failure', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));

  await page.evaluate(() => {
    window.mockHlsOptions = { autoAttach: false, autoManifest: false };
    window.fluidPlayer('player', { hls: { url: '/static/mock-hls.js' } });
  });
  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(1);

  const state = await page.evaluate(() => {
    const hls = window.mockHlsInstances[0];
    for (let index = 0; index < 3; index++) {
      hls.emit(window.Hls.Events.ERROR, { fatal: true, type: window.Hls.ErrorTypes.MEDIA_ERROR });
    }
    return {
      recoverCalls: hls.recoverMediaErrorCalls,
      swapCalls: hls.swapAudioCodecCalls,
      destroyCalls: hls.destroyCalls,
    };
  });
  expect(state).toEqual({ recoverCalls: 2, swapCalls: 1, destroyCalls: 1 });
});

test('DASH classifies recoverable and terminal errors', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  await page.evaluate(() => window.fluidPlayer('player', { dash: { url: '/static/mock-dash.js' } }));
  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.length)).toBe(1);

  const recoverable = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    const dash = window.mockDashInstances[0];
    const events = window.dashjs.MediaPlayer.events;
    dash.emit(events.ERROR, { error: { code: 16 } });
    dash.emit(events.ERROR, { error: { code: 27 } });
    return { sourceFailed: player.sourceFailed, resetCalled: dash.resetCalled };
  });
  expect(recoverable).toEqual({ sourceFailed: false, resetCalled: false });

  await page.evaluate(() => {
    const dash = window.mockDashInstances[0];
    dash.emit(window.dashjs.MediaPlayer.events.PLAYBACK_ERROR, { error: { code: 3 } });
  });
  await expect(page.locator('.fluid_video_error')).toBeVisible();
});

test('HLS recovery counters reset only after matching progress', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/video.m3u8', 'application/x-mpegURL'));
  await page.evaluate(() => {
    window.mockHlsOptions = { autoAttach: false, autoManifest: false };
    window.fluidPlayer('player', { hls: { url: '/static/mock-hls.js' } });
  });
  await expect.poll(() => page.evaluate(() => window.mockHlsInstances?.length)).toBe(1);

  const state = await page.evaluate(() => {
    const hls = window.mockHlsInstances[0];
    const fatalNetwork = () =>
      hls.emit(window.Hls.Events.ERROR, { fatal: true, type: window.Hls.ErrorTypes.NETWORK_ERROR });
    const fatalMedia = () =>
      hls.emit(window.Hls.Events.ERROR, { fatal: true, type: window.Hls.ErrorTypes.MEDIA_ERROR });

    fatalNetwork();
    hls.emit(window.Hls.Events.FRAG_LOADED);
    fatalNetwork();
    fatalNetwork();

    fatalMedia();
    hls.emit(window.Hls.Events.FRAG_BUFFERED);
    fatalMedia();
    fatalMedia();

    return {
      startLoadCalls: hls.startLoadCalls,
      recoverCalls: hls.recoverMediaErrorCalls,
      swapCalls: hls.swapAudioCodecCalls,
      destroyCalls: hls.destroyCalls,
    };
  });

  expect(state).toEqual({ startLoadCalls: 3, recoverCalls: 3, swapCalls: 1, destroyCalls: 0 });
});

test('native media error waits for DASH recovery decision', async ({ page }) => {
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));
  await page.evaluate(() => window.fluidPlayer('player', { dash: { url: '/static/mock-dash.js' } }));
  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.length)).toBe(1);

  const state = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    Object.defineProperty(player.media, 'error', { configurable: true, value: { code: 3 } });
    player.media.dispatchEvent(new Event('error'));
    return { sourceFailed: player.sourceFailed, source: player.currentSource.src };
  });

  expect(state).toEqual({ sourceFailed: false, source: 'https://example.test/media/dash' });
  await expect(page.locator('.fluid_video_error')).toBeHidden();
});

test('native media error is ignored while DASH adapter loads', async ({ page }) => {
  await page.route('**/slow-error-dash.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ path: require.resolve('../static/mock-dash.js') });
  });
  await loadPlayer(page, video('https://example.test/media/dash', 'application/dash+xml'));

  const state = await page.evaluate(() => {
    window.fluidPlayer('player', { dash: { url: '/slow-error-dash.js' } });
    const player = window.fluidPlayerDebug.at(-1).internals;
    Object.defineProperty(player.media, 'error', { configurable: true, value: { code: 3 } });
    player.media.dispatchEvent(new Event('error'));
    return { sourceFailed: player.sourceFailed, source: player.currentSource.src };
  });

  expect(state).toEqual({ sourceFailed: false, source: 'https://example.test/media/dash' });
  await expect.poll(() => page.evaluate(() => window.mockDashInstances?.length)).toBe(1);
});
