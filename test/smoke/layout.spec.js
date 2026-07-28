const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

for (const width of [200, 260, 320, 640]) {
  test(`mobile menu stays inside ${width}px player`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 800, height: 600 },
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    });
    const page = await context.newPage();

    try {
      await page.goto('/');
      await page.setContent(`<video id="player" width="${width}" height="360"></video>`);
      await page.addScriptTag({ url: '/player.min.js' });
      await page.evaluate(() => window.fluidPlayer('player'));
      await page.locator('.fluid_options_btn').dispatchEvent('touchend');
      await expect(page.locator('.cvp_options_menu')).toHaveClass(/cvp_visible/);
      await expect(page.locator('.cvp_options_menu')).toHaveAttribute('aria-hidden', 'false');

      const geometry = await page.evaluate(() => {
        const wrapper = document.querySelector('.fluid_video_wrapper').getBoundingClientRect();
        const menu = document.querySelector('.cvp_options_menu').getBoundingClientRect();
        const content = getComputedStyle(document.querySelector('.cvp_options_menu .cvp_content'));
        return {
          wrapper: { left: wrapper.left, right: wrapper.right },
          menu: { left: menu.left, right: menu.right, width: menu.width },
          overflowX: content.overflowX,
        };
      });

      expect(geometry.menu.left).toBeGreaterThanOrEqual(geometry.wrapper.left - 0.5);
      expect(geometry.menu.right).toBeLessThanOrEqual(geometry.wrapper.right + 0.5);
      expect(geometry.menu.width).toBeCloseTo(Math.min(width, 260), 0);
      expect(geometry.overflowX).toBe('hidden');

      const hiddenSubmenu = await page.evaluate(() => {
        const menu = document.querySelector('.cvp_options_menu').getBoundingClientRect();
        const content = document.querySelector('.cvp_sub_page > .cvp_content').getBoundingClientRect();
        return { menuRight: menu.right, contentLeft: content.left };
      });
      expect(hiddenSubmenu.contentLeft - hiddenSubmenu.menuRight).toBeCloseTo(3, 0);

      await page.locator('.cvp_playbackRate').click();
      await expect(page.locator('.cvp_options_menu')).toHaveClass(/cvp_level2/);
      const submenuGeometry = () =>
        page.evaluate(() => {
          const menu = document.querySelector('.cvp_options_menu').getBoundingClientRect();
          const content = document.querySelector('.cvp_sub_page > .cvp_content').getBoundingClientRect();
          return {
            menu: { left: menu.left, right: menu.right },
            content: { left: content.left, right: content.right },
          };
        });
      await expect
        .poll(async () => {
          const { menu, content } = await submenuGeometry();
          return content.left >= menu.left - 0.5 && content.right <= menu.right + 3.5;
        })
        .toBe(true);
      const submenu = await submenuGeometry();
      expect(submenu.content.left).toBeGreaterThanOrEqual(submenu.menu.left - 0.5);
      expect(submenu.content.right).toBeLessThanOrEqual(submenu.menu.right + 3.5);

      await page.locator('.cvp_sub_page > .cvp_header').dispatchEvent('touchend');
      await expect(page.locator('.cvp_options_menu')).not.toHaveClass(/cvp_level2/);
    } finally {
      await context.close();
    }
  });
}

test('volume bar follows player width instead of viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await loadPlayer(
    page,
    '<video id="narrow" width="320" height="180"></video><video id="wide" width="640" height="360"></video>',
  );
  await page.evaluate(() => {
    window.fluidPlayer('narrow');
    window.fluidPlayer('wide');
  });

  const displays = () =>
    page.locator('.fluid_video_wrapper').evaluateAll((wrappers) =>
      wrappers.map((wrapper) => getComputedStyle(wrapper.querySelector('.fluid_control_volume_container')).display),
    );

  await expect.poll(displays).toEqual(['none', 'flex']);

  await page.evaluate(() => {
    const wrappers = document.querySelectorAll('.fluid_video_wrapper');
    wrappers[0].style.width = '640px';
    wrappers[1].style.width = '320px';
  });
  await expect.poll(displays).toEqual(['flex', 'none']);
});

test('volume bar falls back to window resize without ResizeObserver', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" width="320" height="180"></video>');
  await page.evaluate(() => {
    window.ResizeObserver = undefined;
  });
  await page.addScriptTag({ url: '/player.min.js' });
  await page.evaluate(() => window.fluidPlayer('player'));

  const volume = page.locator('.fluid_control_volume_container');
  await expect(volume).toHaveCSS('display', 'none');
  await page.evaluate(() => {
    document.querySelector('.fluid_video_wrapper').style.width = '640px';
    window.dispatchEvent(new Event('resize'));
  });
  await expect(volume).toHaveCSS('display', 'flex');
});

test('volume bar uses 375px desktop threshold and stays hidden on mobile', async ({ browser, baseURL, page }) => {
  await loadPlayer(
    page,
    '<video id="below" width="374" height="210"></video><video id="threshold" width="375" height="211"></video>',
  );
  await page.evaluate(() => {
    window.fluidPlayer('below');
    window.fluidPlayer('threshold');
  });
  await expect(page.locator('.fluid_control_volume_container').nth(0)).toHaveCSS('display', 'none');
  await expect(page.locator('.fluid_control_volume_container').nth(1)).toHaveCSS('display', 'flex');

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
    await mobilePage.setContent('<video id="player" width="640" height="360"></video>');
    await mobilePage.addScriptTag({ url: '/player.min.js' });
    await mobilePage.evaluate(() => window.fluidPlayer('player'));
    await expect(mobilePage.locator('.fluid_control_volume_container')).toHaveCount(0);
    await expect(mobilePage.locator('.fluid_video_wrapper')).not.toHaveClass(/fluid_volume_bar_available/);
  } finally {
    await context.close();
  }
});

test('volume observer disconnects on destroy', async ({ page }) => {
  await page.goto('/');
  await page.setContent('<video id="player" width="640" height="360"></video>');
  await page.evaluate(() => {
    window.resizeObserverCalls = { observe: 0, disconnect: 0 };
    window.ResizeObserver = class {
      observe() {
        window.resizeObserverCalls.observe++;
      }
      disconnect() {
        window.resizeObserverCalls.disconnect++;
      }
    };
  });
  await page.addScriptTag({ url: '/player.min.js' });
  const calls = await page.evaluate(async () => {
    const player = window.fluidPlayer('player');
    await player.destroy();
    return window.resizeObserverCalls;
  });
  expect(calls).toEqual({ observe: 1, disconnect: 1 });
});
