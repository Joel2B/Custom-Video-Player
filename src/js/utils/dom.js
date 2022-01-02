import is from './is';

// Set attributes
export function setAttributes(element, attributes) {
    if (!is.element(element) || is.empty(attributes)) {
        return;
    }

    // Assume null and undefined attributes should be left out,
    // Setting them would otherwise convert them to "null" and "undefined"
    Object.entries(attributes)
        .filter(([, value]) => !is.nullOrUndefined(value))
        .forEach(([key, value]) => element.setAttribute(key, value));
}

export function createElement(type = 'div', attributes, text) {
    // Create a new <element>
    const element = document.createElement(type);

    // Set all passed attributes
    if (is.object(attributes)) {
        setAttributes(element, attributes);
    }

    // Add text node
    if (is.string(text)) {
        element.innerText = text;
    }

    // Return built element
    return element;
}

export function createElementNS(type, attributes, text) {
    // Create a new <element>
    const namespace = 'http://www.w3.org/2000/svg';
    const element = document.createElementNS(namespace, type);

    // Set all passed attributes
    if (is.object(attributes)) {
        setAttributes(element, attributes);
    }

    // Return built element
    return element;
}

/**
 * Empties the contents of an element.
 *
 * @param  {Element} el
 *         The element to empty children from
 *
 * @return {Element}
 *         The element with no children
 */
export function emptyEl(el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
    return el;
}

// Insert an element after another
export function insertAfter(element, target) {
    if (!is.element(element) || !is.element(target)) {
        return;
    }

    target.parentNode.insertBefore(element, target.nextSibling);
}

// Toggle hidden
export function toggleHidden(element, hidden) {
    if (!is.element(element)) {
        return;
    }

    let hide = hidden;

    if (!is.boolean(hide)) {
        hide = !element.hidden;
    }

    element.hidden = hide;
}

// Mirror Element.classList.toggle, with IE compatibility for "force" argument
export function toggleClass(element, className, force) {
    if (is.nodeList(element)) {
        return Array.from(element).map((e) => toggleClass(e, className, force));
    }

    if (is.element(element)) {
        let method = 'toggle';
        if (is.boolean(force)) {
            method = force ? 'add' : 'remove';
        }

        element.classList[method](className);
        return element.classList.contains(className);
    }

    return false;
}

// Has class name
export function hasClass(element, className) {
    return is.element(element) && element.classList.contains(className);
}

/**
 * Whether the current DOM interface appears to be real (i.e. not simulated).
 *
 * @return {boolean}
 *         Will be `true` if the DOM appears to be real, `false` otherwise.
 */
export function isReal() {
    // Both document and window will never be undefined thanks to `global`.
    return document === window.document;
}

export function isInFrame() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

export function getTranslateX(el) {
    let coordinates = null;

    try {
        const results = el.style.transform.match(/translate3d\((-?\d+px,\s?){2}-?\d+px\)/);

        if (results && results.length) {
            coordinates = results[0]
                .replace('translate3d(', '')
                .replace(')', '')
                .replace(/\s/g, '')
                .replace(/px/g, '')
                .split(',');
        }
    } catch (e) {
        coordinates = null;
    }

    return coordinates && coordinates.length === 3 ? parseInt(coordinates[0]) : 0;
}

// TODO: in firefox, when zooming to the screen and entering fullscreen mode, gives an incorrect value
export function getEventOffsetX(el, evt) {
    if (!evt) {
        return;
    }

    let x = 0;
    let translateX = 0;

    while (el && is.number(el.offsetLeft)) {
        translateX = getTranslateX(el);

        if (el.tagName === 'BODY') {
            x += el.offsetLeft + el.clientLeft + translateX - (el.scrollLeft || document.documentElement.scrollLeft);
        } else {
            x += el.offsetLeft + el.clientLeft + translateX - el.scrollLeft;
        }

        el = el.offsetParent;
    }

    let eventX = evt.clientX;
    if (!is.nullOrUndefined(evt.touches) && !is.nullOrUndefined(evt.touches[0])) {
        eventX = evt.touches[0].clientX;
    }

    return eventX - x;
}

export function getEventOffsetY(el, evt) {
    let y = 0;

    while (el && is.number(el.offsetTop)) {
        if (el.tagName === 'BODY') {
            y += el.offsetTop - (el.scrollTop || document.documentElement.scrollTop);
        } else {
            y += el.offsetTop - el.scrollTop;
        }

        el = el.offsetParent;
    }

    return evt.clientY - y;
}

/**
 * Identical to the native `getBoundingClientRect` function, but ensures that
 * the method is supported at all (it is in all browsers we claim to support)
 * and that the element is in the DOM before continuing.
 *
 * This wrapper function also shims properties which are not provided by some
 * older browsers (namely, IE8).
 *
 * Additionally, some browsers do not support adding properties to a
 * `ClientRect`/`DOMRect` object; so, we shallow-copy it with the standard
 * properties (except `x` and `y` which are not widely supported). This helps
 * avoid implementations where keys are non-enumerable.
 *
 * @param  {Element} el
 *         Element whose `ClientRect` we want to calculate.
 *
 * @return {Object|undefined}
 *         Always returns a plain object - or `undefined` if it cannot.
 */
export function findPosition(el, parent) {
    if (!el || (el && !el.offsetParent)) {
        return {
            left: 0,
            top: 0,
            width: 0,
            height: 0,
        };
    }
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    let left = 0;
    let top = 0;

    while (el.offsetParent && el !== parent) {
        left += el.offsetLeft;
        top += el.offsetTop;

        el = el.offsetParent;
    }

    return {
        left,
        top,
        width,
        height,
    };
}
