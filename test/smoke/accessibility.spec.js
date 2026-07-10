const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

const setup = async (page) => {
  await loadPlayer(
    page,
    `<video id="player" width="640" height="360">
      <source src="https://example.test/video.mp4" type="video/mp4">
    </video>`,
  );
  await page.evaluate(() =>
    window.fluidPlayer('player', {
      layoutControls: {
        allowDownload: true,
        controlForwardRewind: { show: true, forward: 15, rewind: 7 },
      },
    }),
  );
};

test('primary controls expose native semantics and accessible names', async ({ page }) => {
  await setup(page);

  await expect(page.locator('button.fluid_control_playpause')).toHaveAttribute('aria-label', 'Play');
  await expect(page.locator('button.fluid_control_mute')).toHaveAttribute('aria-label', 'Mute');
  await expect(page.locator('button.fluid_button_skip_back')).toHaveAttribute('aria-label', 'Rewind 7 seconds');
  await expect(page.locator('button.fluid_button_skip_forward')).toHaveAttribute('aria-label', 'Forward 15 seconds');
  await expect(page.locator('button.fluid_control_theatre')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('button.fluid_control_fullscreen')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('button.fluid_button_download')).toHaveAttribute('aria-label', 'Download video');
  await expect(page.locator('button.fluid_button_main_menu')).toHaveAttribute('aria-expanded', 'false');
});

test('volume and seek sliders work from keyboard and update ARIA', async ({ page }) => {
  await setup(page);

  const volume = page.locator('[role="slider"][aria-label="Volume"]');
  await volume.focus();
  await page.keyboard.press('Home');
  await expect(volume).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('ArrowRight');
  await expect(volume).toHaveAttribute('aria-valuenow', '5');

  await page.evaluate(() => {
    const player = window.fluidPlayerDebug.at(-1).internals;
    Object.defineProperty(player.media, 'duration', { configurable: true, value: 100 });
    Object.defineProperty(player.media, 'currentTime', { configurable: true, writable: true, value: 40 });
    player.progressBar.update();
  });

  const seek = page.locator('[role="slider"][aria-label="Seek"]');
  await seek.focus();
  await page.keyboard.press('ArrowRight');
  await expect(seek).toHaveAttribute('aria-valuenow', '45');
  await page.keyboard.press('End');
  await expect(seek).toHaveAttribute('aria-valuenow', '100');
});

test('settings menu supports keyboard activation and option navigation', async ({ page }) => {
  await setup(page);

  const settings = page.locator('button.fluid_button_main_menu');
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.cvp_options_menu')).toHaveAttribute('aria-hidden', 'false');

  const speed = page.locator('.cvp_playbackRate');
  await speed.focus();
  await page.keyboard.press('Enter');
  await expect(speed).toHaveAttribute('aria-expanded', 'true');

  const firstOption = page.locator('.cvp_speed [role="option"]').first();
  await firstOption.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.cvp_speed [role="option"]').nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.cvp_speed [aria-selected="true"]')).toHaveCount(1);
});

test('focus is visible and reduced motion disables long transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);

  const play = page.locator('button.fluid_control_playpause');
  await play.focus();

  const styles = await play.evaluate((element) => {
    const computed = getComputedStyle(element);
    const icon = getComputedStyle(element, '::before');
    return {
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      transitionDuration: icon.transitionDuration,
    };
  });

  expect(styles.outlineStyle).toBe('solid');
  expect(parseFloat(styles.outlineWidth)).toBeGreaterThanOrEqual(2);
  expect(parseFloat(styles.transitionDuration)).toBeLessThanOrEqual(0.00001);
});

test('disabled context controls do not break state updates', async ({ page }) => {
  await loadPlayer(page, '<video id="player" width="640" height="360"></video>');
  await page.evaluate(() =>
    window.fluidPlayer('player', {
      layoutControls: {
        contextMenu: { controls: false },
        fullscreen: { fallback: 'force' },
      },
    }),
  );

  await page.locator('button.fluid_control_mute').click();
  await page.locator('button.fluid_control_fullscreen').click();
  await expect(page.locator('button.fluid_control_mute')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('button.fluid_control_fullscreen')).toHaveAttribute('aria-pressed', 'true');
});
