const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await loadPlayer(page, '<video id="player" width="640" height="360"></video>');
});

test('wheel zooms toward cursor, clamps limits, and middle click resets', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  const video = page.locator('video');
  const box = await video.boundingBox();

  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await page.mouse.wheel(0, -100);

  const zoomed = await page.evaluate(() => {
    const zoom = window.fluidPlayerDebug.at(-1).internals.zoom;
    return { scale: zoom.scale, x: zoom.x };
  });
  expect(zoomed.scale).toBeGreaterThan(1);
  expect(zoomed.x).toBeLessThan(0);
  await expect(page.locator('.fluid_zoom_indicator')).toHaveClass(/fluid_zoom_visible/);
  await expect(page.locator('.fluid_zoom_indicator > span')).toHaveText('110%');
  await expect(page.locator('.fluid_zoom_indicator')).toHaveAttribute('aria-label', 'Zoom 110%');

  for (let index = 0; index < 30; index++) {
    await page.mouse.wheel(0, -100);
  }
  expect(await page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.zoom.scale)).toBe(4);

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'middle' });
  expect(await page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.zoom.scale)).toBe(1);
  await expect(page.locator('.fluid_zoom_indicator')).not.toHaveClass(/fluid_zoom_visible/);
});

test('wheel works through play overlay and ignores controls', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  const play = page.locator('.fluid_initial_play');
  const playBox = await play.boundingBox();
  await page.mouse.move(playBox.x + playBox.width / 2, playBox.y + playBox.height / 2);
  await page.mouse.wheel(0, -100);
  expect(await page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.zoom.scale)).toBeCloseTo(1.1);

  const controls = page.locator('.fluid_controls_container');
  const controlsBox = await controls.boundingBox();
  await page.mouse.move(controlsBox.x + controlsBox.width / 2, controlsBox.y + controlsBox.height / 2);
  await page.mouse.wheel(0, -100);
  expect(await page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.zoom.scale)).toBeCloseTo(1.1);
});

test('grab cursor appears only while zoom is active', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  const video = page.locator('video');
  await expect(video).toHaveCSS('cursor', 'auto');

  await page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.zoom.setScale(1.25));
  await expect(video).toHaveCSS('cursor', 'grab');

  await page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.zoom.reset());
  await expect(video).toHaveCSS('cursor', 'auto');
});

test('zoom config normalizes invalid values and disabling restores reset', async ({ page }) => {
  const state = await page.evaluate(() => {
    window.fluidPlayer('player', {
      layoutControls: { zoom: { enabled: 'yes', min: -1, max: 0, reset: 99 } },
    });
    const zoom = window.fluidPlayerDebug.at(-1).internals;
    zoom.zoom.zoomTo(3, 320, 180);
    zoom.zoom.setEnabled(false);
    return {
      config: zoom.config.layoutControls.zoom,
      enabled: zoom.zoom.enabled,
      scale: zoom.zoom.scale,
      transform: zoom.media.style.transform,
    };
  });

  expect(state.config).toEqual({ enabled: true, min: 1, max: 4, reset: 4 });
  expect(state.enabled).toBe(false);
  expect(state.scale).toBe(4);
  expect(state.transform).toContain('scale(4)');
});

test('settings expose enabled, limits, and reset with dialog semantics', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  await page.locator('.fluid_button_main_menu').click();

  const zoom = page.locator('.cvp_zoom');
  await expect(zoom).toHaveAttribute('aria-haspopup', 'dialog');
  await zoom.click();
  await expect(page.locator('.cvp_zoom_menu')).toHaveAttribute('role', 'dialog');
  await expect(page.locator('.cvp_zoom_minimum output')).toHaveText('1.00x');
  await expect(page.locator('.cvp_zoom_maximum output')).toHaveText('4.00x');

  const enabled = page.locator('.cvp_zoom_enabled');
  await expect(enabled).toHaveAttribute('aria-checked', 'true');
  await enabled.click();
  await expect(enabled).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.zoom.enabled)).toBe(false);
});

