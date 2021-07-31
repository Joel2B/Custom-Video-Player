export default function (self) {
    /**
     * Dispatches a custom pause event which is not present when seeking.
     */
    self.onFluidPlayerPause = () => {
        setTimeout(function () {
            if (self.recentWaiting) {
                return;
            }

            const event = document.createEvent('CustomEvent');
            event.initEvent('fluidplayerpause', false, true);
            self.domRef.player.dispatchEvent(event);
        }, 100);
    };

    self.controlPlayPauseToggle = () => {
        const playPauseButton = self.domRef.player.parentNode.getElementsByClassName('fluid_control_playpause');
        const menuOptionPlay = document.getElementById(self.videoPlayerId + 'context_option_play');
        const controlsDisplay = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_container');
        const fpLogo = document.getElementById(self.videoPlayerId + '_logo');

        const initialPlay = document.getElementById(self.videoPlayerId + '_fluid_initial_play');
        if (initialPlay) {
            document.getElementById(self.videoPlayerId + '_fluid_initial_play').style.display = 'none';
            document.getElementById(self.videoPlayerId + '_fluid_initial_play_button').style.opacity = '1';
        }

        if (!self.domRef.player.paused) {
            for (let i = 0; i < playPauseButton.length; i++) {
                playPauseButton[i].className = playPauseButton[i].className.replace(/\bfluid_button_play\b/g, 'fluid_button_pause');
            }

            for (let i = 0; i < controlsDisplay.length; i++) {
                controlsDisplay[i].classList.remove('initial_controls_show');
            }

            if (fpLogo) {
                fpLogo.classList.remove('initial_controls_show');
            }

            if (menuOptionPlay !== null) {
                menuOptionPlay.innerHTML = self.displayOptions.captions.pause;
            }

            return;
        }

        for (let i = 0; i < playPauseButton.length; i++) {
            playPauseButton[i].className = playPauseButton[i].className.replace(/\bfluid_button_pause\b/g, 'fluid_button_play');
        }

        for (let i = 0; i < controlsDisplay.length; i++) {
            controlsDisplay[i].classList.add('initial_controls_show');
        }

        if (self.isCurrentlyPlayingAd && self.displayOptions.vastOptions.showPlayButton) {
            document.getElementById(self.videoPlayerId + '_fluid_initial_play').style.display = 'block';
            document.getElementById(self.videoPlayerId + '_fluid_initial_play_button').style.opacity = '1';
        }

        if (fpLogo) {
            fpLogo.classList.add('initial_controls_show');
        }

        if (menuOptionPlay !== null) {
            menuOptionPlay.innerHTML = self.displayOptions.captions.play;
        }
    };

    self.playPauseAnimationToggle = (play) => {
        if (self.isCurrentlyPlayingAd || !self.displayOptions.layoutControls.playPauseAnimation || self.isSwitchingSource) {
            return;
        }

        self.domRef.controls.initialPlayButton.classList.remove('transform-active');

        if (play) {
            self.domRef.controls.stateButton.classList.remove('fluid_initial_pause_button');
            self.domRef.controls.stateButton.classList.add('fluid_initial_play_button');
        } else {
            self.domRef.controls.stateButton.classList.remove('fluid_initial_play_button');
            self.domRef.controls.stateButton.classList.add('fluid_initial_pause_button');
        }

        setTimeout(() => {
            self.domRef.controls.initialPlayButton.classList.add('transform-active');
        }, 50);

        clearTimeout(self.playButtonTimer);
        self.playButtonTimer = setTimeout(() => {
            self.domRef.controls.initialPlayButton.classList.remove('transform-active');
        }, 800);
    };

    self.initialPlay = () => {
        self.domRef.player.addEventListener('playing', () => {
            self.toggleLoader(false);
        });

        self.domRef.player.addEventListener('timeupdate', () => {
            // some places we are manually displaying toggleLoader
            // user experience toggleLoader being displayed even when content is playing in background
            self.toggleLoader(false);
        });

        self.domRef.player.addEventListener('waiting', () => {
            self.toggleLoader(true);
        });

        if (!self.displayOptions.layoutControls.playButtonShowing) {
            // Controls always showing until the video is first played
            const initialControlsDisplay = document.getElementById(self.videoPlayerId + '_fluid_controls_container');
            initialControlsDisplay.classList.remove('initial_controls_show');
            // The logo shows before playing but may need to be removed
            const fpPlayer = document.getElementById(self.videoPlayerId + '_logo');
            if (fpPlayer) {
                fpPlayer.classList.remove('initial_controls_show');
            }
        }

        if (!self.firstPlayLaunched) {
            self.playPauseToggle();
            self.domRef.player.removeEventListener('play', self.initialPlay);
        }
    };

    self.playPauseToggle = () => {
        const isFirstStart = !self.firstPlayLaunched;
        const preRolls = self.findRoll('preRoll');

        if (!isFirstStart || preRolls.length === 0) {
            if (isFirstStart && preRolls.length === 0) {
                self.firstPlayLaunched = true;
                self.displayOptions.vastOptions.vastAdvanced.noVastVideoCallback();
            }

            if (self.domRef.player.paused) {
                if (self.isCurrentlyPlayingAd && self.vastOptions !== null && self.vastOptions.vpaid) {
                    // resume the vpaid linear ad
                    self.resumeVpaidAd();
                } else {
                    // resume the regular linear vast or content video player
                    if (self.dashPlayer) {
                        self.dashPlayer.play();
                    } else {
                        self.domRef.player.play();
                    }
                }

                self.playPauseAnimationToggle(true);

            } else if (!isFirstStart) {
                if (self.isCurrentlyPlayingAd && self.vastOptions !== null && self.vastOptions.vpaid) {
                    // pause the vpaid linear ad
                    self.pauseVpaidAd();
                } else {
                    // pause the regular linear vast or content video player
                    self.domRef.player.pause();
                }
                // run more tests to see if it doesn't break any functions
                self.controlPlayPauseToggle();
                self.playPauseAnimationToggle(false);
            }

            self.toggleOnPauseAd();
        } else {
            self.isCurrentlyPlayingAd = true;

            // Workaround for Safari or Mobile Chrome - otherwise it blocks the subsequent
            // play() command, because it considers it not being triggered by the user.
            // The URL is hardcoded here to cover widest possible use cases.
            // If you know of an alternative workaround for this issue - let us know!
            const browserVersion = self.getBrowserVersion();
            const isChromeAndroid = self.mobileInfo.userOs !== false
                && self.mobileInfo.userOs === 'Android'
                && browserVersion.browserName === 'Google Chrome';

            if ('Safari' === browserVersion.browserName || isChromeAndroid) {
                self.domRef.player.src = 'https://cdn.fluidplayer.com/static/blank.mp4';
                self.domRef.player.play();
                self.playPauseAnimationToggle(true);
            }

            self.firstPlayLaunched = true;

            //trigger the loading of the VAST Tag
            self.prepareVast('preRoll');
            self.preRollAdPodsLength = preRolls.length;
        }

        const prepareVastAdsThatKnowDuration = () => {
            self.prepareVast('onPauseRoll');
            self.prepareVast('postRoll');
            self.prepareVast('midRoll');
        };

        if (isFirstStart) {
            // Remove the div that was placed as a fix for poster image and DASH streaming, if it exists
            const pseudoPoster = document.getElementById(self.videoPlayerId + '_fluid_pseudo_poster');
            if (pseudoPoster) {
                pseudoPoster.parentNode.removeChild(pseudoPoster);
            }

            if (self.mainVideoDuration > 0) {
                prepareVastAdsThatKnowDuration();
            } else {
                self.domRef.player.addEventListener('mainVideoDurationSet', prepareVastAdsThatKnowDuration);
            }
        }

        self.adTimer();

        const blockOnPause = document.getElementById(self.videoPlayerId + '_fluid_html_on_pause');

        if (blockOnPause && !self.isCurrentlyPlayingAd) {
            if (self.domRef.player.paused) {
                blockOnPause.style.display = 'flex';
            } else {
                blockOnPause.style.display = 'none';
            }
        }
    };
}