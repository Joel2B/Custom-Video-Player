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

  setRequestHeader(name, value) {
    this.headers = { ...this.headers, [name]: value };
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

  emit(type, event = {}) {
    this.listeners[type](event);
  }
}

async function loadFetch() {
  global.XMLHttpRequest = FakeXMLHttpRequest;
  global.document = { baseURI: 'https://app.example/player/' };
  const sourceUrl = new URL('../../src/js/utils/fetch.js', pathToFileURL(__filename));
  const source = await readFile(sourceUrl, 'utf8');
  return (await import(`data:text/javascript,${encodeURIComponent(source)}`)).default;
}

test('XHR callbacks run around open and configured timeout is applied', async () => {
  const fetch = await loadFetch();
  const calls = [];
  const result = fetch('/captions.vtt', 'text', {
    timeout: 2500,
    onBeforeOpen: (request, url) => calls.push(['beforeOpen', request.opened, url.href]),
    onBeforeSend: (request, url) => calls.push(['beforeSend', request.opened, url.href]),
  });
  const request = FakeXMLHttpRequest.last;
  request.status = 200;
  request.responseText = 'WEBVTT';
  request.emit('load');

  assert.equal(await result, 'WEBVTT');
  assert.deepEqual(calls, [
    ['beforeOpen', undefined, 'https://app.example/captions.vtt'],
    [
      'beforeSend',
      { method: 'GET', url: 'https://app.example/captions.vtt', async: true },
      'https://app.example/captions.vtt',
    ],
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

test('XHR rejects and aborts responses over maxBytes', async () => {
  const fetch = await loadFetch();

  const progressLimited = fetch('/large.vtt', 'text', { maxBytes: 5 });
  const progressRequest = FakeXMLHttpRequest.last;
  progressRequest.emit('progress', { loaded: 6, lengthComputable: false });
  await assert.rejects(progressLimited, {
    name: 'ResponseTooLargeError',
    message: 'XMLHttpRequest response exceeds 5 bytes',
  });
  assert.equal(progressRequest.abortCalls, 1);

  const totalLimited = fetch('/known-large.vtt', 'text', { maxBytes: 5 });
  const totalRequest = FakeXMLHttpRequest.last;
  totalRequest.emit('progress', { loaded: 1, lengthComputable: true, total: 6 });
  await assert.rejects(totalLimited, { name: 'ResponseTooLargeError' });
  assert.equal(totalRequest.abortCalls, 1);

  const finalLimited = fetch('/compressed-large.vtt', 'text', { maxBytes: 5 });
  const finalRequest = FakeXMLHttpRequest.last;
  finalRequest.status = 200;
  finalRequest.responseText = '123456';
  finalRequest.emit('load');
  await assert.rejects(finalLimited, { name: 'ResponseTooLargeError' });
  assert.equal(finalRequest.abortCalls, 1);
});

test('XHR callbacks require same origin or an explicit HTTPS origin', async () => {
  const fetch = await loadFetch();
  const callback = (request, url) => {
    request.setRequestHeader('Authorization', 'Bearer TEST_ONLY');
    request.callbackUrl = url.href;
  };

  const blocked = fetch('https://attacker.example/captions.vtt', 'text', { onBeforeSend: callback });
  const blockedRequest = FakeXMLHttpRequest.last;
  blockedRequest.status = 200;
  blockedRequest.responseText = 'WEBVTT';
  blockedRequest.emit('load');
  await blocked;
  assert.equal(blockedRequest.headers, undefined);
  assert.equal(blockedRequest.opened.url, 'https://attacker.example/captions.vtt');

  const allowed = fetch('https://media.example/captions.vtt', 'text', {
    allowedOrigins: ['https://media.example'],
    onBeforeSend: callback,
  });
  const allowedRequest = FakeXMLHttpRequest.last;
  allowedRequest.status = 200;
  allowedRequest.responseText = 'WEBVTT';
  allowedRequest.emit('load');
  await allowed;
  assert.deepEqual(allowedRequest.headers, { Authorization: 'Bearer TEST_ONLY' });
  assert.equal(allowedRequest.callbackUrl, 'https://media.example/captions.vtt');
});

test('XHR ignores invalid origins and exact-matches allowed origins', async () => {
  const fetch = await loadFetch();
  const invalidOrigins = [
    'http://media.example',
    'https://media.example/path',
    'https://user@media.example',
    'https://*.example',
    'not a URL',
  ];

  for (const target of ['https://media.example.evil.test/file.vtt', 'https://media.example/file.vtt']) {
    const result = fetch(target, 'text', {
      allowedOrigins: invalidOrigins,
      onBeforeSend: (request) => request.setRequestHeader('Authorization', 'Bearer TEST_ONLY'),
    });
    const request = FakeXMLHttpRequest.last;
    request.status = 200;
    request.responseText = 'WEBVTT';
    request.emit('load');
    await result;
    assert.equal(request.headers, undefined);
  }
});
