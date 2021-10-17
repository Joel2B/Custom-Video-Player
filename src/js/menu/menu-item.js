export function createElement(data) {
    const elem = document.createElement(data.tag);

    for (const key in data) {
        const value = data[key];
        switch (key) {
            case 'tag':
                break;
            case 'style':
                for (const subKey in value) {
                    elem[key][subKey] = value[subKey];
                }
                break;
            case 'parent':
                data.parent.appendChild(elem);
                break;
            case 'childs':
                for (const child of value) {
                    elem.appendChild(createElement(child));
                }
                break;
            case 'dataset':
                elem[key][Object.keys(value)[0]] = Object.values(value)[0];
                break;
            default:
                elem[key] = value;
                break;
        }
    }
    return elem;
}

export function selector(item) {
    const id = item.id.toLowerCase();
    const menuItem = {
        tag: 'div',
        className: `cvp_selector cvp_${id}`,
        textContent: item.title,
        childs: [
            {
                tag: 'i',
                className: `cvp_icon cvp_icon_menu_${id}`,
            },
            {
                tag: 'div',
                className: 'cvp_value',
                textContent: item.value,
            },
        ],
    };
    return createElement(menuItem);
}

export function switcher(item) {
    const id = item.id.toLowerCase();
    const menuItem = {
        tag: 'div',
        className: `cvp_switch cvp_${id} ${item.enabled ? 'cvp_enabled' : ''}`,
        textContent: item.title,
        childs: [
            {
                tag: 'i',
                className: `cvp_icon cvp_icon_menu_${id}`,
            },
            {
                tag: 'span',
                textContent: 'Off ',
                childs: [
                    {
                        tag: 'div',
                        textContent: 'On',
                    },
                ],
            },
            {
                tag: 'div',
                className: 'cvp_icon',
            },
        ],
    };
    return createElement(menuItem);
}
