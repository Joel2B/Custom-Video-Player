import { createElement } from '../utils/dom';

export function selector(item) {
    const id = item.id;
    const element = createElement(
        'div',
        {
            class: `cvp_selector cvp_${id}`,
        },
    );

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
    const element = createElement(
        'div',
        {
            class: `cvp_switch cvp_${id} ${item.enabled ? 'cvp_enabled' : ''}`,
        },
    );

    element.appendChild(createElement('i', {
        class: `fluid_icon fluid_icon_${id}`,
    }));

    element.appendChild(document.createTextNode(item.title));

    const span = createElement('span');

    if (item.instance.mobile) {
        span.appendChild(document.createTextNode('Off'));
        span.appendChild(createElement('div', null, 'On'));
    } else {
        span.appendChild(createElement());
    }

    element.appendChild(span);

    return element;
}
