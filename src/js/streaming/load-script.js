const loadingScripts = Object.create(null);

const loadScript = (url, timeout = 15000) => {
  if (loadingScripts[url]) {
    return loadingScripts[url];
  }

  loadingScripts[url] = new Promise((resolve, reject) => {
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      script.remove();
      delete loadingScripts[url];
      reject(new Error(`Timed out loading script: ${url}`));
    }, timeout);

    script.src = url;
    script.async = true;

    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };

    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      delete loadingScripts[url];
      reject(new Error(`Failed to load script: ${url}`));
    };

    document.head.appendChild(script);
  });

  return loadingScripts[url];
};

export default loadScript;
