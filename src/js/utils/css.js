import is from './is';

export function removeTransition(element) {
  if (!is.element(element)) {
    return;
  }

  element.style.transition = 'none';
}
