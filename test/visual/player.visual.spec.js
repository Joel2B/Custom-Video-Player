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
