const loadPlayer = async (page, html) => {
  await page.goto('/');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: '/player.min.js' });
};

module.exports = { loadPlayer };
