export default function (self) {
    self.createElement = (data, event) => {
        const elem = document.createElement(data.tag);

        if (typeof event === 'function') {
            elem.addEventListener('click', event, false);
        }

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
                        elem.appendChild(self.createElement(child));
                    }
                    break;
                case 'dataset':
                    elem[key][Object.keys(value)[0]] = Object.values(value)[0];
                    break;
                case 'domRef':
                    self.domRef.controls[value] = elem;
                default:
                    elem[key] = value;
                    break;
            }
        }
        return elem;
    }

    self.createElementNS = (data) => {
        const xmlns = 'http://www.w3.org/2000/svg';
        const elem = document.createElementNS(xmlns, data.name)

        for (const key in data) {
            const value = data[key];
            switch (key) {
                case 'attr':
                    for (const attr in value) {
                        elem.setAttribute(attr, value[attr]);
                    }
                    break;
                case 'childs':
                    for (const child of value) {
                        elem.appendChild(self.createElementNS(child));
                    }
                    break;
                case 'parent':
                    data.parent.appendChild(elem);
                    break;
                default:
                    break;
            }
        }
        return elem;
    }

    self.inIframe = () => {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    };

    self.getTranslateX = (el) => {
        let coordinates = null;

        try {
            const results = el.style.transform.match(/translate3d\((-?\d+px,\s?){2}-?\d+px\)/);

            if (results && results.length) {
                coordinates = results[0]
                    .replace('translate3d(', '')
                    .replace(')', '')
                    .replace(/\s/g, '')
                    .replace(/px/g, '')
                    .split(',')
                    ;
            }
        } catch (e) {
            coordinates = null;
        }

        return (coordinates && (coordinates.length === 3)) ? parseInt(coordinates[0]) : 0;
    };

    // firefox: when zooming to the screen and entering fullscreen mode, offsetX gives an incorrect value
    self.getEventOffsetX = (evt, el) => {
        let x = 0;
        let translateX = 0;

        while (el && !isNaN(el.offsetLeft)) {
            translateX = self.getTranslateX(el);

            if (el.tagName === 'BODY') {
                x += el.offsetLeft + el.clientLeft + translateX - (el.scrollLeft || document.documentElement.scrollLeft);
            } else {
                x += el.offsetLeft + el.clientLeft + translateX - el.scrollLeft;
            }

            el = el.offsetParent;
        }

        let eventX;
        if (typeof evt.touches !== 'undefined' && typeof evt.touches[0] !== 'undefined') {
            eventX = evt.touches[0].clientX;
        } else {
            eventX = evt.clientX
        }

        return eventX - x;
    };

    self.getEventOffsetY = (evt, el) => {
        let fullscreenMultiplier = 1;
        const videoWrapper = self.findClosestParent(el, 'div[id^="_fluid_video_wrapper"]');

        if (videoWrapper) {
            const videoPlayerId = videoWrapper.id.replace('_fluid_video_wrapper', '');
            const requestFullscreenFunctionNames = self.checkFullscreenSupport(videoPlayerId + '_fluid_video_wrapper');
            if (requestFullscreenFunctionNames && document[requestFullscreenFunctionNames.isFullscreen]) {
                fullscreenMultiplier = 0;
            }
        }

        let y = 0;

        while (el && !isNaN(el.offsetTop)) {
            if (el.tagName === 'BODY') {
                y += el.offsetTop - ((el.scrollTop || document.documentElement.scrollTop) * fullscreenMultiplier);

            } else {
                y += el.offsetTop - (el.scrollTop * fullscreenMultiplier);
            }

            el = el.offsetParent;
        }

        return evt.clientY - y;
    };

    self.findClosestParent = (el, selector) => {
        let matchesFn = null;

        // find vendor prefix
        ['matches', 'webkitMatchesSelector', 'mozMatchesSelector', 'msMatchesSelector', 'oMatchesSelector'].some(function (fn) {
            if (typeof document.body[fn] == 'function') {
                matchesFn = fn;
                return true;
            }
            return false;
        });

        let parent;

        // Check if the current element matches the selector
        if (el[matchesFn](selector)) {
            return el;
        }

        // traverse parents
        while (el) {
            parent = el.parentElement;
            if (parent && parent[matchesFn](selector)) {
                return parent;
            }
            el = parent;
        }

        return null;
    };
}
