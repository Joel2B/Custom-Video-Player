import { createElement } from '../utils/dom';

export function selector(item) {
    const id = item.id.toLowerCase();

    const element = createElement(
        'div',
        {
            class: `cvp_selector cvp_${id}`,
        },
        item.title,
    );

    element.appendChild(
        createElement('i', {
            class: `cvp_icon cvp_icon_menu_${id}`,
        }),
    );

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
    const id = item.id.toLowerCase();
    const element = createElement(
        'div',
        {
            class: `cvp_switch cvp_${id} ${item.enabled ? 'cvp_enabled' : ''}`,
        },
        item.title,
    );

    element.appendChild(createElement('i', {
        class: `cvp_icon cvp_icon_menu_${id}`,
    }));

    const span = createElement('span');
    span.appendChild(createElement());
    element.appendChild(span);

    return element;
}
