const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

const mockAudioContext = async (page) => {
  await page.addInitScript(() => {
    class AudioParamMock {
      constructor(value = 0) {
        this.value = value;
        this.calls = [];
      }

      cancelScheduledValues(time) {
        this.calls.push(['cancel', time]);
      }

      setTargetAtTime(value, time, constant) {
        this.value = value;
        this.calls.push(['target', value, time, constant]);
      }
    }

    class NodeMock {
      constructor() {
        this.connections = [];
      }

      connect(node) {
        this.connections.push(node);
        return node;
      }

      disconnect() {
        this.connections = [];
      }
    }

    class AudioContextMock {
      constructor() {
        this.currentTime = 2;
        this.state = 'running';
        this.destination = new NodeMock();
        window.audioContextMock = this;
      }

      createMediaElementSource(media) {
        this.media = media;
        this.source = new NodeMock();
        return this.source;
      }

      createGain() {
        this.gain = new NodeMock();
        this.gain.gain = new AudioParamMock(1);
        return this.gain;
      }

      createDynamicsCompressor() {
        this.limiter = new NodeMock();
        this.limiter.threshold = new AudioParamMock();
        this.limiter.knee = new AudioParamMock();
        this.limiter.ratio = new AudioParamMock();
        this.limiter.attack = new AudioParamMock();
        this.limiter.release = new AudioParamMock();
        return this.limiter;
      }

      async resume() {
        this.state = 'running';
      }

      async close() {
        this.state = 'closed';
      }
    }

    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock });
  });
};

test.beforeEach(async ({ page }) => {
  await mockAudioContext(page);
  await loadPlayer(
    page,
    '<video id="player" width="640" height="360"><source src="/test/static/sample.webm" type="video/webm"></video>',
  );
});

test('boost builds limited graph on demand and ramps gain', async ({ page }) => {
  const state = await page.evaluate(async () => {
    window.fluidPlayer('player');
    const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    const before = Boolean(boost.context);
    await boost.setLevel(2);
    return {
      before,
      enabled: boost.enabled,
      level: boost.level,
      mode: boost.mode,
      gain: boost.gain.gain.value,
      ramp: boost.gain.gain.calls.at(-1),
      sourceToGain: boost.source.connections[0] === boost.gain,
      gainToLimiter: boost.gain.connections[0] === boost.limiter,
      limiterToOutput: boost.limiter.connections[0] === boost.context.destination,
    };
  });

  expect(state).toEqual({
    before: false,
    enabled: true,
    level: 2,
    mode: 'limiter',
    gain: 2,
    ramp: ['target', 2, 2, 0.015],
    sourceToGain: true,
    gainToLimiter: true,
    limiterToOutput: true,
  });
  await expect(page.locator('.fluid_volume_boost_indicator')).toHaveClass(/fluid_volume_boost_visible/);
  await expect(page.locator('.fluid_volume_boost_indicator')).toHaveAttribute('aria-label', 'Volume boost 2.00x');
});

test('indicators share the top position and use feature colors', async ({ page }) => {
  await page.evaluate(async () => {
    window.fluidPlayer('player');
    await window.fluidPlayerDebug.at(-1).internals.volumeBoost.setLevel(2);
  });
  const boost = page.locator('.fluid_volume_boost_indicator');
  const zoom = page.locator('.fluid_zoom_indicator');
  await expect(boost).toHaveCSS('border-left-color', 'rgb(242, 177, 52)');
  await expect(zoom).toHaveCSS('border-left-color', 'rgb(217, 39, 46)');

  const initial = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    return {
      boost: player.volumeBoost.indicator.getBoundingClientRect().top,
      zoom: player.zoom.indicator.getBoundingClientRect().top,
    };
  });
  expect(initial.boost).toBeCloseTo(initial.zoom, 1);

  const active = await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    player.zoom.setScale(2);
    return {
      boost: player.volumeBoost.indicator.getBoundingClientRect().top,
      zoom: player.zoom.indicator.getBoundingClientRect().top,
    };
  });
  expect(active.boost - active.zoom).toBe(36);
});