test('menu edits current zoom and runtime limits in 0.25x steps', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  await page.locator('.fluid_button_main_menu').click();
  await page.locator('.cvp_zoom').click();

  await page.getByRole('button', { name: 'Increase zoom', exact: true }).click();
  await expect(page.locator('.cvp_zoom_level output')).toHaveText('125%');
  await page.getByRole('button', { name: 'Increase minimum zoom' }).click();
  await expect(page.locator('.cvp_zoom_minimum output')).toHaveText('1.25x');
  await page.getByRole('button', { name: 'Decrease maximum zoom' }).click();
  await expect(page.locator('.cvp_zoom_maximum output')).toHaveText('3.75x');

  const state = await page.evaluate(() => {
    const zoom = window.fluidPlayerDebug.at(-1).internals.zoom;
    return { scale: zoom.scale, min: zoom.config.min, max: zoom.config.max };
  });
  expect(state).toEqual({ scale: 1.25, min: 1.25, max: 3.75 });
});

test('desktop zoom menu keeps reset visible and rows compact', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  await page.locator('.fluid_button_main_menu').click();
  await page.locator('.cvp_zoom').click();
  await page.waitForTimeout(200);

  const geometry = await page.locator('.cvp_zoom_menu').evaluate((menu) => {
    const background = menu.closest('.cvp_background').getBoundingClientRect();
    const reset = menu.querySelector('.cvp_zoom_reset_button').getBoundingClientRect();
    const minimum = menu.querySelector('.cvp_zoom_minimum').getBoundingClientRect();
    const maximum = menu.querySelector('.cvp_zoom_maximum').getBoundingClientRect();
    const cells = [...menu.querySelector('.cvp_zoom_minimum .cvp_zoom_stepper_controls').children].map(
      (element) => element.getBoundingClientRect().height,
    );
    return {
      resetBottom: reset.bottom,
      backgroundBottom: background.bottom,
      rowGap: maximum.top - minimum.bottom,
      cells,
    };
  });

  expect(geometry.resetBottom).toBeLessThanOrEqual(geometry.backgroundBottom);
  expect(geometry.backgroundBottom - geometry.resetBottom).toBeGreaterThanOrEqual(4);
  expect(geometry.rowGap).toBe(2);
  expect(geometry.cells).toEqual([32, 32, 32]);
});

test('editable limits stay ordered within 1x to 8x and reset remains 1x', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  const state = await page.evaluate(() => {
    const zoom = window.fluidPlayerDebug.at(-1).internals.zoom;
    for (let index = 0; index < 40; index++) {
      zoom.setMinimum(zoom.config.min + 0.25);
      zoom.setMaximum(zoom.config.max + 0.25);
    }
    zoom.setScale(zoom.config.max);
    zoom.reset();
    return { scale: zoom.scale, min: zoom.config.min, max: zoom.config.max };
  });

  expect(state).toEqual({ scale: 1, min: 8, max: 8 });
  await expect(page.locator('.fluid_zoom_indicator')).not.toHaveClass(/fluid_zoom_visible/);
});

test('enabled and limits persist but zoom scale starts at reset', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const first = window.fluidPlayer('player');
    const internals = window.fluidPlayerDebug.at(-1).internals;
    internals.zoom.zoomTo(2, 320, 180);
    internals.zoom.setMinimum(1.5);
    internals.zoom.setMaximum(6);
    internals.zoom.setEnabled(false);
    await first.destroy();

    const video = document.createElement('video');
    video.id = 'second';
    video.width = 640;
    video.height = 360;
    document.body.appendChild(video);
    window.fluidPlayer('second');
    const second = window.fluidPlayerDebug.at(-1).internals.zoom;
    return { enabled: second.enabled, scale: second.scale, min: second.config.min, max: second.config.max };
  });

  expect(state).toEqual({ enabled: false, scale: 1, min: 1.5, max: 6 });
});

test('disabled zoom leaves wheel scrolling available and destroy removes listeners', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const player = window.fluidPlayer('player', { layoutControls: { zoom: { enabled: false } } });
    const internals = window.fluidPlayerDebug.at(-1).internals;
    const wheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
    internals.media.dispatchEvent(wheel);
    const before = { prevented: wheel.defaultPrevented, scale: internals.zoom.scale };
    await player.destroy();
    return { before, listeners: internals.eventListeners.length };
  });

  expect(state).toEqual({ before: { prevented: false, scale: 1 }, listeners: 0 });
});

test('Spanish locale translates zoom controls', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player', { locale: 'es' }));
  await page.locator('.fluid_button_main_menu').click();
  await page.locator('.cvp_zoom').click();
  await expect(page.locator('.cvp_zoom_menu')).toContainText('Nivel de zoom');
  await expect(page.locator('.cvp_zoom_minimum')).toContainText('Mínimo');
  await expect(page.locator('.cvp_zoom_maximum')).toContainText('Máximo');
  await expect(page.locator('.cvp_zoom_reset_button')).toHaveText('Restablecer zoom');
});

