const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

test('fallback fullscreen allows only one player and restores page', async ({ page }) => {
  await loadPlayer(
    page,
    '<video id="first" width="320" height="180"></video><video id="second" width="320" height="180"></video>',
  );

  const state = await page.evaluate(async () => {
    document.body.style.setProperty('overflow', 'clip', 'important');
    const options = { layoutControls: { fullscreen: { fallback: 'force' } } };
    const first = window.fluidPlayer('first', options);
    const second = window.fluidPlayer('second', options);
    const events = { firstEnter: 0, firstExit: 0, secondEnter: 0, secondExit: 0 };

    first.on('enterfullscreen', () => events.firstEnter++);
    first.on('exitfullscreen', () => events.firstExit++);
    second.on('enterfullscreen', () => events.secondEnter++);
    second.on('exitfullscreen', () => events.secondExit++);

    first.toggleFullScreen();
    const during = {
      first: document.getElementById('first').parentElement.classList.contains('fluid_fullscreen_fallback'),
      second: document.getElementById('second').parentElement.classList.contains('fluid_fullscreen_fallback'),
      overflow: document.body.style.overflow,
    };
    second.toggleFullScreen();
    const switched = {
      first: document.getElementById('first').parentElement.classList.contains('fluid_fullscreen_fallback'),
      second: document.getElementById('second').parentElement.classList.contains('fluid_fullscreen_fallback'),
      overflow: document.body.style.overflow,
    };
    second.toggleFullScreen();

    return {
      during,
      switched,
      events,
      overflow: document.body.style.getPropertyValue('overflow'),
      priority: document.body.style.getPropertyPriority('overflow'),
    };
  });

  expect(state).toEqual({
    during: { first: true, second: false, overflow: 'hidden' },
    switched: { first: false, second: true, overflow: 'hidden' },
    events: { firstEnter: 1, firstExit: 1, secondEnter: 1, secondExit: 1 },
    overflow: 'clip',
    priority: 'important',
  });
});

test('late fullscreen rejection is inert after destroy', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" width="320" height="180"></video>');
  await page.evaluate(() => {
    window.rejectFullscreen = null;
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value() {} });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value() {
        return new Promise((resolve, reject) => {
          window.rejectFullscreen = reject;
        });
      },
    });
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const state = await page.evaluate(async () => {
    document.body.style.setProperty('overflow', 'clip', 'important');
    const player = window.fluidPlayer('player');
    player.toggleFullScreen();
    const destroying = player.destroy();
    window.rejectFullscreen(new Error('denied'));
    await Promise.resolve();
    await destroying;
    return {
      fallback: document.querySelector('.fluid_fullscreen_fallback') !== null,
      overflow: document.body.style.getPropertyValue('overflow'),
      priority: document.body.style.getPropertyPriority('overflow'),
    };
  });

  expect(state).toEqual({ fallback: false, overflow: 'clip', priority: 'important' });
});

test('fullscreen rejection falls back while player remains active', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" width="320" height="180"></video>');
  await page.evaluate(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value() {} });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value() {
        return Promise.reject(new Error('denied'));
      },
    });
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const state = await page.evaluate(async () => {
    document.body.style.setProperty('overflow', 'clip', 'important');
    const player = window.fluidPlayer('player');
    let enters = 0;
    player.on('enterfullscreen', () => enters++);
    player.toggleFullScreen();
    await Promise.resolve();
    await Promise.resolve();
    const active = {
      fallback: document.querySelector('.fluid_video_wrapper').classList.contains('fluid_fullscreen_fallback'),
      pressed: document.querySelector('.fluid_control_fullscreen').getAttribute('aria-pressed'),
      overflow: document.body.style.overflow,
      enters,
    };
    player.toggleFullScreen();
    return {
      active,
      overflow: document.body.style.getPropertyValue('overflow'),
      priority: document.body.style.getPropertyPriority('overflow'),
    };
  });

  expect(state).toEqual({
    active: { fallback: true, pressed: 'true', overflow: 'hidden', enters: 1 },
    overflow: 'clip',
    priority: 'important',
  });
});

test('reentrant fallback activation keeps one player active', async ({ page }) => {
  await loadPlayer(
    page,
    '<video id="first" width="320" height="180"></video>' +
      '<video id="second" width="320" height="180"></video>' +
      '<video id="third" width="320" height="180"></video>',
  );

  const state = await page.evaluate(() => {
    document.body.style.setProperty('overflow', 'clip', 'important');
    const options = { layoutControls: { fullscreen: { fallback: 'force' } } };
    const first = window.fluidPlayer('first', options);
    const second = window.fluidPlayer('second', options);
    const third = window.fluidPlayer('third', options);
    const events = { firstExit: 0, secondEnter: 0, thirdEnter: 0, thirdExit: 0 };
    first.on('exitfullscreen', () => {
      events.firstExit++;
      third.toggleFullScreen();
    });
    second.on('enterfullscreen', () => events.secondEnter++);
    third.on('enterfullscreen', () => events.thirdEnter++);
    third.on('exitfullscreen', () => events.thirdExit++);
    first.toggleFullScreen();
    second.toggleFullScreen();

    const active = ['first', 'second', 'third'].map((id) =>
      document.getElementById(id).parentElement.classList.contains('fluid_fullscreen_fallback'),
    );
    const pressed = ['first', 'second', 'third'].map((id) =>
      document.getElementById(id).parentElement.querySelector('.fluid_control_fullscreen').getAttribute('aria-pressed'),
    );
    third.toggleFullScreen();
    return {
      active,
      pressed,
      events,
      overflow: document.body.style.getPropertyValue('overflow'),
      priority: document.body.style.getPropertyPriority('overflow'),
    };
  });

  expect(state).toEqual({
    active: [false, false, true],
    pressed: ['false', 'false', 'true'],
    events: { firstExit: 1, secondEnter: 0, thirdEnter: 1, thirdExit: 1 },
    overflow: 'clip',
    priority: 'important',
  });
});

