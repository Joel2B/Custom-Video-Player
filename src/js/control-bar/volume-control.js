export default function (self) {
    self.checkShouldDisplayVolumeBar = () => {
        return 'iOS' !== self.getMobileOs().userOs;
    };

    self.contolVolumebarUpdate = () => {
        const currentVolumeTag = self.domRef.controls.currentVolume;
        const volumeposTag = self.domRef.controls.volumeCurrentPos;
        const volumebarTotalWidth = self.domRef.controls.volume.clientWidth;
        const volumeposTagWidth = volumeposTag.clientWidth;
        const muteButtonTag = self.domRef.player.parentNode.getElementsByClassName('fluid_control_mute');
        const menuOptionMute = document.getElementById(self.videoPlayerId + '_context_option_mute');

        if (0 !== self.domRef.player.volume) {
            self.latestVolume = self.domRef.player.volume;
            self.setLocalStorage('mute', false);
        } else {
            self.setLocalStorage('mute', true);
        }

        if (self.domRef.player.volume && !self.domRef.player.muted) {
            for (let i = 0; i < muteButtonTag.length; i++) {
                muteButtonTag[i].className = muteButtonTag[i].className.replace(
                    /\bfluid_button_mute\b/g,
                    'fluid_button_volume',
                );
            }

            if (menuOptionMute !== null) {
                menuOptionMute.innerHTML = self.displayOptions.captions.mute;
            }
        } else {
            for (let i = 0; i < muteButtonTag.length; i++) {
                muteButtonTag[i].className = muteButtonTag[i].className.replace(
                    /\bfluid_button_volume\b/g,
                    'fluid_button_mute',
                );
            }

            if (menuOptionMute !== null) {
                menuOptionMute.innerHTML = self.displayOptions.captions.unmute;
            }
        }
        currentVolumeTag.style.width = self.domRef.player.volume * volumebarTotalWidth + 'px';
        volumeposTag.style.left = self.domRef.player.volume * volumebarTotalWidth - volumeposTagWidth / 2 + 'px';
    };

    self.onVolumeBarMouseDown = () => {
        const shiftVolume = (volumeBarX) => {
            const totalWidth = self.domRef.controls.volumeContainer.clientWidth;

            if (totalWidth) {
                let newVolume = volumeBarX / totalWidth;

                if (newVolume < 0.05) {
                    newVolume = 0;
                    self.domRef.player.muted = true;
                } else if (newVolume > 0.95) {
                    newVolume = 1;
                }

                if (self.domRef.player.muted && newVolume > 0) {
                    self.domRef.player.muted = false;
                }

                self.setVolume(newVolume);
            }
        };

        const onVolumeBarMouseMove = (event) => {
            const currentX = self.getEventOffsetX(event, self.domRef.controls.volumeContainer);
            shiftVolume(currentX);
        };

        const onVolumeBarMouseUp = (event) => {
            document.removeEventListener('mousemove', onVolumeBarMouseMove);
            document.removeEventListener('touchmove', onVolumeBarMouseMove);
            document.removeEventListener('mouseup', onVolumeBarMouseUp);
            document.removeEventListener('touchend', onVolumeBarMouseUp);

            const currentX = self.getEventOffsetX(event, self.domRef.controls.volumeContainer);

            if (!isNaN(currentX)) {
                shiftVolume(currentX);
            }
        };

        document.addEventListener('mouseup', onVolumeBarMouseUp);
        document.addEventListener('touchend', onVolumeBarMouseUp);
        document.addEventListener('mousemove', onVolumeBarMouseMove);
        document.addEventListener('touchmove', onVolumeBarMouseMove);
    };

    self.onKeyboardVolumeChange = (direction) => {
        let volume = self.domRef.player.volume;

        if ('asc' === direction) {
            volume += 0.05;
        } else if ('desc' === direction) {
            volume -= 0.05;
        }

        if (volume < 0.05) {
            volume = 0;
            self.domRef.player.muted = true;
        } else if (volume > 0.95) {
            volume = 1;
        }

        if (self.domRef.player.muted && volume > 0) {
            self.domRef.player.muted = false;
        }

        self.setVolume(volume);
    };

    /**
     * Checks if the volumebar is rendered and the styling applied by comparing
     * the width of 2 elements that should look different.
     *
     * @returns Boolean
     */
    self.checkIfVolumebarIsRendered = () => {
        const volumeposTag = self.domRef.controls.volumeCurrentPos;
        const volumebarTotalWidth = self.domRef.controls.volume.clientWidth;
        const volumeposTagWidth = volumeposTag.clientWidth;

        return volumeposTagWidth !== volumebarTotalWidth;
    };

    self.setVolume = (passedVolume) => {
        self.domRef.player.volume = passedVolume;

        // If user scrolls to volume 0, we should not store 0 as
        // latest volume - there is a property called "muted" already
        // and storing 0 will break the toggle.
        // In case user scrolls to 0 we assume last volume to be 1
        // for toggle.
        const latestVolume = 0 === passedVolume ? 1 : passedVolume;

        self.latestVolume = latestVolume;
        self.setLocalStorage('volume', latestVolume);
    };

    self.applyVolume = () => {
        if (self.getLocalStorage('volume') === null) {
            self.setLocalStorage('volume', 1);
        }
        self.setVolume(self.getLocalStorage('volume'));

        if (self.getLocalStorage('mute')) {
            self.muteToggle();
        }
    };
}