test('zoom panel controls fit a 200px mobile player', async ({ browser, baseURL }) => {
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
    await loadPlayer(mobilePage, '<video id="mobile" width="200" height="270"></video>');
    await mobilePage.evaluate(() => window.fluidPlayer('mobile'));
    await mobilePage.locator('.fluid_options_btn').dispatchEvent('touchend');
    const iconGeometry = await mobilePage.locator('.cvp_zoom .fluid_icon_zoom').evaluate((icon) => {
      const iconRect = icon.getBoundingClientRect();
      const circle = getComputedStyle(icon, '::before');
      return {
        width: iconRect.width,
        height: iconRect.height,
        circleLeft: Number.parseFloat(circle.left),
        circleWidth: Number.parseFloat(circle.width),
      };
    });
    expect(iconGeometry).toEqual({ width: 24, height: 24, circleLeft: 4, circleWidth: 14 });
    await mobilePage.locator('.cvp_zoom').click();
    const geometry = await mobilePage.locator('.cvp_zoom_menu').evaluate((menu) => {
      const menuRect = menu.getBoundingClientRect();
      return [...menu.querySelectorAll('button')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, menuLeft: menuRect.left, menuRight: menuRect.right };
      });
    });
    expect(geometry.every((item) => item.left >= item.menuLeft && item.right <= item.menuRight)).toBe(true);
    await expect(mobilePage.locator('.cvp_zoom_reset_button')).toHaveCSS('background-color', 'rgb(217, 39, 46)');
    const stepperHeights = await mobilePage.locator('.cvp_zoom_level').evaluate((row) =>
      [...row.querySelector('.cvp_zoom_stepper_controls').children].map(
        (element) => element.getBoundingClientRect().height,
      ),
    );
    expect(new Set(stepperHeights).size).toBe(1);
    const spacing = await mobilePage.locator('.cvp_zoom_menu').evaluate((menu) => {
      const menuRect = menu.getBoundingClientRect();
      const enabled = menu.querySelector('.cvp_zoom_enabled').getBoundingClientRect();
      const enabledLabel = menu.querySelector('.cvp_zoom_enabled .cvp_zoom_label').getBoundingClientRect();
      const level = menu.querySelector('.cvp_zoom_level').getBoundingClientRect();
      const controls = [...menu.querySelector('.cvp_zoom_stepper_controls').children].map((element) =>
        element.getBoundingClientRect(),
      );
      return {
        enabledTopGap: enabled.top - menuRect.top,
        enabledVisualTop: enabledLabel.top - menuRect.top,
        enabledVisualBottom: enabled.bottom - enabledLabel.bottom,
        separatorGap: level.top - enabled.bottom,
        cellGaps: [controls[1].left - controls[0].right, controls[2].left - controls[1].right],
      };
    });
    expect(spacing.enabledTopGap).toBe(0);
    expect(Math.abs(spacing.enabledVisualTop - spacing.enabledVisualBottom)).toBeLessThanOrEqual(1.1);
    expect(spacing.separatorGap).toBe(6);
    expect(spacing.cellGaps[0]).toBeCloseTo(3, 4);
    expect(spacing.cellGaps[1]).toBeCloseTo(3, 4);
  } finally {
    await context.close();
  }
});

test('pinch uses closest stable pointer pair and pan remains bounded', async ({ page }) => {
  await page.evaluate(() => window.fluidPlayer('player'));
  const state = await page.evaluate(() => {
    const zoom = window.fluidPlayerDebug.at(-1).internals.zoom;
    const down = (pointerId, x, y) => zoom.pointerDown({
      pointerId,
      pointerType: 'touch',
      button: 0,
      clientX: x,
      clientY: y,
    });
    down(1, 10, 10);
    down(2, 100, 10);
    down(3, 110, 10);
    const ids = [...zoom.pinch.ids];
    zoom.pointerMove({ pointerId: 3, clientX: 140, clientY: 10, preventDefault() {} });
    const stableIds = [...zoom.pinch.ids];
    zoom.x = 10000;
    zoom.y = -10000;
    zoom.clampPosition();
    return { ids, stableIds, scale: zoom.scale, x: zoom.x, y: zoom.y };
  });

  expect(state.ids).toEqual([2, 3]);
  expect(state.stableIds).toEqual([2, 3]);
  expect(state.scale).toBe(4);
  expect(state.x).toBe(960);
  expect(state.y).toBe(-540);
});