test('menu changes level, maximum, mode, and reset', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  await page.locator('.fluid_button_main_menu').click();
  const item = page.locator('.cvp_volumeBoost');
  await expect(item).toHaveAttribute('aria-haspopup', 'dialog');
  await item.click();
  await expect(page.locator('.cvp_volume_boost_menu')).toHaveAttribute('role', 'dialog');

  await page.getByRole('button', { name: 'Increase volume boost' }).click();
  await expect(page.locator('.cvp_volume_boost_level output')).toHaveText('1.25x');
  await page.getByRole('button', { name: 'Increase maximum boost' }).click();
  await expect(page.locator('.cvp_volume_boost_maximum output')).toHaveText('3.25x');
  await page.getByRole('button', { name: 'Pure' }).click();
  await expect(page.getByRole('button', { name: 'Pure' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cvp_volume_boost_warning')).toBeVisible();
  await page.getByRole('button', { name: 'Reset volume boost' }).click();
  await expect(page.locator('.cvp_volume_boost_level output')).toHaveText('1.00x');

  const state = await page.evaluate(() => {
    const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    return {
      level: boost.level,
      max: boost.config.max,
      mode: boost.mode,
      pureOutput: boost.gain.connections[0] === boost.context.destination,
    };
  });
  expect(state).toEqual({ level: 1, max: 3.25, mode: 'pure', pureOutput: true });
});

test('mobile boost menu hugs content and grows for warning', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 400, height: 600 },
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const mobilePage = await context.newPage();
  try {
    await mockAudioContext(mobilePage);
    await loadPlayer(
      mobilePage,
      '<video id="mobile" width="320" height="360"><source src="/test/static/sample.webm" type="video/webm"></video>',
    );
    await mobilePage.evaluate(() => window.fluidPlayer('mobile'));
    await mobilePage.locator('.fluid_options_btn').dispatchEvent('touchend');
    await mobilePage.locator('.cvp_volumeBoost').click();
    await mobilePage.waitForTimeout(450);

    const geometry = async () =>
      mobilePage.locator('.cvp_volume_boost_menu').evaluate((menu) => {
        const background = menu.closest('.cvp_background').getBoundingClientRect();
        const reset = menu.querySelector('.cvp_volume_boost_reset_button').getBoundingClientRect();
        return {
          height: background.height,
          bottomGap: background.bottom - reset.bottom,
          scrollHeight: menu.closest('.cvp_content').scrollHeight,
          clientHeight: menu.closest('.cvp_content').clientHeight,
        };
      });

    const normal = await geometry();
    expect(normal.height).toBe(240);
    expect(normal.bottomGap).toBeGreaterThanOrEqual(8);
    expect(normal.bottomGap).toBeLessThanOrEqual(14);
    expect(normal.scrollHeight).toBeLessThanOrEqual(normal.clientHeight);

    await mobilePage.getByRole('button', { name: 'Pure' }).click();
    await mobilePage.waitForTimeout(450);
    const warning = await geometry();
    expect(warning.height).toBe(270);
    expect(warning.bottomGap).toBeGreaterThanOrEqual(3);
    expect(warning.bottomGap).toBeLessThanOrEqual(8);
  } finally {
    await context.close();
  }
});

test('configuration clamps to 1x through 8x and invalid mode falls back', async ({ page }) => {
  const state = await page.evaluate(() => {
    window.fluidPlayer('player', {
      layoutControls: { volumeBoost: { enabled: 'yes', min: -2, max: 20, reset: 40, mode: 'loud' } },
    });
    return window.fluidPlayerDebug.at(-1).internals.config.layoutControls.volumeBoost;
  });
  expect(state).toEqual({ enabled: false, min: 1, max: 8, reset: 8, mode: 'limiter' });
});

test('public API emits changes and persists level preference', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const first = window.fluidPlayer('player');
    const changes = [];
    first.on('volumeboostchange', (event) => changes.push(event.detail));
    await first.setVolumeBoost(2.5);
    first.setVolumeBoostMode('pure');
    const context = window.audioContextMock;
    await first.destroy();

    const video = document.createElement('video');
    video.id = 'second';
    video.width = 640;
    video.height = 360;
    document.body.appendChild(video);
    window.fluidPlayer('second');
    return {
      changes,
      nextLevel: window.fluidPlayerDebug.at(-1).internals.volumeBoost.level,
      closed: context.state,
    };
  });

  expect(state.changes.at(-1)).toEqual({ enabled: true, level: 2.5, mode: 'pure' });
  expect(state.nextLevel).toBe(2.5);
  expect(state.closed).toBe('closed');
});

test('all boost settings persist without creating a graph before interaction', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const first = window.fluidPlayer('player');
    const initial = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    initial.setMaximum(6);
    initial.setMode('pure');
    await initial.setLevel(4);
    await first.destroy();

    const video = document.createElement('video');
    video.id = 'persisted';
    video.width = 640;
    video.height = 360;
    video.innerHTML = '<source src="/test/static/sample.webm" type="video/webm">';
    document.body.appendChild(video);
    window.fluidPlayer('persisted');
    const restored = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    return {
      max: restored.config.max,
      mode: restored.mode,
      level: restored.level,
      enabled: restored.enabled,
      preferredEnabled: restored.preferredEnabled,
      context: Boolean(restored.context),
    };
  });

  expect(state).toEqual({
    max: 6,
    mode: 'pure',
    level: 4,
    enabled: false,
    preferredEnabled: true,
    context: false,
  });
});

