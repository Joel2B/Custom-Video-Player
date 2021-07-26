export default function (self) {
    self.theatreToggle = () => {
        if (self.isInIframe) {
            return;
        }

        // Theatre and fullscreen, it's only one or the other
        if (self.fullscreenMode) {
            self.fullscreenToggle();
        }

        // Advanced Theatre mode if specified
        if (self.displayOptions.layoutControls.theatreAdvanced) {
            const elementForTheatre = document.getElementById(self.displayOptions.layoutControls.theatreAdvanced.theatreElement);
            const theatreClassToApply = self.displayOptions.layoutControls.theatreAdvanced.classToApply;
            if (elementForTheatre != null && theatreClassToApply != null) {
                if (!self.theatreMode) {
                    elementForTheatre.classList.add(theatreClassToApply);
                } else {
                    elementForTheatre.classList.remove(theatreClassToApply);
                }
                self.theatreModeAdvanced = !self.theatreModeAdvanced;
            } else {
                console.log('[FP_ERROR] Theatre mode elements could not be found, defaulting behaviour.');
                // Default overlay behaviour
                self.defaultTheatre();
            }
        } else {
            // Default overlay behaviour
            self.defaultTheatre();
        }

        // Set correct variables
        self.theatreMode = !self.theatreMode;
        self.setlocalStorage('theatre', self.theatreMode, 30);

        // Trigger theatre event
        const theatreEvent = (self.theatreMode) ? 'theatreModeOn' : 'theatreModeOff';
        const event = document.createEvent('CustomEvent');
        event.initEvent(theatreEvent, false, true);
        self.domRef.player.dispatchEvent(event);

        self.resizeVpaidAuto();
        self.resizeMarkerContainer();
    };

    self.defaultTheatre = () => {
        const videoWrapper = self.domRef.wrapper;

        if (self.theatreMode) {
            videoWrapper.classList.remove('fluid_theatre_mode');
            videoWrapper.style.maxHeight = '';
            videoWrapper.style.marginTop = '';
            videoWrapper.style.left = '';
            videoWrapper.style.right = '';
            videoWrapper.style.position = '';
            if (!self.displayOptions.layoutControls.fillToContainer) {
                videoWrapper.style.width = self.originalWidth + 'px';
                videoWrapper.style.height = self.originalHeight + 'px';
            } else {
                videoWrapper.style.width = '100%';
                videoWrapper.style.height = '100%';
            }
            return;
        }

        videoWrapper.classList.add('fluid_theatre_mode');
        const workingWidth = self.displayOptions.layoutControls.theatreSettings.width;
        let defaultHorizontalMargin = '10px';
        videoWrapper.style.width = workingWidth;
        videoWrapper.style.height = self.displayOptions.layoutControls.theatreSettings.height;
        videoWrapper.style.maxHeight = screen.height + 'px';
        videoWrapper.style.marginTop = self.displayOptions.layoutControls.theatreSettings.marginTop + 'px';
        switch (self.displayOptions.layoutControls.theatreSettings.horizontalAlign) {
            case 'center':
                // We must calculate the margin differently based on whether they passed % or px
                if (typeof (workingWidth) == 'string' && workingWidth.substr(workingWidth.length - 1) === '%') {
                    // A margin of half the remaining space
                    defaultHorizontalMargin = ((100 - parseInt(workingWidth.substring(0, workingWidth.length - 1))) / 2) + '%';
                } else if (typeof (workingWidth) == 'string' && workingWidth.substr(workingWidth.length - 2) === 'px') {
                    // Half the (Remaining width / fullwidth)
                    defaultHorizontalMargin = (((screen.width - parseInt(workingWidth.substring(0, workingWidth.length - 2))) / screen.width) * 100 / 2) + '%';
                } else {
                    console.log('[FP_ERROR] Theatre width specified invalid.');
                }

                videoWrapper.style.left = defaultHorizontalMargin;
                break;
            case 'right':
                videoWrapper.style.right = defaultHorizontalMargin;
                break;
            case 'left':
            default:
                videoWrapper.style.left = defaultHorizontalMargin;
                break;
        }
    };

    self.applyTheatre = () => {
        if (self.getLocalStorage('theatre')) {
            self.theatreToggle();
        }
    }
}
