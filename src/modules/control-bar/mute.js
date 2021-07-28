export default function (self) {
    self.muteToggle = () => {
        if (0 !== self.domRef.player.volume && !self.domRef.player.muted) {
            self.domRef.player.volume = 0;
            self.domRef.player.muted = true;
        } else {
            self.domRef.player.volume = self.latestVolume;
            self.domRef.player.muted = false;
        }

        // Persistent settings
        self.setLocalStorage('volume', self.latestVolume, 30);
        self.setLocalStorage('mute', self.domRef.player.muted, 30);
    };

    self.setMute = () => {
        self.domRef.player.volume = 0;
        self.domRef.player.muted = true;
    };

    self.initMute = () => {
        if (self.displayOptions.layoutControls.mute !== true) {
            if (!self.getLocalStorage('autoPlay')) {
                return;
            }
        }
        self.setMute();
    };
}
