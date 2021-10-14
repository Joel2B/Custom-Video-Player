export default function (self) {
    self.createPlaybackList = () => {
        const playbackRates = [0.5, 1, 1.5, 2];
        const childs = new DocumentFragment();

        for (const value of playbackRates) {
            childs.appendChild(self.createElement({
                tag: 'li',
                textContent: (value == 1) ? 'Normal' : value,
                dataset: {
                    speed: value
                },
                ...(value == 1) && { className: 'cvp_active' }
            }, (e) => {
                const previousSpeed = self.domRef.wrapper.querySelector('.cvp_speed .cvp_active');
                const selectedSpeed = e.target;

                previousSpeed.classList.remove('cvp_active');
                self.domRef.wrapper.querySelector(`[data-speed='${selectedSpeed.dataset.speed}']`).classList.add('cvp_active');
                self.domRef.controls.speedSelector.lastChild.textContent = selectedSpeed.firstChild.textContent;
                self.setPlaybackSpeed(selectedSpeed.dataset.speed);

                self.closeMenu();
            }))
        }
        self.domRef.controls.speedsPage.append(childs);
    };

    self.setupPlaybackRates = () => {
        if (!self.isEnabledModule('playbackRate')) {
            return;
        }
        self.createPlaybackList();
        self.domRef.controls.speedSelector.addEventListener('click', () => {
            self.openSubMenu(
                self.domRef.controls.speedSelector,
                self.domRef.controls.speedsPage,
                self.menu.playbackRate.width,
                self.menu.playbackRate.height
            );
        });
    },

    self.setPlaybackSpeed = (speed) => {
        if (self.isCurrentlyPlayingAd || !self.isEnabledModule('playbackRate')) {
            return;
        }
        self.domRef.player.playbackRate = speed;
        self.setLocalStorage('playbackRate', speed, 30);
    };

    self.applyPlaybackSpeed = () => {
        if (!self.isEnabledModule('playbackRate')) {
            return;
        }
        const currentSpeed = self.getLocalStorage('playbackRate');
        if (!currentSpeed) {
            return;
        }

        const previousSpeed = self.domRef.wrapper.querySelector('.cvp_speed .cvp_active');
        previousSpeed.classList.remove('cvp_active');

        setTimeout(() => {
            self.setPlaybackSpeed(currentSpeed);
        }, 500);

        const selectedSpeed = self.domRef.wrapper.querySelector(`[data-speed='${currentSpeed}']`)
        selectedSpeed.classList.add('cvp_active');
    }
}