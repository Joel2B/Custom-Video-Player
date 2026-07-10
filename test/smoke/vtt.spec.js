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
