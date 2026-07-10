// ==========================================================================
// Fetch wrapper
// Using XHR to avoid issues with older browsers
// ==========================================================================

export default function fetch(url, responseType = 'text') {
  return new Promise((resolve, reject) => {
    try {
      const request = new XMLHttpRequest();

      // Check for CORS support
      if (!('withCredentials' in request)) {
        reject(new Error('XMLHttpRequest CORS not supported'));
        return;
      }

      request.addEventListener('load', () => {
        if (request.status >= 400) {
          reject(new Error(String(request.status)));
          return;
        }

        if (responseType === 'text') {
          resolve(request.responseText);
        } else {
          resolve(request.response);
        }
      });

      request.addEventListener('error', () => {
        reject(new Error(String(request.status)));
      });

      request.open('GET', url, true);

      // Set the required response type
      request.responseType = responseType;

      request.send();
    } catch (error) {
      reject(error);
    }
  });
}
