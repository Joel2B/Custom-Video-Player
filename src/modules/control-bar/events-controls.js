export default function (self) {
    self.setCustomControls = () => {
        //Set the Play/Pause behaviour
        self.trackEvent(self.domRef.player.parentNode, 'click', '.fluid_control_playpause', () => {
            if (!self.firstPlayLaunched) {
                self.domRef.player.removeEventListener('play', self.initialPlay);
            }

            self.playPauseToggle();
        }, false);

        self.domRef.player.addEventListener('play', () => {
            self.controlPlayPauseToggle();
            self.contolVolumebarUpdate();
            self.checkFPSInterval();
        }, false);

        self.domRef.player.addEventListener('fluidplayerpause', () => {
            self.controlPlayPauseToggle();
        }, false);

        //Set the progressbar
        self.domRef.player.addEventListener('timeupdate', () => {
            if (self.updateInterval == null) {
                self.updateInterval = setInterval(() => {
                    self.contolProgressbarUpdate();
                    if (self.domRef.player.paused) {
                        clearInterval(self.updateInterval);
                        self.updateInterval = null;
                    }
                }, self.updateRefreshInterval);
            }
            self.controlDurationUpdate();
        });

        const isMobileChecks = self.getMobileOs();
        const eventOn = (isMobileChecks.userOs) ? 'touchstart' : 'mousedown';

        self.domRef.controls.progressContainer
            .addEventListener(eventOn, event => self.onProgressbarMouseDown(event), false);

        //Set the volume controls
        document.getElementById(self.videoPlayerId + '_fluid_control_volume_container')
            .addEventListener(eventOn, event => self.onVolumeBarMouseDown(), false);

        self.domRef.player.addEventListener('volumechange', () => self.contolVolumebarUpdate());

        self.trackEvent(self.domRef.player.parentNode, 'click', '.fluid_control_mute', () => self.muteToggle());

        self.setBuffering();

        //Set the fullscreen control
        self.trackEvent(self.domRef.player.parentNode, 'click', '.fluid_control_fullscreen', () => self.fullscreenToggle());

        // Theatre mode
        if (self.displayOptions.layoutControls.allowTheatre && !self.isInIframe) {
            document.getElementById(self.videoPlayerId + '_fluid_control_theatre').style.display = 'inline-block';
            self.trackEvent(self.domRef.player.parentNode, 'click', '.fluid_control_theatre', () => self.theatreToggle());
        } else {
            document.getElementById(self.videoPlayerId + '_fluid_control_theatre').style.display = 'none';
        }

        self.domRef.player.addEventListener('ratechange', () => {
            if (self.isCurrentlyPlayingAd) {
                self.playbackRate = 1;
            }
        });

        if (window.attachEvent) {
            window.attachEvent('onresize', function () {
                self.resizeMarkerContainer();
            });
        } else if (window.addEventListener) {
            window.addEventListener('resize', function () {
                self.resizeMarkerContainer();
            }, true);
        } else {
            console.log('[FP_ERROR] The browser does not support Javascript event binding.');
        }
    };
}