test('persisted enabled boost activates on first player interaction', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const expiration = Date.now() / 1000 + 3600;
    localStorage.setItem(
      'cvp_volumeBoost',
      JSON.stringify({ value: { enabled: true, level: 3, max: 6, mode: 'limiter' }, expire: expiration }),
    );
    window.fluidPlayer('player');
    const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    const before = { enabled: boost.enabled, context: Boolean(boost.context), level: boost.level };
    boost.player.wrapper.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { before, enabled: boost.enabled, context: Boolean(boost.context), gain: boost.gain.gain.value };
  });

  expect(state).toEqual({
    before: { enabled: false, context: false, level: 3 },
    enabled: true,
    context: true,
    gain: 3,
  });
});

test('disable and reset persist their resulting state', async ({ page }) => {
  const state = await page.evaluate(async () => {
    window.fluidPlayer('player');
    const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    await boost.setLevel(3);
    await boost.setEnabled(false);
    boost.reset();
    return JSON.parse(localStorage.getItem('cvp_volumeBoost')).value;
  });

  expect(state).toEqual({ enabled: false, level: 1, max: 3, mode: 'limiter' });
});

test('stepper buttons disable at limits and long press repeats without trailing click', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player', { layoutControls: { volumeBoost: { max: 2 } } }));
  await page.locator('.fluid_button_main_menu').click();
  await page.locator('.cvp_volumeBoost').click();

  const decrease = page.getByRole('button', { name: 'Decrease volume boost' });
  const increase = page.getByRole('button', { name: 'Increase volume boost' });
  await expect(decrease).toBeDisabled();
  await expect(decrease).toHaveCSS('color', 'rgba(255, 255, 255, 0.3)');
  await expect(decrease).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.03)');
  await expect(decrease).toHaveCSS('border-color', 'rgba(255, 255, 255, 0.12)');
  await expect(decrease).toHaveCSS('cursor', 'default');
  await expect(increase).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(increase).toHaveCSS('cursor', 'pointer');

  await increase.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0 });
  await page.waitForTimeout(350);
  await increase.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0 });
  await increase.dispatchEvent('click');
  await expect(page.locator('.cvp_volume_boost_level output')).toHaveText('1.25x');

  await increase.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0 });
  await page.waitForTimeout(750);
  await increase.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch', button: 0 });
  await increase.dispatchEvent('click');
  await expect(page.locator('.cvp_volume_boost_level output')).toHaveText('2.00x');
  await expect(increase).toBeDisabled();
  await expect(decrease).toBeEnabled();

  const maximumPlus = page.getByRole('button', { name: 'Increase maximum boost' });
  await maximumPlus.dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'mouse', button: 0 });
  await page.waitForTimeout(1150);
  await maximumPlus.dispatchEvent('pointerup', { pointerId: 3, pointerType: 'mouse', button: 0 });
  await maximumPlus.dispatchEvent('click');
  await expect(page.locator('.cvp_volume_boost_maximum output')).toHaveText('4.00x');
});

test('invalid or disabled persistence uses configured boost values', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const expiration = Date.now() / 1000 + 3600;
    localStorage.setItem('cvp_volumeBoost', JSON.stringify({ value: { max: 'loud', mode: 'clip' }, expire: expiration }));

    const first = window.fluidPlayer('player', { layoutControls: { volumeBoost: { max: 4, mode: 'limiter' } } });
    const invalid = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    const invalidState = { max: invalid.config.max, mode: invalid.mode };
    await first.destroy();

    const video = document.createElement('video');
    video.id = 'disabled-persistence';
    video.width = 640;
    video.height = 360;
    document.body.appendChild(video);
    window.fluidPlayer('disabled-persistence', {
      layoutControls: {
        volumeBoost: { max: 5, mode: 'limiter' },
        persistentSettings: { volumeBoost: false },
      },
    });
    const disabled = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    return { invalid: invalidState, disabled: { max: disabled.config.max, mode: disabled.mode } };
  });

  expect(state).toEqual({ invalid: { max: 4, mode: 'limiter' }, disabled: { max: 5, mode: 'limiter' } });
});

test('remote source without anonymous CORS stays on native audio path', async ({ page }) => {
  const state = await page.evaluate(async () => {
    window.fluidPlayer('player', {
      layoutControls: { volumeBoost: { max: 8 } },
    }).src({ src: 'https://media.example/video.mp4', type: 'video/mp4' });
    const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    const changed = await boost.setLevel(8);
    return { changed, available: boost.available, enabled: boost.enabled, context: Boolean(boost.context) };
  });

  expect(state).toEqual({ changed: false, available: false, enabled: false, context: false });
  await expect(page.locator('.cvp_volumeBoost .cvp_value')).toHaveText('n/a');
});

