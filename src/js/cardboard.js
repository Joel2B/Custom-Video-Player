export default function(self, options) {
    const $script = require('scriptjs');

    self.createCardboardJoystickButton = (identity) => {
        const vrJoystickPanel = document.getElementById(self.videoPlayerId + '_fluid_vr_joystick_panel');
        const joystickButton = document.createElement('div');

        joystickButton.id = self.videoPlayerId + '_fluid_vr_joystick_' + identity;
        joystickButton.className = 'fluid_vr_button fluid_vr_joystick_' + identity;
        vrJoystickPanel.appendChild(joystickButton);

        return joystickButton;
    };

    self.cardboardRotateLeftRight = (param /* 0 - right, 1 - left */) => {
        const go = self.vrROTATION_POSITION;
        const back = -self.vrROTATION_POSITION;
        const pos = param < 1 ? go : back;
        const easing = { val: pos };
        const tween = new TWEEN.Tween(easing)
            .to({ val: 0 }, self.vrROTATION_SPEED)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(function() {
                self.vrViewer.OrbitControls.rotateLeft(easing.val);
            }).start();
    };

    self.cardboardRotateUpDown = (param /* 0 - down, 1- up */) => {
        const go = self.vrROTATION_POSITION;
        const back = -self.vrROTATION_POSITION;
        const pos = param < 1 ? go : back;
        const easing = { val: pos };
        const tween = new TWEEN.Tween(easing)
            .to({ val: 0 }, self.vrROTATION_SPEED)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(function() {
                self.vrViewer.OrbitControls.rotateUp(easing.val);
            }).start();
    };

    self.createCardboardJoystick = () => {
        const vrContainer = document.getElementById(self.videoPlayerId + '_fluid_vr_container');

        // Create a JoyStick and append to VR container
        const vrJoystickPanel = document.createElement('div');
        vrJoystickPanel.id = self.videoPlayerId + '_fluid_vr_joystick_panel';
        vrJoystickPanel.className = 'fluid_vr_joystick_panel';
        vrContainer.appendChild(vrJoystickPanel);

        // Create Joystick buttons
        const upButton = self.createCardboardJoystickButton('up');
        const leftButton = self.createCardboardJoystickButton('left');
        const rightButton = self.createCardboardJoystickButton('right');
        const downButton = self.createCardboardJoystickButton('down');
        const zoomDefaultButton = self.createCardboardJoystickButton('zoomdefault');
        const zoomInButton = self.createCardboardJoystickButton('zoomin');
        const zoomOutButton = self.createCardboardJoystickButton('zoomout');

        // Camera movement buttons
        upButton.addEventListener('click', function() {
            // player.vrViewer.OrbitControls.rotateUp(-0.1);
            self.cardboardRotateUpDown(1);
        });

        downButton.addEventListener('click', function() {
            // player.vrViewer.OrbitControls.rotateUp(0.1);
            self.cardboardRotateUpDown(0);
        });

        rightButton.addEventListener('click', function() {
            // player.vrViewer.OrbitControls.rotateLeft(0.1);
            self.cardboardRotateLeftRight(0);
        });

        leftButton.addEventListener('click', function() {
            // player.vrViewer.OrbitControls.rotateLeft(-0.1);
            self.cardboardRotateLeftRight(1);
        });

        zoomDefaultButton.addEventListener('click', function() {
            self.vrViewer.camera.fov = 60;
            self.vrViewer.camera.updateProjectionMatrix();
        });

        // Camera Zoom buttons
        zoomOutButton.addEventListener('click', function() {
            self.vrViewer.camera.fov *= 1.1;
            self.vrViewer.camera.updateProjectionMatrix();
        });

        zoomInButton.addEventListener('click', function() {
            self.vrViewer.camera.fov *= 0.9;
            self.vrViewer.camera.updateProjectionMatrix();
        });
    };

    self.cardBoardResize = () => {
        self.domRef.player.addEventListener('theatreModeOn', function() {
            self.vrViewer.onWindowResize();
        });

        self.domRef.player.addEventListener('theatreModeOff', function() {
            self.vrViewer.onWindowResize();
        });
    };

    self.cardBoardSwitchToNormal = () => {
        const vrJoystickPanel = document.getElementById(self.videoPlayerId + '_fluid_vr_joystick_panel');
        const controlBar = self.domRef.controls.root;
        const videoPlayerTag = self.domRef.player;

        self.vrViewer.enableEffect(PANOLENS.MODES.NORMAL);
        self.vrViewer.onWindowResize();
        self.vrMode = false;

        // remove dual control bar
        const newControlBar = videoPlayerTag.parentNode.getElementsByClassName('fluid_vr2_controls_container')[0];
        videoPlayerTag.parentNode.removeChild(newControlBar);

        if (self.displayOptions.layoutControls.showCardBoardJoystick && vrJoystickPanel) {
            vrJoystickPanel.style.display = 'block';
        }
        controlBar.classList.remove('fluid_vr_controls_container');

        // show volume control bar
        const volumeContainer = document.getElementById(self.videoPlayerId + '_fluid_control_volume_container');
        volumeContainer.style.display = 'block';

        // show all ads overlays if any
        const adCountDownTimerText = document.getElementById('ad_countdown' + self.videoPlayerId);
        const ctaButton = document.getElementById(self.videoPlayerId + '_fluid_cta');
        const addAdPlayingTextOverlay = document.getElementById(self.videoPlayerId + '_fluid_ad_playing');
        const skipBtn = document.getElementById('skip_button_' + self.videoPlayerId);

        if (adCountDownTimerText) {
            adCountDownTimerText.style.display = 'block';
        }

        if (ctaButton) {
            ctaButton.style.display = 'block';
        }

        if (addAdPlayingTextOverlay) {
            addAdPlayingTextOverlay.style.display = 'block';
        }

        if (skipBtn) {
            skipBtn.style.display = 'block';
        }
    };

    self.cardBoardHideDefaultControls = () => {
        const vrJoystickPanel = document.getElementById(self.videoPlayerId + '_fluid_vr_joystick_panel');
        const initialPlay = document.getElementById(self.videoPlayerId + '_fluid_initial_play');
        const volumeContainer = document.getElementById(self.videoPlayerId + '_fluid_control_volume_container');

        // hide the joystick in VR mode
        if (self.displayOptions.layoutControls.showCardBoardJoystick && vrJoystickPanel) {
            vrJoystickPanel.style.display = 'none';
        }

        // hide big play icon
        if (initialPlay) {
            document.getElementById(self.videoPlayerId + '_fluid_initial_play').style.display = 'none';
            document.getElementById(self.videoPlayerId + '_fluid_initial_play_button').style.opacity = '1';
        }

        // hide volume control bar
        volumeContainer.style.display = 'none';
    };

    self.cardBoardCreateVRControls = () => {
        const controlBar = self.domRef.controls.root;

        // create and append dual control bar
        const newControlBar = controlBar.cloneNode(true);
        newControlBar.removeAttribute('id');
        newControlBar.querySelectorAll('*').forEach(function(node) {
            node.removeAttribute('id');
        });

        newControlBar.classList.add('fluid_vr2_controls_container');
        self.domRef.player.parentNode.insertBefore(newControlBar, self.domRef.player.nextSibling);
        self.copyEvents(newControlBar);
        self.domRef.controls.progressContainerSecond = newControlBar.firstChild.nextSibling;
    };

    self.cardBoardSwitchToVR = () => {
        const controlBar = self.domRef.controls.root;

        self.vrViewer.enableEffect(PANOLENS.MODES.CARDBOARD);

        self.vrViewer.onWindowResize();
        self.vrViewer.disableReticleControl();

        self.vrMode = true;

        controlBar.classList.add('fluid_vr_controls_container');

        self.cardBoardHideDefaultControls();
        self.cardBoardCreateVRControls();

        // hide all ads overlays
        const adCountDownTimerText = document.getElementById('ad_countdown' + self.videoPlayerId);
        const ctaButton = document.getElementById(self.videoPlayerId + '_fluid_cta');
        const addAdPlayingTextOverlay = document.getElementById(self.videoPlayerId + '_fluid_ad_playing');
        const skipBtn = document.getElementById('skip_button_' + self.videoPlayerId);

        if (adCountDownTimerText) {
            adCountDownTimerText.style.display = 'none';
        }

        if (ctaButton) {
            ctaButton.style.display = 'none';
        }

        if (addAdPlayingTextOverlay) {
            addAdPlayingTextOverlay.style.display = 'none';
        }

        if (skipBtn) {
            skipBtn.style.display = 'none';
        }

        self.domRef.controls.progressContainerSecond
            .addEventListener('mousedown', event => self.onProgressbarMouseDown(event), false);
    };

    self.cardBoardMoveTimeInfo = () => {
        const timePlaceholder = document.getElementById(self.videoPlayerId + '_fluid_control_duration');

        timePlaceholder.classList.add('cardboard_time');
        self.domRef.controls.basicPreview.parentNode.insertBefore(timePlaceholder, self.domRef.controls.basicPreview);

        // override the time display function for this instance
        self.controlDurationUpdate = function() {
            const currentPlayTime = self.formatTime(self.domRef.player.currentTime);
            const totalTime = self.formatTime(self.currentVideoDuration);
            const timePlaceholder = self.domRef.player.parentNode.getElementsByClassName('fluid_control_duration');

            let durationText = '';

            if (self.isCurrentlyPlayingAd) {
                durationText = "<span class='ad_timer_prefix'>AD : </span>" + currentPlayTime + ' / ' + totalTime;

                for (let i = 0; i < timePlaceholder.length; i++) {
                    timePlaceholder[i].classList.add('ad_timer_prefix');
                }
            } else {
                durationText = currentPlayTime + ' / ' + totalTime;

                for (let i = 0; i < timePlaceholder.length; i++) {
                    timePlaceholder[i].classList.remove('ad_timer_prefix');
                }
            }

            for (let i = 0; i < timePlaceholder.length; i++) {
                timePlaceholder[i].innerHTML = durationText;
            }
        };
    };

    self.cardBoardAlterDefaultControls = () => {
        self.cardBoardMoveTimeInfo();
    };

    self.createCardboardView = () => {
        // Create a container for 360degree
        const vrContainer = document.createElement('div');
        vrContainer.id = self.videoPlayerId + '_fluid_vr_container';
        vrContainer.className = 'fluid_vr_container';
        self.domRef.player.parentNode.insertBefore(vrContainer, self.domRef.player.nextSibling);

        // OverRide some conflicting functions from panolens
        PANOLENS.VideoPanorama.prototype.pauseVideo = function() {
        };
        PANOLENS.VideoPanorama.prototype.playVideo = function() {
        };

        self.vrPanorama = new PANOLENS.VideoPanorama('', {
            videoElement: self.domRef.player,
            autoplay: self.autoPlay.apply(),
            loop: self.loop.apply(),
        });

        self.vrViewer = new PANOLENS.Viewer({
            container: vrContainer,
            controlBar: true,
            controlButtons: [],
            enableReticle: false,
        });
        self.vrViewer.add(self.vrPanorama);

        self.vrViewer.enableEffect(PANOLENS.MODES.NORMAL);
        self.vrViewer.onWindowResize();

        // if Mobile device then enable controls using gyroscope
        if (self.getMobileOs().userOs === 'Android' || self.getMobileOs().userOs === 'iOS') {
            self.vrViewer.enableControl(1);
        }

        // Make Changes for default skin
        self.cardBoardAlterDefaultControls();

        // resize on toggle theater mode
        self.cardBoardResize();

        // Store initial camera position
        self.vrViewer.initialCameraPosition = JSON.parse(JSON.stringify(self.vrViewer.camera.position));

        if (self.displayOptions.layoutControls.showCardBoardJoystick) {
            if (!(self.getMobileOs().userOs === 'Android' || self.getMobileOs().userOs === 'iOS')) {
                self.createCardboardJoystick();
            }
            // Disable zoom if showing joystick
            self.vrViewer.OrbitControls.noZoom = true;
        }

        self.trackEvent(self.domRef.player.parentNode, 'click', '.fluid_control_cardboard', function() {
            if (self.vrMode) {
                self.domRef.controls.progressContainer = self.domRef.controls.tmp;
                self.cardBoardSwitchToNormal();
            } else {
                self.domRef.controls.tmp = self.domRef.controls.progressContainer;
                self.cardBoardSwitchToVR();
                self.domRef.controls.progressContainerSecond
                    .addEventListener('mouseenter', () => {
                        self.domRef.controls.progressContainer = self.domRef.controls.progressContainerSecond;
                    }, false);
                self.domRef.controls.progressContainerSecond
                    .addEventListener('mouseleave', () => {
                        self.domRef.controls.progressContainer = self.domRef.controls.tmp;
                    }, false);
            }
            self.resizeMarkerContainer();
        });
    };

    self.createCardboard = () => {
        if (!self.displayOptions.layoutControls.showCardBoardView) {
            return;
        }

        document
            .getElementById(self.videoPlayerId + '_fluid_control_cardboard')
            .style
            .display = 'inline-block';

        if (!window.PANOLENS) {
            $script('https://cdn.jsdelivr.net/npm/three@0.105.0/build/three.min.js', () => {
                $script('https://cdn.jsdelivr.net/npm/panolens@latest/build/panolens.min.js', () => {
                    self.createCardboardView();
                });
            });
        } else {
            self.createCardboardView();
        }
    };
}
