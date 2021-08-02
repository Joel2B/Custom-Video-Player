export default function (self, options) {
    // this functions helps in adding event listeners for future dynamic elements
    // trackEvent(document, "click", ".some_elem", callBackFunction);
    self.trackEvent = (el, evt, sel, handler) => {
        if (typeof self.events[sel] === 'undefined') {
            self.events[sel] = {};
        }

        if (typeof self.events[sel][evt] === 'undefined') {
            self.events[sel][evt] = [];
        }

        self.events[sel][evt].push(handler);
        self.registerListener(el, evt, sel, handler);
    };

    self.registerListener = (el, evt, sel, handler) => {
        const currentElements = el.querySelectorAll(sel);
        for (let i = 0; i < currentElements.length; i++) {
            currentElements[i].addEventListener(evt, handler);
        }
    };

    self.copyEvents = (topLevelEl) => {
        for (let sel in self.events) {
            if (!self.events.hasOwnProperty(sel)) {
                continue;
            }

            for (let evt in self.events[sel]) {
                if (!self.events[sel].hasOwnProperty(evt)) {
                    continue;
                }

                for (let i = 0; i < self.events[sel][evt].length; i++) {
                    self.registerListener(topLevelEl, evt, sel, self.events[sel][evt][i]);
                }
            }
        }
    };

    self.useCapture = () => {
        return self.isTouchDevice() ? { passive: false } : false;
    };
}