test('mobile tap jitter shows controls and pan suppresses only its trailing tap', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const mobilePage = await context.newPage();

  try {
    await loadPlayer(mobilePage, '<video id="mobile" width="640" height="360"></video>');
    await mobilePage.evaluate(() => {
      window.fluidPlayer('mobile');
      const player = window.fluidPlayerDebug.at(-1).internals;
      const zoom = player.zoom;
      const target = player.media;
      zoom.setScale(2);
      player.controlBar.toggleMobile(false);

      zoom.pointerDown({ pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 100, target });
      zoom.pointerMove({ pointerId: 1, clientX: 102, clientY: 101, preventDefault() {} });
      zoom.pointerUp({ pointerId: 1 });
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });
    await expect(mobilePage.locator('.fluid_video_wrapper')).toHaveClass(/fluid_show_controls/);

    const dragged = await mobilePage.evaluate(() => {
      const player = window.fluidPlayerDebug.at(-1).internals;
      const zoom = player.zoom;
      const target = player.media;
      player.controlBar.toggleMobile(false);

      zoom.pointerDown({ pointerId: 2, pointerType: 'touch', button: 0, clientX: 100, clientY: 100, target });
      zoom.pointerMove({ pointerId: 2, clientX: 120, clientY: 100, preventDefault() {} });
      zoom.pointerUp({ pointerId: 2 });
      const x = zoom.x;
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      const hiddenAfterDrag = player.wrapper.classList.contains('fluid_hide_controls');
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      return {
        x,
        hiddenAfterDrag,
        shownAfterNextTap: player.wrapper.classList.contains('fluid_show_controls'),
        scale: zoom.scale,
      };
    });

    expect(dragged.x).toBe(20);
    expect(dragged.hiddenAfterDrag).toBe(true);
    expect(dragged.shownAfterNextTap).toBe(true);
    expect(dragged.scale).toBe(2);
  } finally {
    await context.close();
  }
});

test('mobile shows zoom value only with visible controls and resets from menu', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const mobilePage = await context.newPage();

  try {
    await mobilePage.goto('/');
    await mobilePage.setContent('<video id="mobile" width="640" height="360"></video>');
    await mobilePage.addScriptTag({ url: '/player.min.js' });
    await mobilePage.evaluate(() => {
      window.fluidPlayer('mobile');
      window.fluidPlayerDebug.at(-1).internals.zoom.zoomTo(2, 320, 180);
    });
    await expect(mobilePage.locator('.fluid_zoom_reset')).toHaveCount(0);
    await mobilePage.evaluate(() => window.fluidPlayerDebug.at(-1).internals.controlBar.toggleMobile(true));
    await expect(mobilePage.locator('.fluid_zoom_indicator > span')).toHaveText('200%');
    await expect(mobilePage.locator('.fluid_zoom_indicator')).toHaveAttribute('aria-label', 'Zoom 200%');
    await expect(mobilePage.locator('.fluid_zoom_indicator')).toHaveCSS('opacity', '1');

    await mobilePage.evaluate(() => window.fluidPlayerDebug.at(-1).internals.controlBar.toggleMobile(false));
    await expect(mobilePage.locator('.fluid_zoom_indicator')).toHaveCSS('opacity', '0');
    await mobilePage.evaluate(() => window.fluidPlayerDebug.at(-1).internals.controlBar.toggleMobile(true));
    await expect(mobilePage.locator('.fluid_zoom_indicator')).toHaveCSS('opacity', '1');

    await mobilePage.locator('.fluid_options_btn').dispatchEvent('touchend');
    await mobilePage.locator('.cvp_zoom').click();
    await mobilePage.locator('.cvp_zoom_reset_button').click();
    await expect(mobilePage.locator('.fluid_zoom_indicator')).not.toHaveClass(/fluid_zoom_visible/);
    await expect(mobilePage.locator('.cvp_options_menu')).not.toHaveClass(/cvp_visible/);
    await expect(mobilePage.locator('.cvp_options_menu')).toHaveAttribute('aria-hidden', 'true');
    await expect(mobilePage.locator('.fluid_options_btn')).toHaveAttribute('aria-expanded', 'false');
    await expect(mobilePage.locator('.fluid_video_wrapper')).not.toHaveClass(/fluid_show_options/);
  } finally {
    await context.close();
  }
});
