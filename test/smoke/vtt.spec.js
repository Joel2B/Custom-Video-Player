const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

const initializePreview = async (page, file) => {
  await loadPlayer(page, '<video id="player" width="640" height="360"></video>');

  await page.evaluate((previewFile) => {
    window.fluidPlayer('player', {
      layoutControls: { timelinePreview: { file: previewFile, type: 'VTT' } },
    });
  }, file);
};

test('valid thumbnail VTT renders thumbnail preview', async ({ page }) => {
  await initializePreview(page, '/static/thumbnails.vtt');
  await expect(page.locator('.fluid_timeline_preview_thumbnails')).toHaveCount(1);
  await expect(page.locator('.fluid_timeline_preview_time')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.preview.current.request)).toBeNull();
});

for (const fixture of ['empty.vtt', 'malformed.vtt']) {
  test(`${fixture} falls back to time preview`, async ({ page }) => {
    await initializePreview(page, `/static/${fixture}`);
    await expect(page.locator('.fluid_timeline_preview_time')).toHaveCount(1);
    await expect(page.locator('.fluid_timeline_preview_thumbnails')).toHaveCount(0);
  });
}

test('missing thumbnail VTT falls back to time preview', async ({ page }) => {
  await page.route('**/missing.vtt', (route) => route.fulfill({ status: 404, body: '' }));
  await initializePreview(page, '/missing.vtt');
  await expect(page.locator('.fluid_timeline_preview_time')).toHaveCount(1);
});

test('thumbnail XHR runs configured hooks and aborts on destroy', async ({ page }) => {
  await page.route('**/slow-thumbnails.vtt', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ contentType: 'text/vtt', body: 'WEBVTT' });
  });

  await loadPlayer(page, '<video id="player" width="640" height="360"></video>');
  const hooks = await page.evaluate(async () => {
    window.xhrHooks = [];
    window.xhrAbortCalls = 0;
    const api = window.fluidPlayer('player', {
      xhrTimeout: 5000,
      onBeforeXMLHttpRequestOpen: (request) => {
        window.xhrHooks.push(['open', request.readyState]);
        const abort = request.abort.bind(request);
        request.abort = () => {
          window.xhrAbortCalls++;
          abort();
        };
      },
      onBeforeXMLHttpRequest: (request) => {
        window.xhrHooks.push(['send', request.timeout]);
      },
      layoutControls: { timelinePreview: { file: '/slow-thumbnails.vtt', type: 'VTT' } },
    });
    const player = window.fluidPlayerDebug.at(-1).internals;
    window.xhrErrors = 0;
    player.debug.error = () => window.xhrErrors++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await api.destroy();
    return { hooks: window.xhrHooks, aborts: window.xhrAbortCalls, errors: window.xhrErrors };
  });

  expect(hooks).toEqual({
    hooks: [
      ['open', 0],
      ['send', 5000],
    ],
    aborts: 1,
    errors: 0,
  });
});

test('destroy aborts pending subtitles without reporting an error', async ({ page }) => {
  await page.route('**/slow-subtitles.vtt', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ contentType: 'text/vtt', body: 'WEBVTT' });
  });

  await loadPlayer(
    page,
    `<video id="player" width="640" height="360">
      <track label="Slow" kind="subtitles" srclang="en" src="/slow-subtitles.vtt">
    </video>`,
  );

  const errors = await page.evaluate(async () => {
    const api = window.fluidPlayer('player', {
      layoutControls: {
        subtitles: { active: true, language: 'en' },
        menu: { subtitles: true },
      },
    });
    const player = window.fluidPlayerDebug.at(-1).internals;
    let errors = 0;
    player.debug.error = () => errors++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await api.destroy();
    await Promise.resolve();
    return errors;
  });

  expect(errors).toBe(0);
});

test('valid subtitles load cues and malformed subtitles stay empty', async ({ page }) => {
  await loadPlayer(
    page,
    `<video id="player" width="640" height="360">
      <track label="English" kind="subtitles" srclang="en" src="/static/subtitles/english.vtt">
    </video>`,
  );

  await page.evaluate(() =>
    window.fluidPlayer('player', {
      layoutControls: {
        subtitles: { active: true, language: 'en' },
        menu: { subtitles: true },
      },
    }),
  );

  await expect
    .poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.subtitles.tracks[0].cues.length))
    .toBeGreaterThan(0);

  await page.evaluate(() => window.fluidPlayerDebug.at(-1).instance.destroy());

  await loadPlayer(
    page,
    `<video id="broken" width="640" height="360">
      <track label="Broken" kind="subtitles" srclang="en" src="/static/malformed.vtt">
    </video>`,
  );

  await page.evaluate(() =>
    window.fluidPlayer('broken', {
      layoutControls: {
        subtitles: { active: true, language: 'en' },
        menu: { subtitles: true },
      },
    }),
  );

  await expect
    .poll(() => page.evaluate(() => window.fluidPlayerDebug.at(-1).internals.subtitles.tracks[0].cues.length))
    .toBe(0);
});
