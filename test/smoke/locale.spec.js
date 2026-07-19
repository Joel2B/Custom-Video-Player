const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

const videos = `
  <video id="first" width="640" height="360"><source src="/video.avi" type="video/x-msvideo"></video>
  <video id="second" width="640" height="360"></video>
`;

test('English is the default locale', async ({ page }) => {
  await loadPlayer(page, videos);
  await page.evaluate(() => window.fluidPlayer('first'));

  await expect(page.locator('.fluid_video_wrapper')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.fluid_control_playpause')).toHaveAttribute('aria-label', 'Play');
  await expect(page.locator('.cvp_header').first()).toHaveText('Settings');
  await expect(page.locator('.fluid_video_error')).toHaveText('This video format is not supported.');
});

test('Spanish locale translates visible text, ARIA, errors, shortcuts, and formatters', async ({ page }) => {
  await loadPlayer(page, videos);
  await page.evaluate(() =>
    window.fluidPlayer('first', {
      locale: 'es',
      layoutControls: { allowDownload: true, controlForwardRewind: { show: true, forward: 1, rewind: 2 } },
    }),
  );

  await expect(page.locator('.fluid_video_wrapper')).toHaveAttribute('lang', 'es');
  await expect(page.locator('.fluid_control_playpause')).toHaveAttribute('aria-label', 'Reproducir');
  await expect(page.locator('.fluid_button_skip_back')).toHaveAttribute('aria-label', 'Retroceder 2 segundos');
  await expect(page.locator('.fluid_button_skip_forward')).toHaveAttribute('aria-label', 'Avanzar 1 segundo');
  await expect(page.locator('.fluid_button_download')).toHaveAttribute('aria-label', 'Descargar video');
  await expect(page.locator('.cvp_header').first()).toHaveText('Configuración');
  await expect(page.locator('.cvp_autoplay')).toContainText('Reproducción automática');
  await expect(page.locator('.cvp_loop')).toContainText('Repetir');
  await expect(page.locator('.cvp_playbackRate')).toContainText('Velocidad');
  await expect(page.locator('.fluid_video_error')).toHaveText('Este formato de video no es compatible.');
  await expect(page.locator('.cvp_shortcut_info')).toContainText('Reproducir / Pausar');
  await expect(page.locator('.cvp_shortcut_info')).toContainText('Alternar pantalla completa');

  expect(
    await page.evaluate(() => {
      const captions = window.fluidPlayerDebug.at(-1).internals.config.captions;
      return [captions.seconds(1), captions.seconds(2), captions.shortcuts.title, captions.shortcuts.playPause];
    }),
  ).toEqual(['1 segundo', '2 segundos', 'Atajos de teclado', 'Reproducir / Pausar']);
});

test('auto locale uses browser language and unsupported locales fall back to English', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['es-MX'] });
  });
  await loadPlayer(page, videos);

  await page.evaluate(() => {
    window.fluidPlayer('first', { locale: 'auto' });
    window.fluidPlayer('second', { locale: 'fr' });
  });

  const wrappers = page.locator('.fluid_video_wrapper');
  await expect(wrappers.nth(0)).toHaveAttribute('lang', 'es');
  await expect(wrappers.nth(0).locator('.fluid_control_playpause')).toHaveAttribute('aria-label', 'Reproducir');
  await expect(wrappers.nth(1)).toHaveAttribute('lang', 'en');
  await expect(wrappers.nth(1).locator('.fluid_control_playpause')).toHaveAttribute('aria-label', 'Play');
});

test('caption overrides win without changing other locale strings or instances', async ({ page }) => {
  await loadPlayer(page, videos);

  await page.evaluate(() => {
    window.fluidPlayer('first', { locale: 'es', captions: { play: 'Iniciar' } });
    window.fluidPlayer('second', { locale: 'en' });
  });

  const wrappers = page.locator('.fluid_video_wrapper');
  await expect(wrappers.nth(0).locator('.fluid_control_playpause')).toHaveAttribute('aria-label', 'Iniciar');
  await expect(wrappers.nth(0).locator('.fluid_control_mute')).toHaveAttribute('aria-label', 'Silenciar');
  await expect(wrappers.nth(1).locator('.fluid_control_playpause')).toHaveAttribute('aria-label', 'Play');
  await expect(wrappers.nth(1).locator('.fluid_control_mute')).toHaveAttribute('aria-label', 'Mute');
});
