export default function (self) {
    self.setupQualityLevels = () => {
        self.domRef.controls.qualitySelector.addEventListener('click', () => {
            self.openSubMenu(
                self.domRef.controls.qualitySelector,
                self.domRef.controls.levelsPage,
                115,
                self.hightLevelOptions
            );
        });
    }
}
