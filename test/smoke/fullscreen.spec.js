const { expect, test } = require('@playwright/test');
const { loadPlayer } = require('./helpers');

test('fallback fullscreen only changes selected player and restores page', async ({ page }) => {
  await loadPlayer(
    page,
    '<video id="first" width="320" height="180"></video><video id="second" width="320" height="180"></video>',
  );

  const state = await page.evaluate(async () => {
    document.body.style.setProperty('overflow', 'clip', 'important');
    const options = { layoutControls: { fullscreen: { fallback: 'force' } } };
    const first = window.fluidPlayer('first', options);
    window.fluidPlayer('second', options);
    const events = { firstEnter: 0, firstExit: 0, secondEnter: 0, secondExit: 0 };

    first.on('enterfullscreen', () => events.firstEnter++);
    first.on('exitfullscreen', () => events.firstExit++);
    window.fluidPlayerDebug.at(-1).instance.on('enterfullscreen', () => events.secondEnter++);
    window.fluidPlayerDebug.at(-1).instance.on('exitfullscreen', () => events.secondExit++);

    first.toggleFullScreen();
    const during = {
      first: document.getElementById('first').parentElement.classList.contains('fluid_fullscreen_fallback'),
      second: document.getElementById('second').parentElement.classList.contains('fluid_fullscreen_fallback'),
      overflow: document.body.style.overflow,
    };
    first.toggleFullScreen();

    return {
      during,
      events,
      overflow: document.body.style.getPropertyValue('overflow'),
      priority: document.body.style.getPropertyPriority('overflow'),
    };
  });

  expect(state).toEqual({
    during: { first: true, second: false, overflow: 'hidden' },
    events: { firstEnter: 1, firstExit: 1, secondEnter: 0, secondExit: 0 },
    overflow: 'clip',
    priority: 'important',
  });
});
