export default function (self) {
    self.setPersistentSettings = () => {
        if (self.displayOptions.layoutControls.persistentSettings.volume) {
            self.applyVolume();
        }

        if (self.displayOptions.layoutControls.persistentSettings.speed) {
            self.speed.apply();
        }

        if (self.displayOptions.layoutControls.persistentSettings.theatre) {
            self.applyTheatre();
        }
    };
}
