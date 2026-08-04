import { createElement } from '../utils/dom';

export function selector(item) {
  const id = item.id;
  const element = createElement('div', {
    class: `cvp_selector cvp_${id}`,
    role: 'button',
    tabindex: 0,
    'aria-haspopup': item.popup || 'listbox',
    'aria-expanded': false,
    'aria-label': item.title,
  });

  element.appendChild(
    createElement('i', {
      class: `fluid_icon fluid_icon_${id}`,
    }),
  );

  element.appendChild(document.createTextNode(item.title));

  element.appendChild(
    createElement(
      'div',
      {
        class: 'cvp_value',
      },
      item.value,
    ),
  );

  return element;
}

export function switcher(item) {
  const id = item.id;
  const element = createElement('div', {
    class: `cvp_switch cvp_${id} ${item.enabled ? 'cvp_enabled' : ''}`,
    role: 'switch',
    tabindex: 0,
    'aria-checked': item.enabled,
    'aria-label': item.title,
  });

  element.appendChild(
    createElement('i', {
      class: `fluid_icon fluid_icon_${id}`,
    }),
  );

  element.appendChild(document.createTextNode(item.title));

  const span = createElement('span');

  if (item.instance.mobile) {
    span.appendChild(document.createTextNode(item.instance.config.captions.off));
    span.appendChild(createElement('div', null, item.instance.config.captions.on));
  } else {
    span.appendChild(createElement());
  }

  element.appendChild(span);

  return element;
}
