export default function (self) {
    self.setPersistentSettings = () => {
        if (!self.displayOptions.layoutControls.mute
            && !self.getLocalStorage('autoPlay')
            && self.displayOptions.layoutControls.persistentSettings.volume) {
            self.applyVolume();
        }

        if (self.displayOptions.layoutControls.persistentSettings.speed) {
            self.applyPlaybackSpeed();
        }

        if (self.displayOptions.layoutControls.persistentSettings.theatre) {
            self.applyTheatre();
        }
    };
}
