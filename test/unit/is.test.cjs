const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

async function loadIsUtils() {
  global.window = { URL };
  const sourceUrl = new URL('../../src/js/utils/is.js', pathToFileURL(__filename));
  const source = await readFile(sourceUrl, 'utf8');
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

test('isUrl accepts HTTP URLs and hostnames without rewriting HTTPS', async () => {
  const { isUrl } = await loadIsUtils();

  assert.equal(isUrl('http://example.com/video.mp4'), true);
  assert.equal(isUrl('https://example.com/video.mp4'), true);
  assert.equal(isUrl('example.com/video.mp4'), true);
  assert.equal(isUrl('not a url'), false);
});

test('isPromise accepts thenables without requiring the current Promise realm', async () => {
  const { isPromise } = await loadIsUtils();

  assert.equal(isPromise(Promise.resolve()), true);
  assert.equal(isPromise({ then() {} }), true);
  assert.equal(isPromise({}), false);
  assert.equal(isPromise(null), false);
});
