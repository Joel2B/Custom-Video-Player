export default function (self) {
    self.initTitle = () => {
        if (!self.displayOptions.layoutControls.title) {
            return;
        }
        const titleHolder = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_title',
            className: 'fp_title',
            innerHTML: self.displayOptions.layoutControls.title,
            domRef: 'titleHolder'
        });

        self.domRef.player.parentNode.insertBefore(titleHolder, null);
    };

    self.hasTitle = () => {
        const title = self.domRef.controls.titleHolder;
        const titleOption = self.displayOptions.layoutControls.title;
        return title && titleOption != null;
    };

    self.hideTitle = () => {
        const titleHolder = self.domRef.controls.titleHolder;

        if (!self.hasTitle()) {
            return;
        }

        titleHolder.classList.add('fade_out');
    };

    self.showTitle = () => {
        const titleHolder = self.domRef.controls.titleHolder;

        if (!self.hasTitle()) {
            return;
        }

        titleHolder.classList.remove('fade_out');
    };
}
