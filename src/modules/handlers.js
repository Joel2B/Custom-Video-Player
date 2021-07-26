export default function (self) {
    self.handleMouseleave = (event) => {
        if (typeof event.clientX !== 'undefined'
            && self.domRef.wrapper.contains(document.elementFromPoint(event.clientX, event.clientY))) {
            //false positive; we didn't actually leave the player
            return;
        }

        self.hideControlBar();
        self.hideTitle();
    };

    self.handleMouseenterForKeyboard = (e) => {
        let clickedMenuButton = false;
        // improve this iteration
        Array.from(self.domRef.wrapper.getElementsByClassName('fluid_button_main_menu')).map((elem) => {
            if (elem == e.target) {
                clickedMenuButton = true;
            }
        });

        if (!clickedMenuButton && !self.domRef.controls.optionsMenu.contains(e.target)) {
            self.closeMenu();
        }

        if (self.captureKey) {
            return;
        }

        self.captureKey = event => {
            event.stopPropagation();
            const keyCode = event.keyCode;

            switch (keyCode) {
                case 70://f
                    self.fullscreenToggle();
                    event.preventDefault();
                    break;
                case 13://Enter
                case 32://Space
                    self.playPauseToggle();
                    event.preventDefault();
                    break;
                case 77://m
                    self.muteToggle();
                    event.preventDefault();
                    break;
                case 38://up arrow
                    self.onKeyboardVolumeChange('asc');
                    event.preventDefault();
                    break;
                case 40://down arrow
                    self.onKeyboardVolumeChange('desc');
                    event.preventDefault();
                    break;
                case 37://left arrow
                case 39://right arrow
                case 35://End
                case 36://Home
                case 48://0
                case 49://1
                case 50://2
                case 51://3
                case 52://4
                case 53://5
                case 54://6
                case 55://7
                case 56://8
                case 57://9
                case 188:// ,
                case 190:// .
                    self.onKeyboardSeekPosition(keyCode);
                    event.preventDefault();
                    break;
            }

            return false;

        };

        document.addEventListener('keydown', self.captureKey, true);
    };

    self.handleWindowClick = (e) => {
        if (!self.domRef.wrapper) {
            console.warn('Dangling click event listener should be collected for unknown wrapper ' + self.videoPlayerId
                + '. Did you forget to call destroy on player instance?');
            return;
        }

        const inScopeClick = self.domRef.wrapper.contains(e.target) || e.target.id === 'skipHref_' + self.videoPlayerId;

        if (inScopeClick) {
            return;
        }

        document.removeEventListener('keydown', self.captureKey, true);
        delete self['captureKey'];

        if (self.theatreMode && !self.theatreModeAdvanced) {
            self.theatreToggle();
        }
    };

    self.handleFullscreen = () => {
        if (typeof document.vastFullsreenChangeEventListenersAdded !== 'undefined') {
            return;
        }

        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange'].forEach(eventType => {
            if (typeof (document['on' + eventType]) === 'object') {
                document.addEventListener(eventType, function (ev) {
                    self.recalculateAdDimensions();
                }, false);
            }
        });

        document.vastFullsreenChangeEventListenersAdded = true;
    };

    self.on = (eventCall, functionCall) => {
        switch (eventCall) {
            case 'play':
                self.domRef.player.onplay = functionCall;
                break;
            case 'seeked':
                self.domRef.player.onseeked = functionCall;
                break;
            case 'ended':
                self.domRef.player.onended = functionCall;
                break;
            case 'pause':
                self.domRef.player.addEventListener('pause', () => {
                    if (!self.fluidPseudoPause) {
                        functionCall();
                    }
                });
                break;
            case 'playing':
                self.domRef.player.addEventListener('playing', functionCall);
                break;
            case 'theatreModeOn':
                self.domRef.player.addEventListener('theatreModeOn', functionCall);
                break;
            case 'theatreModeOff':
                self.domRef.player.addEventListener('theatreModeOff', functionCall);
                break;
            case 'timeupdate':
                self.domRef.player.addEventListener('timeupdate', () => {
                    functionCall(self.getCurrentTime())
                });
                break;
            default:
                console.log('[FP_ERROR] Event not recognised');
                break;
        }
    };
}