test('CORS error exposes a details dialog and restores focus', async ({ page }) => {
  await page.evaluate(async () => {
    window.fluidPlayer('player').src({ src: 'https://media.example/video.mp4', type: 'video/mp4' });
    await window.fluidPlayerDebug.at(-1).internals.volumeBoost.setLevel(2);
  });
  await page.locator('.fluid_button_main_menu').click();
  await page.locator('.cvp_volumeBoost').click();

  const error = page.getByRole('button', { name: 'View volume boost error' });
  await expect(error).toContainText('Error');
  await expect(error.locator('.cvp_volume_boost_error_icon')).toHaveText('↗');
  await expect(page.locator('.cvp_volume_boost_enabled')).toBeHidden();
  await error.click();

  const dialog = page.getByRole('dialog', { name: 'Volume boost unavailable' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('This source does not allow cross-origin audio processing.');
  await expect(dialog).toContainText('crossorigin="anonymous"');
  await expect(dialog.locator('code')).toHaveText('Cross-origin media source is missing anonymous CORS.');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(page.locator('.cvp_options_menu')).toHaveAttribute('inert', '');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(error).toBeFocused();
  await expect(page.locator('.cvp_options_menu')).not.toHaveAttribute('inert', '');
});

test('technical browser errors render as text', async ({ page }) => {
  await page.evaluate(async () => {
    window.fluidPlayer('player');
    const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    boost.ensureGraph = async () =>
      boost.fail('graph', {
        name: 'NotSupportedError',
        message: '<img src=x onerror=window.errorInjected=true>',
      });
    await boost.setLevel(2);
    boost.openError();
  });

  const code = page.locator('.cvp_volume_boost_error_technical code');
  await expect(code).toHaveText('NotSupportedError: <img src=x onerror=window.errorInjected=true>');
  expect(await code.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => window.errorInjected)).toBeUndefined();
});

test('remote anonymous CORS source can activate boost', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const media = document.getElementById('player');
    media.crossOrigin = 'anonymous';
    const player = window.fluidPlayer('player');
    player.src({ src: 'https://media.example/video.mp4', type: 'video/mp4' });
    const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    const changed = await boost.setLevel(2);
    return { changed, available: boost.available, enabled: boost.enabled, level: boost.level };
  });

  expect(state).toEqual({ changed: true, available: true, enabled: true, level: 2 });
});

test('error dialog fits a 200px mobile player', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 400, height: 600 },
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const mobilePage = await context.newPage();
  try {
    await mockAudioContext(mobilePage);
    await loadPlayer(
      mobilePage,
      '<video id="mobile" width="200" height="270"><source src="/test/static/sample.webm" type="video/webm"></video>',
    );
    const geometry = await mobilePage.evaluate(() => {
      window.fluidPlayer('mobile');
      const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
      boost.fail('cors');
      boost.openError();
      const wrapper = boost.player.wrapper.getBoundingClientRect();
      const card = boost.errorCard.getBoundingClientRect();
      return { wrapper, card };
    });
    expect(geometry.card.left).toBeGreaterThanOrEqual(geometry.wrapper.left);
    expect(geometry.card.right).toBeLessThanOrEqual(geometry.wrapper.right);
    expect(geometry.card.top).toBeGreaterThanOrEqual(geometry.wrapper.top);
    expect(geometry.card.bottom).toBeLessThanOrEqual(geometry.wrapper.bottom);
  } finally {
    await context.close();
  }
});

test('boost waits for a source before creating an audio graph', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const media = document.createElement('video');
    media.id = 'empty';
    media.width = 640;
    media.height = 360;
    document.body.appendChild(media);
    window.fluidPlayer('empty');
    const boost = window.fluidPlayerDebug.at(-1).internals.volumeBoost;
    const changed = await boost.setLevel(2);
    return { changed, available: boost.available, enabled: boost.enabled, context: Boolean(boost.context) };
  });

  expect(state).toEqual({ changed: false, available: true, enabled: false, context: false });
});

test('Spanish locale translates boost controls', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player', { locale: 'es' }));
  await page.locator('.fluid_button_main_menu').click();
  await page.locator('.cvp_volumeBoost').click();
  await expect(page.locator('.cvp_volume_boost_menu')).toContainText('Nivel de boost');
  await expect(page.locator('.cvp_volume_boost_mode')).toContainText('Procesamiento');
  await expect(page.locator('.cvp_volume_boost_reset_button')).toHaveText('Restablecer boost de volumen');
});
