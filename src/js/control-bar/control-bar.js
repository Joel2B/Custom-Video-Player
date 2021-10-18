export default function(self) {
    self.hasControlBar = () => {
        return !!self.domRef.controls.root;
    };

    self.isControlBarVisible = () => {
        if (self.hasControlBar() === false) {
            return false;
        }

        const controlBar = self.domRef.controls.root;
        const style = window.getComputedStyle(controlBar, null);
        return !(style.opacity === 0 || style.visibility === 'hidden');
    };

    self.hideControlBar = () => {
        self.menu.close();

        if (self.isCurrentlyPlayingAd && !self.domRef.player.paused) {
            self.toggleAdCountdown(true);
        }

        self.domRef.player.style.cursor = 'none';

        // handles both VR and Normal condition
        if (!self.hasControlBar()) {
            return;
        }

        const divVastControls = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_container');
        const fpLogo = self.domRef.player.parentNode.getElementsByClassName('fp_logo');

        for (let i = 0; i < divVastControls.length; i++) {
            if (self.displayOptions.layoutControls.controlBar.animated) {
                divVastControls[i].classList.remove('fade_in');
                divVastControls[i].classList.add('fade_out');
            } else {
                divVastControls[i].style.display = 'none';
            }
        }

        for (let i = 0; i < fpLogo.length; i++) {
            if (self.displayOptions.layoutControls.controlBar.animated) {
                if (fpLogo[i]) {
                    fpLogo[i].classList.remove('fade_in');
                    fpLogo[i].classList.add('fade_out');
                }
            } else {
                if (fpLogo[i]) {
                    fpLogo[i].style.display = 'none';
                }
            }
        }
    };

    self.showControlBar = () => {
        if (self.isCurrentlyPlayingAd && !self.domRef.player.paused) {
            self.toggleAdCountdown(false);
        }

        if (!self.isTouchDevice()) {
            self.domRef.player.style.cursor = 'default';
        }

        if (!self.hasControlBar()) {
            return;
        }

        const divVastControls = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_container');
        const fpLogo = self.domRef.player.parentNode.getElementsByClassName('fp_logo');
        for (let i = 0; i < divVastControls.length; i++) {
            if (self.displayOptions.layoutControls.controlBar.animated) {
                divVastControls[i].classList.remove('fade_out');
                divVastControls[i].classList.add('fade_in');
            } else {
                divVastControls[i].style.display = 'block';
            }
        }

        for (let i = 0; i < fpLogo.length; i++) {
            if (self.displayOptions.layoutControls.controlBar.animated) {
                if (fpLogo[i]) {
                    fpLogo[i].classList.remove('fade_out');
                    fpLogo[i].classList.add('fade_in');
                }
            } else {
                if (fpLogo[i]) {
                    fpLogo[i].style.display = 'block';
                }
            }
        }
    };

    self.linkControlBarUserActivity = () => {
        self.domRef.player.addEventListener('userInactive', self.hideControlBar);
        self.domRef.player.addEventListener('userInactive', self.hideTitle);

        self.domRef.player.addEventListener('userActive', self.showControlBar);
        self.domRef.player.addEventListener('userActive', self.showTitle);
    };

    self.toggleControlBar = (show) => {
        const controlBar = self.domRef.controls.root;

        if (show) {
            controlBar.className += ' initial_controls_show';
            return;
        }

        controlBar.className = controlBar.className.replace(' initial_controls_show', '');
    };
}
