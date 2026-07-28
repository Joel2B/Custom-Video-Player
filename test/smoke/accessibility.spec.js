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

test('closed settings menu is inert and Escape restores button focus', async ({ page }) => {
  await setup(page);

  const settings = page.locator('button.fluid_button_main_menu');
  const menu = page.locator('.cvp_options_menu');
  await expect(menu).toHaveAttribute('inert', '');
  expect(await menu.locator('[tabindex="0"]').count()).toBe(0);

  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(menu).not.toHaveAttribute('inert', '');
  await expect(page.locator('.cvp_switches [tabindex="0"]').first()).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-hidden', 'true');
  await expect(menu).toHaveAttribute('inert', '');
  await expect(settings).toBeFocused();
});

test('global shortcuts ignore editable controls', async ({ page }) => {
  await loadPlayer(
    page,
    `<div id="host">
      <input id="input">
      <textarea id="textarea"></textarea>
      <select id="select"><option>One</option><option>Two</option></select>
      <div id="editable" contenteditable="true"></div>
      <video id="player" width="640" height="360"></video>
    </div>`,
  );
  await page.evaluate(() => {
    window.fluidPlayer('player');
    document.querySelector('.fluid_video_wrapper').append(
      document.getElementById('input'),
      document.getElementById('textarea'),
      document.getElementById('select'),
      document.getElementById('editable'),
    );
  });

  await page.locator('#input').fill('k');
  await page.locator('#textarea').fill('m');
  await page.locator('#select').focus();
  await page.keyboard.press('ArrowDown');
  await page.locator('#editable').focus();
  await page.keyboard.type('f t');

  expect(await page.locator('#input').inputValue()).toBe('k');
  expect(await page.locator('#textarea').inputValue()).toBe('m');
  expect(await page.locator('#select').inputValue()).toBe('Two');
  await expect(page.locator('#editable')).toHaveText('f t');
  await expect(page.locator('.fluid_video_wrapper')).not.toHaveClass(/fluid_theatre_mode/);
});

test('keyboard shortcuts dialog traps focus and restores its invoker', async ({ page }) => {
  await setup(page);
  const wrapper = page.locator('.fluid_video_wrapper');
  const play = page.locator('button.fluid_control_playpause');
  await play.focus();
  const box = await wrapper.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });

  const menuItems = page.locator('.fluid_context_menu [role="menuitem"]');
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(menuItems.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(menuItems.nth(2)).toHaveText('Keyboard Shortcuts');
  await expect(menuItems.nth(2)).toBeFocused();
  await menuItems.nth(2).click();

  const dialog = page.locator('[role="dialog"][aria-label="Keyboard Shortcuts"]');
  const close = dialog.locator('button.cvp_hide_shortcuts');
  await expect(dialog).toHaveAttribute('aria-hidden', 'false');
  await expect(close).toBeFocused();
  await expect(page.locator('.fluid_controls_container')).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('aria-hidden', 'true');
  await expect(play).toBeFocused();
  await expect(page.locator('.fluid_controls_container')).not.toHaveAttribute('inert', '');
});

test('clickable logo is a named safe external link', async ({ page }) => {
  await loadPlayer(page, '<video id="player" width="640" height="360"></video>');
  await page.evaluate(() =>
    window.fluidPlayer('player', {
      layoutControls: {
        logo: {
          imageUrl: '/static/logo.png',
          clickUrl: 'https://example.test/logo',
          alt: 'Example publisher',
        },
      },
    }),
  );

  const link = page.getByRole('link', { name: 'Example publisher' });
  await expect(link).toHaveAttribute('href', 'https://example.test/logo');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await link.focus();
  await expect(link).toBeFocused();
  const box = await link.boundingBox();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
});

test('clickable logo gets a default localized name', async ({ page }) => {
  await loadPlayer(page, '<video id="player" width="640" height="360"></video>');
  await page.evaluate(() =>
    window.fluidPlayer('player', {
      locale: 'es',
      layoutControls: { logo: { imageUrl: '/static/logo.png', clickUrl: 'https://example.test/logo' } },
    }),
  );

  await expect(page.getByRole('link', { name: 'Logotipo' })).toBeVisible();
});

test('context menu stays inside player and supports Escape', async ({ page }) => {
  await setup(page);
  const wrapper = page.locator('.fluid_video_wrapper');
  const play = page.locator('button.fluid_control_playpause');
  await play.focus();
  const box = await wrapper.boundingBox();
  await page.mouse.click(box.x + box.width - 1, box.y + box.height - 1, { button: 'right' });

  const context = page.locator('.fluid_context_menu');
  await expect(context).toBeVisible();
  const geometry = await page.evaluate(() => {
    const wrapperRect = document.querySelector('.fluid_video_wrapper').getBoundingClientRect();
    const menuRect = document.querySelector('.fluid_context_menu').getBoundingClientRect();
    return {
      left: menuRect.left >= wrapperRect.left,
      top: menuRect.top >= wrapperRect.top,
      right: menuRect.right <= wrapperRect.right + 0.5,
      bottom: menuRect.bottom <= wrapperRect.bottom + 0.5,
    };
  });
  expect(geometry).toEqual({ left: true, top: true, right: true, bottom: true });

  await page.keyboard.press('Escape');
  await expect(context).toBeHidden();
  await expect(play).toBeFocused();
});

