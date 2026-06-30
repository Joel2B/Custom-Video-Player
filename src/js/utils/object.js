import is from './is';

export function clone(input) {
  if (is.array(input)) {
    return input.map(clone);
  }

  if (is.object(input)) {
    return Object.keys(input).reduce((acc, key) => {
      acc[key] = clone(input[key]);
      return acc;
    }, {});
  }

  return input;
}
