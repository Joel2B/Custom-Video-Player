const { expect, test } = require('@playwright/test');

const setup = async (page, { width = 640, height = 360 } = {}) => {
  await page.goto('/');
  await page.setContent(`
    <style>
      html, body { margin: 0; padding: 20px; background: #161616; }
      video { display: block; width: ${width}px; height: ${height}px; }
      .cvp_options_menu, .cvp_options_menu * { transition: none !important; }
    </style>
    <video id="player" width="${width}" height="${height}"></video>
  `);
  await page.addScriptTag({ url: '/player.min.js' });
  await page.evaluate(() => {
    window.fluidPlayer('player', {
      layoutControls: {
        allowDownload: true,
        controlForwardRewind: { show: true, forward: 15, rewind: 7 },
        controlBar: { autoHide: false },
      },
    });
  });
};

test('paused player controls', async ({ page }) => {
  await setup(page);
  await expect(page.locator('.fluid_video_wrapper')).toHaveScreenshot('paused-controls.png');
});

test('settings menu', async ({ page }) => {
  await setup(page);
  await page.locator('.fluid_button_main_menu').click();
  await expect(page.locator('.cvp_options_menu')).toHaveClass(/cvp_visible/);
  await expect(page.locator('.fluid_video_wrapper')).toHaveScreenshot('settings-menu.png');
});

test('playback speed submenu', async ({ page }) => {
  await setup(page);
  await page.locator('.fluid_button_main_menu').click();
  await page.locator('.cvp_playbackRate').click();
  await expect(page.locator('.cvp_options_menu')).toHaveClass(/cvp_level2/);
  await expect(page.locator('.fluid_video_wrapper')).toHaveScreenshot('speed-submenu.png');
});

test('zoom submenu', async ({ page }) => {
  await setup(page);
  await page.locator('.fluid_button_main_menu').click();
  await page.locator('.cvp_zoom').click();
  await expect(page.locator('.cvp_options_menu')).toHaveClass(/cvp_level2/);
  await expect(page.locator('.fluid_video_wrapper')).toHaveScreenshot('zoom-submenu.png');
});

test('keyboard focus', async ({ page }) => {
  await setup(page);
  await page.locator('.fluid_control_playpause').focus();
  await expect(page.locator('.fluid_video_wrapper')).toHaveScreenshot('keyboard-focus.png');
});

test('play control hover', async ({ page }) => {
  await setup(page);
  await page.locator('.fluid_control_playpause').hover();
  await expect(page.locator('.fluid_video_wrapper')).toHaveScreenshot('play-hover.png');
});

test('compact controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { width: 350, height: 197 });
  await expect(page.locator('.fluid_video_wrapper')).toHaveScreenshot('compact-controls.png');
});

test('mobile menus fit supported player widths', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1500, height: 420 },
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto('/');
    await page.setContent(`
      <style>
        html, body { margin: 0; background: #161616; }
        .matrix { display: flex; gap: 12px; padding: 12px; width: 1468px; }
        video { display: block; height: 360px; }
        .cvp_options_menu, .cvp_options_menu * { transition: none !important; }
      </style>
      <div class="matrix">
        ${[200, 260, 320, 640]
          .map((width) => `<video id="player-${width}" width="${width}" height="360"></video>`)
          .join('')}
      </div>
    `);
    await page.addScriptTag({ url: '/player.min.js' });
    await page.evaluate(() => {
      [200, 260, 320, 640].forEach((width) => window.fluidPlayer(`player-${width}`));
    });
    for (const button of await page.locator('.fluid_options_btn').all()) {
      await button.dispatchEvent('touchend');
    }
    await expect(page.locator('.cvp_options_menu.cvp_visible')).toHaveCount(4);

    await expect(page.locator('.matrix')).toHaveScreenshot('mobile-menu-widths.png');
  } finally {
    await context.close();
  }
});

test('mobile zoom submenu fits supported player widths', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1500, height: 420 },
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto('/');
    await page.setContent(`
      <style>
        html, body { margin: 0; background: #161616; }
        .matrix { display: flex; gap: 12px; padding: 12px; width: 1468px; }
        video { display: block; height: 360px; }
        .cvp_options_menu, .cvp_options_menu * { transition: none !important; }
      </style>
      <div class="matrix">
        ${[200, 260, 320, 640]
          .map((width) => `<video id="zoom-${width}" width="${width}" height="360"></video>`)
          .join('')}
      </div>
    `);
    await page.addScriptTag({ url: '/player.min.js' });
    await page.evaluate(() => {
      [200, 260, 320, 640].forEach((width) => window.fluidPlayer(`zoom-${width}`));
    });
    for (const button of await page.locator('.fluid_options_btn').all()) {
      await button.dispatchEvent('touchend');
    }
    for (const zoom of await page.locator('.cvp_zoom').all()) {
      await zoom.click();
    }
    await expect(page.locator('.cvp_options_menu.cvp_level2')).toHaveCount(4);
    await expect(page.locator('.matrix')).toHaveScreenshot('mobile-zoom-menu-widths.png');
  } finally {
    await context.close();
  }
});
