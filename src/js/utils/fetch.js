// ==========================================================================
// Fetch wrapper
// Using XHR to avoid issues with older browsers
// ==========================================================================

export default function fetch(url, responseType = 'text', options = {}) {
  const {
    signal,
    timeout = 15000,
    onBeforeOpen = () => {},
    onBeforeSend = () => {},
  } = options;

  let abortRequest = () => {};
  const promise = new Promise((resolve, reject) => {
    try {
      const request = new XMLHttpRequest();
      let settled = false;

      const finish = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        signal?.removeEventListener('abort', abort);
        callback(value);
      };
      const abort = () => request.abort();
      abortRequest = abort;
      const abortError = () => {
        const error = new Error('XMLHttpRequest aborted');
        error.name = 'AbortError';
        return error;
      };

      // Check for CORS support
      if (!('withCredentials' in request)) {
        finish(reject, new Error('XMLHttpRequest CORS not supported'));
        return;
      }

      request.addEventListener('load', () => {
        if (request.status >= 400) {
          finish(reject, new Error(String(request.status)));
          return;
        }

        if (responseType === 'text') {
          finish(resolve, request.responseText);
        } else {
          finish(resolve, request.response);
        }
      });

      request.addEventListener('error', () => {
        finish(reject, new Error(String(request.status)));
      });
      request.addEventListener('timeout', () => {
        finish(reject, new Error('XMLHttpRequest timed out'));
      });
      request.addEventListener('abort', () => {
        finish(reject, abortError());
      });

      onBeforeOpen(request);
      request.open('GET', url, true);

      // Set the required response type
      request.responseType = responseType;
      const validTimeout = typeof timeout === 'number' && isFinite(timeout) && timeout >= 0;
      request.timeout = validTimeout ? timeout : 15000;

      onBeforeSend(request);

      if (signal?.aborted) {
        finish(reject, abortError());
        return;
      }
      signal?.addEventListener('abort', abort, { once: true });

      request.send();
    } catch (error) {
      signal?.removeEventListener('abort', abortRequest);
      abortRequest = () => {};
      reject(error);
    }
  });

  promise.abort = () => abortRequest();
  return promise;
}
