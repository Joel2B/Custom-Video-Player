// ==========================================================================
// Fetch wrapper
// Using XHR to avoid issues with older browsers
// ==========================================================================

export default function fetch(url, responseType = 'text', options = {}) {
  const {
    signal,
    timeout = 15000,
    maxBytes,
    allowedOrigins = [],
    onBeforeOpen = () => {},
    onBeforeSend = () => {},
  } = options;

  let abortRequest = () => {};
  const promise = new Promise((resolve, reject) => {
    try {
      const request = new XMLHttpRequest();
      let settled = false;
      const validMaxBytes = typeof maxBytes === 'number' && isFinite(maxBytes) && maxBytes >= 0 ? maxBytes : null;
      const target = new URL(url, document.baseURI);
      const currentOrigin = new URL(document.baseURI).origin;

      const callbackAllowed =
        target.origin === currentOrigin ||
        (Array.isArray(allowedOrigins) ? allowedOrigins : []).some((value) => {
          if (typeof value !== 'string' || value.includes('*')) {
            return false;
          }

          try {
            const allowed = new URL(value);

            return (
              allowed.protocol === 'https:' &&
              !allowed.username &&
              !allowed.password &&
              allowed.pathname === '/' &&
              !allowed.search &&
              !allowed.hash &&
              allowed.origin === target.origin
            );
          } catch (_) {
            return false;
          }
        });

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

      const responseTooLargeError = () => {
        const error = new Error(`XMLHttpRequest response exceeds ${validMaxBytes} bytes`);
        error.name = 'ResponseTooLargeError';
        return error;
      };

      const rejectTooLarge = () => {
        finish(reject, responseTooLargeError());
        request.abort();
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
          if (validMaxBytes !== null && new Blob([request.responseText]).size > validMaxBytes) {
            rejectTooLarge();
            return;
          }

          finish(resolve, request.responseText);
        } else {
          const size = request.response?.byteLength ?? request.response?.size;

          if (validMaxBytes !== null && typeof size === 'number' && size > validMaxBytes) {
            rejectTooLarge();
            return;
          }

          finish(resolve, request.response);
        }
      });

      request.addEventListener('progress', (event) => {
        if (
          validMaxBytes !== null &&
          (event.loaded > validMaxBytes || (event.lengthComputable && event.total > validMaxBytes))
        ) {
          rejectTooLarge();
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

      if (callbackAllowed) {
        onBeforeOpen(request, target);
      }

      request.open('GET', target.href, true);

      // Set the required response type
      request.responseType = responseType;
      const validTimeout = typeof timeout === 'number' && isFinite(timeout) && timeout >= 0;
      request.timeout = validTimeout ? timeout : 15000;

      if (callbackAllowed) {
        onBeforeSend(request, target);
      }

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
