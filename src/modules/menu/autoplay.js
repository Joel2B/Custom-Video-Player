export default function (self, options) {
    self.setupAutoPlay = () => {
        if (!self.isEnabledModule('autoPlay')) {
            return;
        }
        self.domRef.controls.autoPlay.addEventListener('click', () => {
            if (self.domRef.controls.autoPlay.className.indexOf('cvp_enabled') != -1) {
                self.domRef.controls.autoPlay.classList.remove('cvp_enabled');
                self.setLocalStorage('autoPlay', false, 30);
            } else {
                self.domRef.controls.autoPlay.classList.add('cvp_enabled');
                self.setLocalStorage('autoPlay', true, 30);
            }
        });
    };
}