test('native fullscreen exit rejection is handled', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" width="320" height="180"></video>');
  await page.evaluate(() => {
    window.fullscreenElementMock = null;
    Object.defineProperties(document, {
      fullscreenEnabled: { configurable: true, value: true },
      fullscreenElement: {
        configurable: true,
        get() {
          return window.fullscreenElementMock;
        },
      },
      exitFullscreen: {
        configurable: true,
        value() {
          window.exitFullscreenCalls = (window.exitFullscreenCalls || 0) + 1;
          return Promise.reject(new Error('exit denied'));
        },
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value() {
        window.fullscreenElementMock = this;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      },
    });
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(async () => {
    const player = window.fluidPlayer('player');
    player.toggleFullScreen();
    player.toggleFullScreen();
    await Promise.resolve();
  });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.exitFullscreenCalls)).toBe(1);
});

test('native fullscreen exit keeps boolean ARIA state', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" width="320" height="180"></video>');
  await page.evaluate(() => {
    window.fullscreenElementMock = null;
    Object.defineProperties(document, {
      fullscreenEnabled: { configurable: true, value: true },
      fullscreenElement: {
        configurable: true,
        get() {
          return window.fullscreenElementMock;
        },
      },
      exitFullscreen: { configurable: true, value() {} },
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value() {
        return Promise.resolve();
      },
    });
  });
  await page.addScriptTag({ url: '/player.min.js' });

  const pressed = await page.evaluate(() => {
    window.fluidPlayer('player');
    const wrapper = document.querySelector('.fluid_video_wrapper');
    window.fullscreenElementMock = wrapper;
    document.dispatchEvent(new Event('fullscreenchange'));
    window.fullscreenElementMock = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return document.querySelector('.fluid_control_fullscreen').getAttribute('aria-pressed');
  });

  expect(pressed).toBe('false');
});

test('iOS fullscreen falls back safely when native video APIs are unavailable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  try {
    await page.goto('/');
    await page.setContent('<video id="player" width="320" height="180"></video>');
    await page.evaluate(() => {
      Object.defineProperties(HTMLVideoElement.prototype, {
        webkitEnterFullscreen: { configurable: true, value: undefined },
        webkitExitFullscreen: { configurable: true, value: undefined },
      });
      Object.defineProperty(HTMLVideoElement.prototype, 'requestFullscreen', {
        configurable: true,
        value: undefined,
      });
    });
    await page.addScriptTag({ url: '/player.min.js' });

    const state = await page.evaluate(() => {
      const player = window.fluidPlayer('player', { layoutControls: { fullscreen: { iosNative: true } } });
      const events = { enter: 0, exit: 0 };
      player.on('enterfullscreen', () => events.enter++);
      player.on('exitfullscreen', () => events.exit++);

      player.toggleFullScreen();
      const during = {
        active: document.querySelector('.fluid_video_wrapper').classList.contains('fluid_fullscreen_fallback'),
        controlsInside: document
          .querySelector('.fluid_video_wrapper')
          .contains(document.querySelector('.fluid_mobile_controls')),
        pressed: document.querySelector('.fluid_control_fullscreen').getAttribute('aria-pressed'),
      };
      player.toggleFullScreen();

      return {
        during,
        events,
        active: document.querySelector('.fluid_video_wrapper').classList.contains('fluid_fullscreen_fallback'),
        pressed: document.querySelector('.fluid_control_fullscreen').getAttribute('aria-pressed'),
      };
    });

    expect(state).toEqual({
      during: { active: true, controlsInside: true, pressed: 'true' },
      events: { enter: 1, exit: 1 },
      active: false,
      pressed: 'false',
    });
  } finally {
    await context.close();
  }
});

test('iOS fullscreen follows native video begin and end events', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  try {
    await page.goto('/');
    await page.setContent('<video id="player" width="320" height="180"></video>');
    await page.evaluate(() => {
      Object.defineProperties(HTMLVideoElement.prototype, {
        webkitEnterFullscreen: {
          configurable: true,
          value() {
            this.dispatchEvent(new Event('webkitbeginfullscreen'));
          },
        },
        webkitExitFullscreen: {
          configurable: true,
          value() {
            window.iosExitCalls = (window.iosExitCalls || 0) + 1;
            this.dispatchEvent(new Event('webkitendfullscreen'));
          },
        },
      });
    });
    await page.addScriptTag({ url: '/player.min.js' });

    const state = await page.evaluate(() => {
      const player = window.fluidPlayer('player', { layoutControls: { fullscreen: { iosNative: true } } });
      const events = { enter: 0, exit: 0 };
      player.on('enterfullscreen', () => events.enter++);
      player.on('exitfullscreen', () => events.exit++);
      player.toggleFullScreen();
      const entered = document.querySelector('.fluid_control_fullscreen').getAttribute('aria-pressed');
      player.toggleFullScreen();
      return {
        entered,
        exited: document.querySelector('.fluid_control_fullscreen').getAttribute('aria-pressed'),
        exitCalls: window.iosExitCalls,
        events,
      };
    });

    expect(state).toEqual({ entered: 'true', exited: 'false', exitCalls: 1, events: { enter: 1, exit: 1 } });
  } finally {
    await context.close();
  }
});