test('context menu activation restores focus', async ({ page }) => {
  await setup(page);
  const wrapper = page.locator('.fluid_video_wrapper');
  const play = page.locator('button.fluid_control_playpause');
  await play.focus();
  const box = await wrapper.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });

  const firstItem = page.locator('.fluid_context_menu [role="menuitem"]').first();
  await expect(firstItem).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.fluid_context_menu')).toBeHidden();
  await expect(play).toBeFocused();
});

test('mobile settings and fullscreen icons stay centered', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto('http://127.0.0.1:8080/');
    await page.setContent('<video id="player" width="320" height="180"></video>');
    await page.addScriptTag({ url: 'http://127.0.0.1:8080/player.min.js' });
    await page.evaluate(() => window.fluidPlayer('player'));

    const geometry = await page.evaluate(() => {
      const settings = document.querySelector('.fluid_options_btn').getBoundingClientRect();
      const settingsIcon = document.querySelector('.fluid_mobile_main_menu').getBoundingClientRect();
      const settingsGlyph = getComputedStyle(document.querySelector('.fluid_mobile_main_menu'), '::before');
      const fullscreen = document.querySelector('.fluid_control_fullscreen').getBoundingClientRect();
      const fullscreenGlyph = getComputedStyle(document.querySelector('.fluid_control_fullscreen'), '::before');

      return {
        wrapperMobile: document.querySelector('.fluid_video_wrapper').classList.contains('fluid_mobile'),
        settings: { width: settings.width, height: settings.height },
        settingsIcon: {
          width: settingsIcon.width,
          height: settingsIcon.height,
          centeredX: settingsIcon.left + settingsIcon.width / 2 === settings.left + settings.width / 2,
          centeredY: settingsIcon.top + settingsIcon.height / 2 === settings.top + settings.height / 2,
          glyphTop: settingsGlyph.top,
          glyphLeft: settingsGlyph.left,
        },
        fullscreen: { width: fullscreen.width, height: fullscreen.height },
        fullscreenGlyph: {
          width: fullscreenGlyph.width,
          height: fullscreenGlyph.height,
          top: fullscreenGlyph.top,
          left: fullscreenGlyph.left,
          transform: fullscreenGlyph.transform,
        },
      };
    });

    expect(geometry).toEqual({
      wrapperMobile: true,
      settings: { width: 44, height: 44 },
      settingsIcon: {
        width: 24,
        height: 24,
        centeredX: true,
        centeredY: true,
        glyphTop: '0px',
        glyphLeft: '0px',
      },
      fullscreen: { width: 44, height: 44 },
      fullscreenGlyph: {
        width: '24px',
        height: '24px',
        top: '22px',
        left: '22px',
        transform: 'matrix(1, 0, 0, 1, -12, -12)',
      },
    });
  } finally {
    await context.close();
  }
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

for (const viewportWidth of [1920, 1280, 768]) {
  test(`published HLS layout stays aligned at ${viewportWidth}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await loadPlayer(
      page,
      `<style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; padding: 24px; box-sizing: border-box; }
        #player { width: clamp(320px, 50vw, 960px); max-width: 90vw; height: auto; aspect-ratio: 16 / 9; }
      </style>
      <video id="player">
        <source src="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" type="application/x-mpegURL">
      </video>`,
    );
    await page.evaluate(() =>
      window.fluidPlayer('player', {
        hls: { url: '/static/mock-hls-quality.js', overrideNative: true },
      }),
    );
    await expect(page.locator('.fluid_button_main_menu')).toHaveClass(/hd-quality-badge/);

    const geometry = await page.locator('.fluid_controls_left > *, .fluid_controls_right > *').evaluateAll((controls) =>
      controls
        .filter((control) => getComputedStyle(control).display !== 'none')
        .map((control) => {
          const rect = control.getBoundingClientRect();
          return { top: rect.top, height: rect.height, center: rect.top + rect.height / 2 };
        }),
    );

    expect(new Set(geometry.map(({ top }) => top)).size).toBe(1);
    expect(new Set(geometry.map(({ height }) => height))).toEqual(new Set([24]));
    expect(new Set(geometry.map(({ center }) => center)).size).toBe(1);

    const iconGeometry = await page.locator('.fluid_controls .fluid_button').evaluateAll((buttons) =>
      buttons
        .filter((button) => getComputedStyle(button).display !== 'none')
        .map((button) => {
          const icon = getComputedStyle(button, '::before');
          return { top: icon.top, left: icon.left, width: icon.width, height: icon.height };
        }),
    );

    expect(iconGeometry).toEqual(
      iconGeometry.map(() => ({ top: '0px', left: '0px', width: '24px', height: '24px' })),
    );

    const badge = await page.locator('.fluid_button_main_menu').evaluate((button) => {
      const style = getComputedStyle(button, '::after');
      return { top: style.top, right: style.right, width: style.width, height: style.height };
    });
    expect(badge).toEqual({ top: '0px', right: '-6px', width: '13px', height: '9px' });
  });
}
