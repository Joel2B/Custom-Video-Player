const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

class FakeXMLHttpRequest {
  constructor() {
    this.listeners = {};
    this.withCredentials = false;
    FakeXMLHttpRequest.last = this;
  }

  addEventListener(type, callback) {
    this.listeners[type] = callback;
  }

  open(method, url, async) {
    this.opened = { method, url, async };
  }

  send() {
    if (FakeXMLHttpRequest.sendError) {
      throw FakeXMLHttpRequest.sendError;
    }
    this.sent = true;
  }

  abort() {
    this.abortCalls = (this.abortCalls || 0) + 1;
    this.listeners.abort();
  }

  emit(type) {
    this.listeners[type]();
  }
}

async function loadFetch() {
  global.XMLHttpRequest = FakeXMLHttpRequest;
  const sourceUrl = new URL('../../src/js/utils/fetch.js', pathToFileURL(__filename));
  const source = await readFile(sourceUrl, 'utf8');
  return (await import(`data:text/javascript,${encodeURIComponent(source)}`)).default;
}

test('XHR callbacks run around open and configured timeout is applied', async () => {
  const fetch = await loadFetch();
  const calls = [];
  const result = fetch('/captions.vtt', 'text', {
    timeout: 2500,
    onBeforeOpen: (request) => calls.push(['beforeOpen', request.opened]),
    onBeforeSend: (request) => calls.push(['beforeSend', request.opened]),
  });
  const request = FakeXMLHttpRequest.last;
  request.status = 200;
  request.responseText = 'WEBVTT';
  request.emit('load');

  assert.equal(await result, 'WEBVTT');
  assert.deepEqual(calls, [
    ['beforeOpen', undefined],
    ['beforeSend', { method: 'GET', url: '/captions.vtt', async: true }],
  ]);
  assert.equal(request.timeout, 2500);
  assert.equal(request.sent, true);
});

test('XHR timeout and AbortSignal reject with stable errors', async () => {
  const fetch = await loadFetch();
  const timedOut = fetch('/slow.vtt');
  FakeXMLHttpRequest.last.emit('timeout');
  await assert.rejects(timedOut, { message: 'XMLHttpRequest timed out' });

  const controller = new AbortController();
  const aborted = fetch('/abort.vtt', 'text', { signal: controller.signal });
  controller.abort();
  await assert.rejects(aborted, { name: 'AbortError', message: 'XMLHttpRequest aborted' });

  const directAbort = fetch('/direct-abort.vtt');
  directAbort.abort();
  await assert.rejects(directAbort, { name: 'AbortError', message: 'XMLHttpRequest aborted' });

  const preAbortedController = new AbortController();
  preAbortedController.abort();
  const preAborted = fetch('/pre-aborted.vtt', 'text', { signal: preAbortedController.signal });
  await assert.rejects(preAborted, { name: 'AbortError', message: 'XMLHttpRequest aborted' });
  assert.equal(FakeXMLHttpRequest.last.sent, undefined);
});

test('XHR timeout accepts zero and normalizes unsupported values', async () => {
  const fetch = await loadFetch();

  for (const [value, expected] of [
    [0, 0],
    [-1, 15000],
    [NaN, 15000],
    ['5000', 15000],
  ]) {
    const result = fetch('/timeout.vtt', 'text', { timeout: value });
    const request = FakeXMLHttpRequest.last;
    assert.equal(request.timeout, expected);
    request.abort();
    await assert.rejects(result, { name: 'AbortError' });
  }
});

test('XHR timeout works without Number.isFinite and send failures remove abort listeners', async () => {
  const fetch = await loadFetch();
  const numberIsFinite = Number.isFinite;
  Number.isFinite = undefined;

  try {
    const result = fetch('/ie11.vtt', 'text', { timeout: 2500 });
    const request = FakeXMLHttpRequest.last;
    assert.equal(request.timeout, 2500);
    request.abort();
    await assert.rejects(result, { name: 'AbortError' });
  } finally {
    Number.isFinite = numberIsFinite;
  }

  const controller = new AbortController();
  FakeXMLHttpRequest.sendError = new Error('send failed');
  const failed = fetch('/send-failure.vtt', 'text', { signal: controller.signal });
  const request = FakeXMLHttpRequest.last;
  FakeXMLHttpRequest.sendError = null;

  await assert.rejects(failed, { message: 'send failed' });
  controller.abort();
  assert.equal(request.abortCalls || 0, 0);
});
