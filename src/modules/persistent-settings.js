export default function (self) {
    self.setPersistentSettings = () => {
        if (self.displayOptions.layoutControls.persistentSettings.volume) {
            if (self.getLocalStorage('volume') !== false) {
                self.setVolume(self.getLocalStorage('volume'));
            }

            if (self.getLocalStorage('mute')) {
                self.muteToggle();
            }
        }

        if (self.displayOptions.layoutControls.persistentSettings.speed) {
            self.applyPlaybackSpeed();
        }

        if (self.displayOptions.layoutControls.persistentSettings.theatre) {
            self.applyTheatre();
        }
    };
}
