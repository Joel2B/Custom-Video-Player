export default function (self) {
    self.setupQualityLevels = () => {
        if (!self.isEnabledModule('qualityLevels')) {
            return;
        }
        self.domRef.controls.qualitySelector.addEventListener('click', () => {
            self.openSubMenu(
                self.domRef.controls.qualitySelector,
                self.domRef.controls.levelsPage,
                self.menu.qualityLevels.width,
                self.menu.qualityLevels.height
            );
        });
    }
}
