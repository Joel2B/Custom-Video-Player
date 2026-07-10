const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

async function loadTimeUtils() {
  const sourceUrl = new URL('../../src/js/utils/time.js', pathToFileURL(__filename));
  const source = await readFile(sourceUrl, 'utf8');
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

test('convertTimeStringToSeconds validates and converts timestamps', async () => {
  const { convertTimeStringToSeconds } = await loadTimeUtils();

  assert.equal(convertTimeStringToSeconds('01:02:03.500'), 3723);
  assert.equal(convertTimeStringToSeconds('00:59:59'), 3599);
  assert.equal(convertTimeStringToSeconds('1:02:03'), false);
  assert.equal(convertTimeStringToSeconds('00:60:00'), false);
  assert.equal(convertTimeStringToSeconds(), false);
});

test('formatTime formats minutes, hours, and days', async () => {
  const { formatTime, pad } = await loadTimeUtils();

  assert.equal(formatTime(65.9), '01:05');
  assert.equal(formatTime(3661), '01:01:01');
  assert.equal(formatTime(90061), '01:01:01:01');
  assert.equal(pad(4), '04');
  assert.equal(pad(12), 12);
});
