export default function (self, options) {
    self.setupLoop = () => {
        if (!self.isEnabledModule('loop')) {
            return;
        }
        self.domRef.controls.loop.addEventListener('click', () => {
            if (self.domRef.controls.loop.className.indexOf('cvp_enabled') != -1) {
                self.domRef.controls.loop.classList.remove('cvp_enabled');
                self.setLocalStorage('loop', false, 30);
            } else {
                self.domRef.controls.loop.classList.add('cvp_enabled');
                self.setLocalStorage('loop', true, 30);
            }
            self.initLoop();
        });
    };
    
    // TODO: refactor this
    self.applyLoop = () => {
        if (!self.isEnabledModule('loop')) {
            return;
        }

        if (self.displayOptions.layoutControls.loop && self.getLocalStorage('loop') == undefined) {
            return true;
        }

        if (self.getLocalStorage('loop')) {
            return true;
        }
    };
}
