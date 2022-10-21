const delay = (ms, callback) =>
  new Promise((resolve) => {
    setTimeout(() => {
      callback();
      resolve();
    }, ms);
  });

export default delay;
