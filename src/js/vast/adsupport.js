/* eslint-disable */
export default function (self, options) {
    const VPAID_VERSION = '2.0';

    self.renderLinearAd = (adListId, backupTheVideoTime) => {
        self.toggleLoader(true);

        //get the proper ad
        self.vastOptions = self.adPool[adListId];

        if (backupTheVideoTime) {
            self.backupMainVideoContentTime(adListId);
        }

        const playVideoPlayer = adListId => {
            self.switchPlayerToVpaidMode = adListId => {
                self.debugMessage('starting function switchPlayerToVpaidMode');
                const vpaidIframe = self.videoPlayerId + "_" + adListId + "_fluid_vpaid_iframe";
                const creativeData = {};
                creativeData.AdParameters = self.adPool[adListId].adParameters;
                const slotElement = document.createElement('div');
                slotElement.id = self.videoPlayerId + "_fluid_vpaid_slot";
                slotElement.className = 'fluid_vpaid_slot';
                slotElement.setAttribute('adListId', adListId);

                self.domRef.player.parentNode.insertBefore(slotElement, vpaidIframe.nextSibling);

                const environmentVars = {
                    slot: slotElement,
                    videoSlot: self.domRef.player,
                    videoSlotCanAutoPlay: true
                };

                // calls this functions after ad unit is loaded in iframe
                const ver = self.vpaidAdUnit.handshakeVersion(VPAID_VERSION);
                const compare = self.compareVersion(VPAID_VERSION, ver);
                if (compare === 1) {
                    //VPAID version of ad is lower than we need
                    self.adList[adListId].error = true;
                    self.playMainVideoWhenVpaidFails(403);
                    return false;
                }

                if (self.vastOptions.skipoffset !== false) {
                    self.addSkipButton();
                }

                self.domRef.player.loop = false;
                self.domRef.player.removeAttribute('controls'); //Remove the default Controls

                self.vpaidCallbackListenersAttach();
                const mode = (self.fullscreenMode ? 'fullscreen' : 'normal');
                const adWidth = self.domRef.player.offsetWidth;
                const adHeight = self.domRef.player.offsetHeight;
                self.vpaidAdUnit.initAd(adWidth, adHeight, mode, 3000, creativeData, environmentVars);

                const progressbarContainer = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_currentprogress');
                for (let i = 0; i < progressbarContainer.length; i++) {
                    progressbarContainer[i].style.backgroundColor = self.displayOptions.layoutControls.adProgressColor;
                }
                const progressCurrentMarker = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_currentpos');
                for (let i = 0; i < progressCurrentMarker.length; i++) {
                    progressCurrentMarker[i].style.backgroundColor = self.displayOptions.layoutControls.adProgressColor;
                }

                self.toggleLoader(false);
                self.adList[adListId].played = true;
                self.adFinished = false;
            };

            self.switchPlayerToVastMode = () => {
                //Get the actual duration from the video file if it is not present in the VAST XML
                if (!self.vastOptions.duration) {
                    self.vastOptions.duration = self.domRef.player.duration;
                }

                if (self.displayOptions.layoutControls.showCardBoardView) {

                    if (!self.adList[adListId].landingPage) {
                        self.addCTAButton(self.adPool[adListId].clickthroughUrl);
                    } else {
                        self.addCTAButton(self.adList[adListId].landingPage);
                    }

                } else {

                    const addClickthroughLayer = (typeof self.adList[adListId].adClickable != "undefined") ? self.adList[adListId].adClickable : self.displayOptions.vastOptions.adClickable;

                    if (addClickthroughLayer) {
                        self.addClickthroughLayer(self.videoPlayerId);
                    }

                    self.addCTAButton(self.adList[adListId].landingPage);

                }

                if (self.vastOptions.skipoffset !== false) {
                    self.addSkipButton();
                }

                self.domRef.player.loop = false;

                self.addAdCountdown();

                self.domRef.player.removeAttribute('controls'); //Remove the default Controls

                self.vastLogoBehaviour(true);

                const progressbarContainer = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_currentprogress');
                for (let i = 0; i < progressbarContainer.length; i++) {
                    progressbarContainer[i].style.backgroundColor = self.displayOptions.layoutControls.adProgressColor;
                }
                const progressCurrentMarker = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_currentpos');
                for (let i = 0; i < progressCurrentMarker.length; i++) {
                    progressCurrentMarker[i].style.backgroundColor = self.displayOptions.layoutControls.adProgressColor;
                }

                if (self.displayOptions.vastOptions.adText || self.adList[adListId].adText) {
                    const adTextToShow = (self.adList[adListId].adText !== null) ? self.adList[adListId].adText : self.displayOptions.vastOptions.adText;
                    self.addAdPlayingText(adTextToShow);
                }

                self.positionTextElements(self.adList[adListId]);

                self.toggleLoader(false);
                self.adList[adListId].played = true;
                self.adFinished = false;
                self.domRef.player.play();

                //Announce the impressions
                self.trackSingleEvent('impression');

                self.domRef.player.removeEventListener('loadedmetadata', self.switchPlayerToVastMode);

                // if in vr mode then do not show
                if (self.vrMode) {
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
                }
            };

            self.domRef.player.pause();

            // Remove the streaming objects to prevent errors on the VAST content
            self.detachStreamers();

            //Try to load multiple
            const selectedMediaFile = self.getSupportedMediaFileObject(self.vastOptions.mediaFileList);

            // if player in cardboard mode then, linear ads media type should be a '360' video
            if (self.displayOptions.layoutControls.showCardBoardView && self.adList[adListId].mediaType !== '360') {
                self.adList[adListId].error = true;
                self.playMainVideoWhenVastFails(403);
                return false;
            }

            const isVpaid = self.vastOptions.vpaid;

            if (!isVpaid) {
                if (selectedMediaFile.src === false) {
                    // Couldn’t find MediaFile that is supported by this video player, based on the attributes of the MediaFile element.
                    self.adList[adListId].error = true;
                    self.playMainVideoWhenVastFails(403);
                    return false;
                }

                self.domRef.player.addEventListener('loadedmetadata', self.switchPlayerToVastMode);

                self.domRef.player.src = selectedMediaFile.src;
                self.isCurrentlyPlayingAd = true;

                if (self.displayOptions.vastOptions.showProgressbarMarkers) {
                    self.hideAdMarkers();
                }

                self.domRef.player.load();

                //Handle the ending of the Pre-Roll ad
                self.domRef.player.addEventListener('ended', self.onVastAdEnded);

            } else {
                self.loadVpaid(adListId, selectedMediaFile.src);

                if (self.displayOptions.vastOptions.showProgressbarMarkers) {
                    self.hideAdMarkers();
                }
            }
        };

        /**
         * Sends requests to the tracking URIs
         */
        const videoPlayerTimeUpdate = () => {
            if (self.adFinished) {
                self.domRef.player.removeEventListener('timeupdate', videoPlayerTimeUpdate);
                return;
            }

            const currentTime = Math.floor(self.domRef.player.currentTime);
            if (self.vastOptions.duration !== 0) {
                self.scheduleTrackingEvent(currentTime, self.vastOptions.duration);
            }

            if (currentTime >= (self.vastOptions.duration - 1) && self.vastOptions.duration !== 0) {
                self.domRef.player.removeEventListener('timeupdate', videoPlayerTimeUpdate);
                self.adFinished = true;
            }

        };

        playVideoPlayer(adListId);

        self.domRef.player.addEventListener('timeupdate', videoPlayerTimeUpdate);

    };

    self.playRoll = (adListId) => {
        // register all the ad pods
        for (let i = 0; i < adListId.length; i++) {
            if (!self.adPool.hasOwnProperty(adListId[i])) {
                self.announceLocalError(101);
                return;
            }
            self.temporaryAdPods.push(self.adList[adListId[i]]);
        }

        if (self.vastOptions !== null && self.vastOptions.adType.toLowerCase() === 'linear') {
            return;
        }

        const adListIdToPlay = self.getNextAdPod();

        if (adListIdToPlay !== null) {
            self.renderLinearAd(adListIdToPlay, true);
        }
    };

    self.backupMainVideoContentTime = (adListId) => {
        const roll = self.adList[adListId].roll;

        //spec configs by roll
        switch (roll) {
            case 'midRoll':
                self.domRef.player.mainVideoCurrentTime = self.domRef.player.currentTime - 1;
                break;

            case 'postRoll':
                self.domRef.player.mainVideoCurrentTime = self.mainVideoDuration;
                self.autoplayAfterAd = false;
                self.domRef.player.currentTime = self.mainVideoDuration;
                break;

            case 'preRoll':
                if (self.domRef.player.currentTime > 0) {
                    self.domRef.player.mainVideoCurrentTime = self.domRef.player.currentTime - 1;
                }
                break;
        }
    };

    self.getSupportedMediaFileObject = (mediaFiles) => {
        let selectedMediaFile = null;
        let adSupportedType = false;
        if (mediaFiles.length) {
            for (let i = 0; i < mediaFiles.length; i++) {

                if (mediaFiles[i].apiFramework !== 'VPAID') {
                    const supportLevel = self.getMediaFileTypeSupportLevel(mediaFiles[i]['type']);

                    if (supportLevel === 'maybe' || supportLevel === 'probably') {
                        selectedMediaFile = mediaFiles[i];
                        adSupportedType = true;
                    }

                    //one of the best(s) option, no need to seek more
                    if (supportLevel === 'probably') {
                        break;
                    }

                } else {
                    selectedMediaFile = mediaFiles[i];
                    adSupportedType = true;
                    break;
                }
            }
        }

        if (adSupportedType === false) {
            return false;
        }

        return selectedMediaFile;
    };

    /**
     * Reports how likely it is that the current browser will be able to play media of a given MIME type.
     * @return string|null "probably", "maybe", "no" or null
     */
    self.getMediaFileTypeSupportLevel = (mediaType) => {
        if (null === mediaType) {
            return null;
        }

        const tmpVideo = document.createElement('video');
        let response = tmpVideo.canPlayType(mediaType);

        return !response ? "no" : response;
    };

    self.scheduleTrackingEvent = (currentTime, duration) => {
        if (currentTime === 0) {
            self.trackSingleEvent('start');
        }

        if ((typeof self.vastOptions.tracking['progress'] !== 'undefined') &&
            (self.vastOptions.tracking['progress'].length) &&
            (typeof self.vastOptions.tracking['progress'][currentTime] !== 'undefined')) {

            self.trackSingleEvent('progress', currentTime);
        }

        if (currentTime === (Math.floor(duration / 4))) {
            self.trackSingleEvent('firstQuartile');
        }

        if (currentTime === (Math.floor(duration / 2))) {
            self.trackSingleEvent('midpoint');
        }

        if (currentTime === (Math.floor(duration * 3 / 4))) {
            self.trackSingleEvent('thirdQuartile');
        }

        if (currentTime >= (duration - 1)) {
            self.trackSingleEvent('complete');
        }
    };


    // ADS
    self.trackSingleEvent = (eventType, eventSubType) => {
        if (typeof self.vastOptions === 'undefined' || self.vastOptions === null) {
            return;
        }

        let trackingUris = [];
        trackingUris.length = 0;

        switch (eventType) {
            case 'start':
            case 'firstQuartile':
            case 'midpoint':
            case 'thirdQuartile':
            case 'complete':
                if (self.vastOptions.stopTracking[eventType] === false) {
                    if (self.vastOptions.tracking[eventType] !== null) {
                        trackingUris = self.vastOptions.tracking[eventType];
                    }

                    self.vastOptions.stopTracking[eventType] = true;
                }
                break;

            case 'progress':
                self.vastOptions.tracking['progress'][eventSubType].elements.forEach(function (currentValue, index) {
                    if (
                        (self.vastOptions.tracking['progress'][eventSubType].stopTracking === false) &&
                        (self.vastOptions.tracking['progress'][eventSubType].elements.length)
                    ) {
                        trackingUris = self.vastOptions.tracking['progress'][eventSubType].elements;
                    }

                    self.vastOptions.tracking['progress'][eventSubType].stopTracking = true;
                });
                break;

            case 'impression':
                if (
                    (typeof self.vastOptions.impression !== 'undefined') &&
                    (self.vastOptions.impression !== null) &&
                    (typeof self.vastOptions.impression.length !== 'undefined')
                ) {
                    trackingUris = self.vastOptions.impression;
                }
                break;

            default:
                break;
        }

        self.callUris(trackingUris);
    };

    // ADS
    self.completeNonLinearStatic = (adListId) => {
        self.closeNonLinear(adListId);
        if (self.adFinished === false) {
            self.adFinished = true;
            self.trackSingleEvent('complete');
        }
        clearInterval(self.nonLinearTracking);
    };

    // ADS
    /**
     * Show up a nonLinear static creative
     */
    self.createNonLinearStatic = (adListId) => {
        if (!self.adPool.hasOwnProperty(adListId) || self.adPool[adListId].error === true) {
            self.announceLocalError(101);
            return;
        }

        //get the proper ad
        self.vastOptions = self.adPool[adListId];
        self.createBoard(adListId);
        if (self.adList[adListId].error === true) {
            return;
        }
        self.adFinished = false;
        let duration;
        if (!self.vastOptions.vpaid) {
            self.trackSingleEvent('start');
            duration = (self.adList[adListId].nonLinearDuration) ? self.adList[adListId].nonLinearDuration : self.vastOptions.duration;

            self.nonLinearTracking = setInterval(function () {
                if (self.adFinished === true) {
                    return;
                }

                const currentTime = Math.floor(self.domRef.player.currentTime);
                self.scheduleTrackingEvent(currentTime, duration);
                if (currentTime >= (duration - 1)) {
                    self.adFinished = true;
                }
            }, 400);
        }

        const time = parseInt(self.getCurrentTime()) + parseInt(duration);
        self.scheduleTask({ time: time, closeStaticAd: adListId });
    };

    // ADS
    self.createVpaidNonLinearBoard = (adListId) => {
        // create iframe
        // pass the js

        const vastSettings = self.adPool[adListId];

        self.loadVpaidNonlinearAssets = function (adListId) {

            self.debugMessage('starting function switchPlayerToVpaidMode');

            const vAlign = (self.adList[adListId].vAlign) ? self.adList[adListId].vAlign : self.nonLinearVerticalAlign;
            const showCloseButton = (self.adList[adListId].vpaidNonLinearCloseButton) ? self.adList[adListId].vpaidNonLinearCloseButton : self.vpaidNonLinearCloseButton;
            const vpaidIframe = self.videoPlayerId + "_" + adListId + "_fluid_vpaid_iframe";
            const creativeData = {};
            creativeData.AdParameters = self.adPool[adListId].adParameters;
            const slotWrapper = document.createElement('div');
            slotWrapper.id = 'fluid_vpaidNonLinear_' + adListId;
            slotWrapper.className = 'fluid_vpaidNonLinear_' + vAlign;
            slotWrapper.className += ' fluid_vpaidNonLinear_ad';
            slotWrapper.setAttribute('adListId', adListId);

            // Default values in case nothing defined in VAST data or ad settings
            let adWidth = Math.min(468, self.domRef.player.offsetWidth);
            let adHeight = Math.min(60, Math.floor(self.domRef.player.offsetHeight / 4));

            if (typeof self.adList[adListId].size !== 'undefined') {
                const dimensions = self.adList[adListId].size.split('x');
                adWidth = dimensions[0];
                adHeight = dimensions[1];
            } else if (vastSettings.dimension.width && vastSettings.dimension.height) {
                adWidth = vastSettings.dimension.width;
                adHeight = vastSettings.dimension.height;
            }

            slotWrapper.style.width = '100%';
            slotWrapper.style.height = adHeight + 'px';

            let slotFrame;
            if (showCloseButton) {
                const slotFrame = document.createElement('div');
                slotFrame.className = 'fluid_vpaidNonLinear_frame';
                slotFrame.style.width = adWidth + 'px';
                slotFrame.style.height = adHeight + 'px';
                slotWrapper.appendChild(slotFrame);

                const closeBtn = document.createElement('div');
                closeBtn.id = 'close_button_' + self.videoPlayerId;
                closeBtn.className = 'close_button';
                closeBtn.innerHTML = '';
                closeBtn.title = self.displayOptions.layoutControls.closeButtonCaption;
                const tempadListId = adListId;
                closeBtn.onclick = function (event) {

                    self.hardStopVpaidAd('');

                    if (typeof event.stopImmediatePropagation !== 'undefined') {
                        event.stopImmediatePropagation();
                    }
                    self.adFinished = true;

                    //if any other onPauseRoll then render it
                    if (self.adList[tempadListId].roll === 'onPauseRoll' && self.onPauseRollAdPods[0]) {
                        const getNextOnPauseRollAd = self.onPauseRollAdPods[0];
                        self.createBoard(getNextOnPauseRollAd);
                        self.currentOnPauseRollAd = self.onPauseRollAdPods[0];
                        delete self.onPauseRollAdPods[0];
                    }

                    return false;
                };

                slotFrame.appendChild(closeBtn);

            }

            const slotIframe = document.createElement('iframe');
            slotIframe.id = self.videoPlayerId + "non_linear_vapid_slot_iframe";
            slotIframe.className = 'fluid_vpaid_nonlinear_slot_iframe';
            slotIframe.setAttribute('width', adWidth + 'px');
            slotIframe.setAttribute('height', adHeight + 'px');
            slotIframe.setAttribute('sandbox', 'allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts');
            slotIframe.setAttribute('frameborder', '0');
            slotIframe.setAttribute('scrolling', 'no');
            slotIframe.setAttribute('marginwidth', '0');
            slotIframe.setAttribute('marginheight', '0');
            slotWrapper.appendChild(slotIframe);

            self.domRef.player.parentNode.insertBefore(slotWrapper, vpaidIframe.nextSibling);

            const slotElement = slotIframe.contentWindow.document.createElement('div');

            slotIframe.contentWindow.document.body.appendChild(slotElement);

            self.vastOptions.slotIframe = slotIframe;
            self.vastOptions.slotFrame = slotFrame;

            const environmentVars = {
                slot: slotElement,
                videoSlot: self.domRef.player,
                videoSlotCanAutoPlay: true
            };

            self.debugMessage(self.adList[adListId]);

            // calls this functions after ad unit is loaded in iframe
            const ver = self.vpaidAdUnit.handshakeVersion(VPAID_VERSION);
            const compare = self.compareVersion(VPAID_VERSION, ver);
            if (compare === 1) {
                //VPAID version of ad is lower than we need
                self.adList[adListId].error = true;
                self.playMainVideoWhenVpaidFails(403);
                return false;
            }

            self.domRef.player.loop = false;
            self.domRef.player.removeAttribute('controls'); //Remove the default Controls

            self.vpaidCallbackListenersAttach();
            const mode = (self.fullscreenMode ? 'fullscreen' : 'normal');
            self.vpaidAdUnit.initAd(adWidth, adHeight, mode, 3000, creativeData, environmentVars);

            self.toggleLoader(false);
            self.adList[adListId].played = true;
            self.adFinished = false;
        };

        self.loadVpaid(adListId, vastSettings.staticResource);

        self.debugMessage('create non linear vpaid');
    };

    // ADS
    self.createNonLinearBoard = (adListId) => {
        const vastSettings = self.adPool[adListId];

        self.adList[adListId].played = true;
        const playerWidth = self.domRef.player.clientWidth;
        const playerHeight = self.domRef.player.clientHeight;
        const board = document.createElement('div');
        const vAlign = (self.adList[adListId].vAlign) ? self.adList[adListId].vAlign : self.nonLinearVerticalAlign;

        const creative = new Image();
        creative.src = vastSettings.staticResource;
        creative.id = 'fluid_nonLinear_imgCreative_' + adListId + '_' + self.videoPlayerId;

        creative.onerror = function () {
            self.adList[adListId].error = true;
            self.announceError(500);
        };

        creative.onload = function () {
            let origWidth;
            let origHeight;
            let newBannerWidth;
            let newBannerHeight;

            //Set banner size based on the below priority
            // 1. adList -> roll -> size
            // 2. VAST XML width/height attriubute (VAST 3.)
            // 3. VAST XML static resource dimension
            if (typeof self.adList[adListId].size !== 'undefined') {
                origWidth = self.adList[adListId].size.split('x')[0];
                origHeight = self.adList[adListId].size.split('x')[1];
            } else if (vastSettings.dimension.width && vastSettings.dimension.height) {
                origWidth = vastSettings.dimension.width;
                origHeight = vastSettings.dimension.height;
            } else {
                origWidth = creative.width;
                origHeight = creative.height;
            }

            if (origWidth > playerWidth) {
                newBannerWidth = playerWidth - 5;
                newBannerHeight = origHeight * newBannerWidth / origWidth;
            } else {
                newBannerWidth = origWidth;
                newBannerHeight = origHeight;
            }

            if (self.adList[adListId].roll !== 'onPauseRoll') {
                //Show the board only if media loaded
                document.getElementById('fluid_nonLinear_' + adListId).style.display = '';
            }

            const img = document.getElementById(creative.id);
            img.width = newBannerWidth;
            img.height = newBannerHeight;

            self.trackSingleEvent('impression');
        };

        board.id = 'fluid_nonLinear_' + adListId;
        board.className = 'fluid_nonLinear_' + vAlign;
        board.className += ' fluid_nonLinear_ad';
        board.innerHTML = creative.outerHTML;
        board.style.display = 'none';

        //Bind the Onclick event
        board.onclick = function () {
            if (typeof vastSettings.clickthroughUrl !== 'undefined') {
                window.open(vastSettings.clickthroughUrl);
            }

            //Tracking the NonLinearClickTracking events
            if (typeof vastSettings.clicktracking !== 'undefined') {
                self.callUris([vastSettings.clicktracking]);
            }
        };

        if (typeof vastSettings.clickthroughUrl !== 'undefined') {
            board.style.cursor = 'pointer';
        }

        const closeBtn = document.createElement('div');
        closeBtn.id = 'close_button_' + self.videoPlayerId;
        closeBtn.className = 'close_button';
        closeBtn.innerHTML = '';
        closeBtn.title = self.displayOptions.layoutControls.closeButtonCaption;
        const tempadListId = adListId;
        closeBtn.onclick = function (event) {
            this.parentElement.remove();
            if (typeof event.stopImmediatePropagation !== 'undefined') {
                event.stopImmediatePropagation();
            }
            self.adFinished = true;
            clearInterval(self.nonLinearTracking);

            //if any other onPauseRoll then render it
            if (self.adList[tempadListId].roll === 'onPauseRoll' && self.onPauseRollAdPods[0]) {
                const getNextOnPauseRollAd = self.onPauseRollAdPods[0];
                self.createBoard(getNextOnPauseRollAd);
                self.currentOnPauseRollAd = self.onPauseRollAdPods[0];
                delete self.onPauseRollAdPods[0];
            }

            return false;
        };

        board.appendChild(closeBtn);
        self.domRef.player.parentNode.insertBefore(board, self.domRef.player.nextSibling);
    };

    // ADS
    /**
     * Adds a nonLinear static Image banner
     *
     * currently only image/gif, image/jpeg, image/png supported
     */
    self.createBoard = (adListId) => {
        const vastSettings = self.adPool[adListId];

        // create nonLinear Vpaid
        // create nonLinear regular
        if (vastSettings.vpaid) {
            self.hardStopVpaidAd('');
            self.createVpaidNonLinearBoard(adListId);

        } else {

            if (typeof vastSettings.staticResource === 'undefined'
                || self.supportedStaticTypes.indexOf(vastSettings.creativeType) === -1) {
                //Couldn’t find NonLinear resource with supported type.
                self.adList[adListId].error = true;
                if (!self.vastOptions || typeof self.vastOptions.errorUrl === 'undefined') {
                    self.announceLocalError(503);
                } else {
                    self.announceError(503);
                }
                return;
            }

            self.createNonLinearBoard(adListId);

        }

    };

    self.closeNonLinear = (adListId) => {
        const element = document.getElementById('fluid_nonLinear_' + adListId);
        if (element) {
            element.remove();
        }
    };

    self.rollGroupContainsLinear = (groupedRolls) => {
        let found = false;
        for (let i = 0; i < groupedRolls.length; i++) {
            if (self.adList[groupedRolls[i].id].adType && self.adList[groupedRolls[i].id].adType === 'linear') {
                found = true;
                break;
            }
        }
        return found;
    };
    self.rollGroupContainsNonlinear = (groupedRolls) => {
        let found = false;
        for (let i = 0; i < groupedRolls.length; i++) {
            if (self.adList[groupedRolls[i].id].adType.toLowerCase() === 'nonlinear') {
                found = true;
                break;
            }
        }
        return found;
    };

    self.preRollFail = () => {
        const preRollsLength = self.preRollAdPodsLength;

        self.preRollVastResolved++;

        if (self.preRollVastResolved === preRollsLength) {
            self.preRollAdsPlay();
        }
    };

    self.preRollSuccess = () => {
        const preRollsLength = self.preRollAdPodsLength;

        self.preRollVastResolved++;

        if (self.preRollVastResolved === preRollsLength) {
            self.preRollAdsPlay();
        }
    };

    self.preRollAdsPlay = () => {
        const time = 0;
        const adListIds = self.preRollAdPods;
        const adsByType = {
            linear: [],
            nonLinear: []
        };

        self.firstPlayLaunched = true;

        for (let index = 0; index < adListIds.length; index++) {

            if (self.adList[adListIds[index]].played === true) {
                return
            }

            if (self.adList[adListIds[index]].adType === 'linear') {
                adsByType.linear.push(adListIds[index]);
            }

            if (self.adList[adListIds[index]].adType === 'nonLinear') {
                adsByType.nonLinear.push(adListIds[index]);
                self.scheduleTask({ time: time, playRoll: 'midRoll', adListId: adsByType.nonLinear.shift() });
            }
        }

        if (adsByType.linear.length > 0) {
            self.toggleLoader(true);
            self.playRoll(adsByType.linear);
        } else {
            self.playMainVideoWhenVastFails(900);
        }

    };

    self.preRoll = (event) => {
        const vastObj = event.vastObj;
        self.domRef.player.removeEventListener(event.type, self.preRoll);

        const adListId = [];
        adListId[0] = event.type.replace('adId_', '');
        const time = 0;

        if (self.adList[adListId[0]].played === true) {
            return;
        }

        self.preRollAdPods.push(adListId[0]);

        self.preRollSuccess(vastObj);
    };

    self.createAdMarker = (adListId, time) => {
        const markersHolder = document.getElementById(self.videoPlayerId + '_ad_markers_holder');
        const adMarker = document.createElement('div');
        adMarker.id = 'ad_marker_' + self.videoPlayerId + "_" + adListId;
        adMarker.className = 'fluid_controls_ad_marker';
        adMarker.style.left = (time / self.mainVideoDuration * 100) + '%';
        if (self.isCurrentlyPlayingAd) {
            adMarker.style.display = 'none';
        }
        markersHolder.appendChild(adMarker);
    };

    self.hideAdMarker = (adListId) => {
        const element = document.getElementById('ad_marker_' + self.videoPlayerId + "_" + adListId);
        if (element) {
            element.style.display = 'none';
        }
    };

    self.showAdMarkers = () => {
        const markersHolder = document.getElementById(self.videoPlayerId + '_ad_markers_holder');
        const adMarkers = markersHolder.getElementsByClassName('fluid_controls_ad_marker');
        const idPrefix = 'ad_marker_' + self.videoPlayerId + "_";
        for (let i = 0; i < adMarkers.length; ++i) {
            const item = adMarkers[i];
            const adListId = item.id.replace(idPrefix, '');
            if (self.adList[adListId].played === false) {
                item.style.display = '';
            }
        }
    };

    self.hideAdMarkers = () => {
        const markersHolder = document.getElementById(self.videoPlayerId + '_ad_markers_holder');
        const adMarkers = markersHolder.getElementsByClassName('fluid_controls_ad_marker');
        for (let i = 0; i < adMarkers.length; ++i) {
            const item = adMarkers[i];
            item.style.display = 'none';
        }
    };

    self.midRoll = (event) => {
        self.domRef.player.removeEventListener(event.type, self.midRoll);

        const adListId = event.type.replace('adId_', '');
        if (self.adList[adListId].played === true) {
            return;
        }

        let time = self.adList[adListId].timer;

        if (typeof time == 'string' && time.indexOf("%") !== -1) {
            time = time.replace('%', '');
            time = Math.floor(self.mainVideoDuration / 100 * time);
        }

        if (self.displayOptions.vastOptions.showProgressbarMarkers &&
            self.adList[adListId].adType === "nonLinear") {
            self.createAdMarker(adListId, time);
        }

        self.scheduleTask({ time: time, playRoll: 'midRoll', adListId: adListId });
    };

    self.postRoll = (event) => {
        self.domRef.player.removeEventListener(event.type, self.postRoll);
        const adListId = event.type.replace('adId_', '');
        self.scheduleTask({
            time: Math.floor(self.mainVideoDuration),
            playRoll: 'postRoll',
            adListId: adListId
        });
    };

    self.onPauseRoll = (event) => {
        self.domRef.player.removeEventListener(event.type, self.onPauseRoll);
        const adListId = event.type.replace('adId_', '');

        if (self.adList[adListId].adType === 'nonLinear') {
            if (!self.adPool.hasOwnProperty(adListId) || self.adPool[adListId].error === true) {
                self.announceLocalError(101);
                return;
            }

            const nonLinearAdExists = document.getElementsByClassName('fluid_nonLinear_ad')[0];
            if (!nonLinearAdExists) {
                self.createBoard(adListId);
                self.currentOnPauseRollAd = adListId;
                let onPauseAd = document.getElementById('fluid_nonLinear_' + adListId);
                if (onPauseAd) {
                    onPauseAd.style.display = 'none';
                }
            } else {
                self.onPauseRollAdPods.push(adListId);
            }

        }
    };

    /**
     * Check if player has a valid nonLinear onPause Ad
     */
    self.hasValidOnPauseAd = () => {
        // TODO should be only one. Add validator to allow only one onPause roll
        const onPauseAd = self.findRoll('onPauseRoll');

        return (onPauseAd.length !== 0 && self.adList[onPauseAd[0]] && self.adList[onPauseAd[0]].error === false);
    };

    /**
     * Hide/show nonLinear onPause Ad
     */
    self.toggleOnPauseAd = () => {
        if (self.hasValidOnPauseAd() && !self.isCurrentlyPlayingAd) {
            const onPauseRoll = self.findRoll('onPauseRoll');
            let adListId;
            if (self.currentOnPauseRollAd !== '') {
                adListId = self.currentOnPauseRollAd;
            } else {
                adListId = onPauseRoll[0];
            }

            self.vastOptions = self.adPool[adListId];
            const onPauseAd = document.getElementById('fluid_nonLinear_' + adListId);

            if (onPauseAd && self.domRef.player.paused) {
                setTimeout(function () {
                    onPauseAd.style.display = 'flex';
                    self.adList[adListId].played = false;
                    self.trackingOnPauseNonLinearAd(adListId, 'start');
                }, 500);
            } else if (onPauseAd && !self.domRef.player.paused) {
                onPauseAd.style.display = 'none';
                self.adFinished = true;
                self.trackingOnPauseNonLinearAd(adListId, 'complete');
            }
        }
    };

    /**
     * Helper function for tracking onPause Ads
     */
    self.trackingOnPauseNonLinearAd = (adListId, status) => {
        if (!self.adPool.hasOwnProperty(adListId) || self.adPool[adListId].error === true) {
            self.announceLocalError(101);
            return;
        }

        self.vastOptions = self.adPool[adListId];
        self.trackSingleEvent(status);
    };

    self.getLinearAdsFromKeyTime = (keyTimeLinearObj) => {
        const adListIds = [];

        for (let i = 0; i < keyTimeLinearObj.length; i++) {
            if (self.adList[keyTimeLinearObj[i].adListId].played === false) {
                adListIds.push(keyTimeLinearObj[i].adListId);
            }
        }

        return adListIds;
    };

    self.adKeytimePlay = (keyTime) => {
        if (!self.timerPool[keyTime] || self.isCurrentlyPlayingAd) {
            return;
        }

        const timerPoolKeytimeCloseStaticAdsLength = self.timerPool[keyTime]['closeStaticAd'].length;
        const timerPoolKeytimeLinearAdsLength = self.timerPool[keyTime]['linear'].length;
        const timerPoolKeytimeNonlinearAdsLength = self.timerPool[keyTime]['nonLinear'].length;

        // remove the item from keytime if no ads to play
        if (timerPoolKeytimeCloseStaticAdsLength === 0 && timerPoolKeytimeLinearAdsLength === 0 && timerPoolKeytimeNonlinearAdsLength === 0) {
            delete self.timerPool[keyTime];
            return;
        }

        // Task: close nonLinear ads
        if (timerPoolKeytimeCloseStaticAdsLength > 0) {
            for (let index = 0; index < timerPoolKeytimeCloseStaticAdsLength; index++) {
                const adListId = self.timerPool[keyTime]['closeStaticAd'][index].closeStaticAd;
                if (self.adList[adListId].played === true) {
                    self.completeNonLinearStatic(adListId);
                }
            }

            // empty closeStaticAd from the timerpool after closing
            self.timerPool[keyTime]['closeStaticAd'] = [];
        }

        // Task: play linear ads
        if (timerPoolKeytimeLinearAdsLength > 0) {
            const adListIds = self.getLinearAdsFromKeyTime(self.timerPool[keyTime]['linear']);
            if (adListIds.length > 0) {
                self.playRoll(adListIds);

                // empty the linear ads from the timerpool after played
                self.timerPool[keyTime]['linear'] = [];

                // return after starting video ad, so non-linear will not overlap
                return;
            }
        }

        // Task: play nonLinear ads
        if (timerPoolKeytimeNonlinearAdsLength > 0) {
            for (let index = 0; index < timerPoolKeytimeNonlinearAdsLength; index++) {
                const adListId = self.timerPool[keyTime]['nonLinear'][index].adListId;
                const vastOptions = self.adPool[adListId];

                // we are not supporting nonLinear ads in cardBoard mode
                if (self.adList[adListId].played === false && !self.displayOptions.layoutControls.showCardBoardView) {
                    self.createNonLinearStatic(adListId);
                    if (self.displayOptions.vastOptions.showProgressbarMarkers) {
                        self.hideAdMarker(adListId);
                    }

                    // delete nonLinear after playing
                    self.timerPool[keyTime]['nonLinear'].splice(index, 1);

                    // return after starting non-linear ad, so multiple non-linear will not overlap
                    // unplayed non-linear will appear if user seeks back to the time :)
                    return;
                }
            }
        }

    };

    self.adTimer = () => {
        if (!!self.isTimer) {
            return;
        }

        self.isTimer = !self.isTimer;

        self.timer = setInterval(
            function () {
                const keyTime = Math.floor(self.getCurrentTime());
                self.adKeytimePlay(keyTime)
            }, 800);
    };

    // ADS
    self.scheduleTask = (task) => {
        if (!self.timerPool.hasOwnProperty(task.time)) {
            self.timerPool[task.time] = { linear: [], nonLinear: [], closeStaticAd: [] };
        }

        if (task.hasOwnProperty('playRoll') && self.adList[task.adListId].adType === 'linear') {
            self.timerPool[task.time]['linear'].push(task);
        } else if (task.hasOwnProperty('playRoll') && self.adList[task.adListId].adType === 'nonLinear') {
            self.timerPool[task.time]['nonLinear'].push(task);
        } else if (task.hasOwnProperty('closeStaticAd')) {
            self.timerPool[task.time]['closeStaticAd'].push(task);
        }

    };

    // ADS
    self.switchToMainVideo = () => {
        self.debugMessage('starting main video');

        self.domRef.player.src = self.originalSrc;

        self.initialiseStreamers();

        const newCurrentTime = (typeof self.domRef.player.mainVideoCurrentTime !== 'undefined')
            ? self.domRef.player.mainVideoCurrentTime : 0;

        if (self.domRef.player.hasOwnProperty('currentTime')) {
            self.domRef.player.currentTime = newCurrentTime;
        }

        self.loop.apply();

        self.setCurrentTimeAndPlay(newCurrentTime, self.autoplayAfterAd);

        self.isCurrentlyPlayingAd = false;

        self.deleteVastAdElements();

        self.adFinished = true;
        self.displayOptions.vastOptions.vastAdvanced.vastVideoEndedCallback();
        self.vastOptions = null;

        self.setBuffering();
        const progressbarContainer = self.domRef.controls.progressContainer;

        if (progressbarContainer !== null) {
            const backgroundColor = (self.displayOptions.layoutControls.primaryColor) ? self.displayOptions.layoutControls.primaryColor : '#f00';

            const currentProgressBar = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_currentprogress');
            for (let i = 0; i < currentProgressBar.length; i++) {
                currentProgressBar[i].style.backgroundColor = backgroundColor;
            }
            const progressCurrentMarker = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_currentpos');
            for (let i = 0; i < progressCurrentMarker.length; i++) {
                progressCurrentMarker[i].style.backgroundColor = backgroundColor;
            }
        }

        self.domRef.player.removeEventListener('ended', self.onVastAdEnded);

        if (self.displayOptions.vastOptions.showProgressbarMarkers) {
            self.showAdMarkers();
        }

        if (self.hasTitle()) {
            const title = document.getElementById(self.videoPlayerId + '_title');
            title.style.display = 'inline';
        }
    };

    // ADS
    self.getNextAdPod = () => {
        const getFirstUnPlayedAd = false;
        let adListId = null;

        // if temporaryAdPods is not empty
        if (self.temporaryAdPods.length > 0) {
            const temporaryAdPods = self.temporaryAdPods.shift();
            adListId = temporaryAdPods.id;
        }

        return adListId;
    };

    // ADS
    self.checkForNextAd = () => {
        const availableNextAdID = self.getNextAdPod();
        if (availableNextAdID === null) {
            self.switchToMainVideo();
            self.vastOptions = null;
            self.adFinished = true;
        } else {
            self.domRef.player.removeEventListener('ended', self.onVastAdEnded);
            self.isCurrentlyPlayingAd = false;
            self.vastOptions = null;
            self.adFinished = true;
            self.renderLinearAd(availableNextAdID, false); // passing false so it doesn't backup the Ad playbacktime as video playback time
        }
    };


    /**
     * Adds a Skip Button
     */
    self.addSkipButton = () => {
        // TODO: ahh yes, the DIVbutton...
        const divSkipButton = document.createElement('div');
        divSkipButton.id = 'skip_button_' + self.videoPlayerId;
        divSkipButton.className = 'skip_button skip_button_disabled';
        divSkipButton.innerHTML = self.displayOptions.vastOptions.skipButtonCaption.replace('[seconds]', self.vastOptions.skipoffset);

        self.domRef.wrapper.appendChild(divSkipButton);

        self.domRef.player.addEventListener('timeupdate', self.decreaseSkipOffset, false);
    };

    /**
     * Ad Countdown
     */
    self.addAdCountdown = () => {
        const videoWrapper = self.domRef.wrapper;
        const divAdCountdown = document.createElement('div');

        // Create element
        const adCountdown = self.pad(parseInt(self.currentVideoDuration / 60)) + ':' + self.pad(parseInt(self.currentVideoDuration % 60));
        const durationText = parseInt(adCountdown);
        divAdCountdown.id = 'ad_countdown' + self.videoPlayerId;
        divAdCountdown.className = 'ad_countdown';
        divAdCountdown.innerHTML = "<span class='ad_timer_prefix'>Ad - </span>" + durationText;

        videoWrapper.appendChild(divAdCountdown);

        self.domRef.player.addEventListener('timeupdate', self.decreaseAdCountdown, false);
        videoWrapper.addEventListener('mouseover', function () {
            divAdCountdown.style.display = 'none';
        }, false);
    };

    self.decreaseAdCountdown = function decreaseAdCountdown() {
        const sec = parseInt(self.currentVideoDuration) - parseInt(self.domRef.player.currentTime);
        const btn = document.getElementById('ad_countdown' + self.videoPlayerId);

        if (btn) {
            btn.innerHTML = "<span class='ad_timer_prefix'>Ad - </span> " + self.pad(parseInt(sec / 60)) + ':' + self.pad(parseInt(sec % 60));
        } else {
            self.domRef.player.removeEventListener('timeupdate', self.decreaseAdCountdown);
        }
    };

    self.removeAdCountdown = () => {
        const btn = document.getElementById('ad_countdown' + self.videoPlayerId);
        if (btn) {
            btn.parentElement.removeChild(btn);
        }
    };

    self.toggleAdCountdown = (showing) => {
        const btn = document.getElementById('ad_countdown' + self.videoPlayerId);
        if (btn) {
            if (showing) {
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        }
    };

    self.addAdPlayingText = (textToShow) => {
        const adPlayingDiv = document.createElement('div');
        adPlayingDiv.id = self.videoPlayerId + '_fluid_ad_playing';

        if (self.displayOptions.layoutControls.primaryColor) {
            adPlayingDiv.style.backgroundColor = self.displayOptions.layoutControls.primaryColor;
            adPlayingDiv.style.opacity = 1;
        }

        adPlayingDiv.className = 'fluid_ad_playing';
        adPlayingDiv.innerText = textToShow;

        self.domRef.wrapper.appendChild(adPlayingDiv);
    };

    self.positionTextElements = (adListData) => {
        const allowedPosition = ['top left', 'top right', 'bottom left', 'bottom right'];

        const skipButton = document.getElementById('skip_button_' + self.videoPlayerId);
        const adPlayingDiv = document.getElementById(self.videoPlayerId + '_fluid_ad_playing');
        const ctaButton = document.getElementById(self.videoPlayerId + '_fluid_cta');

        let ctaButtonHeightWithSpacing = 0;
        let adPlayingDivHeightWithSpacing = 0;
        const pixelSpacing = 8;
        let isBottom = false;
        let skipButtonHeightWithSpacing = 0;
        let positionsCTA = [];

        const defaultPositions = {
            top: {
                left: { h: 34, v: 34 },
                right: { h: 0, v: 34 }
            },
            bottom: {
                left: { h: 34, v: 50 },
                right: { h: 0, v: 50 }
            }
        };

        if (skipButton !== null) {
            skipButtonHeightWithSpacing = skipButton.offsetHeight + pixelSpacing;

            const wrapperElement = self.domRef.wrapper;

            if (wrapperElement.classList.contains('mobile')) {
                defaultPositions.bottom.left.v = 75;
                defaultPositions.bottom.right.v = 75;
            }
        }

        let CTATextPosition;
        if (ctaButton !== null) {
            CTATextPosition = self.displayOptions.vastOptions.adCTATextPosition.toLowerCase();

            if (allowedPosition.indexOf(CTATextPosition) === -1) {
                console.log('[FP Error] Invalid position for CTAText. Reverting to "bottom right"');
                CTATextPosition = 'bottom right';
            }

            positionsCTA = CTATextPosition.split(' ');

            isBottom = positionsCTA[0] === 'bottom';

            ctaButton.style[positionsCTA[0]] = defaultPositions[positionsCTA[0]][positionsCTA[1]].v + 'px';
            ctaButton.style[positionsCTA[1]] = defaultPositions[positionsCTA[0]][positionsCTA[1]].h + 'px';

            if (isBottom && positionsCTA[1] === 'right') {
                ctaButton.style[positionsCTA[0]] = defaultPositions[positionsCTA[0]][positionsCTA[1]].v + skipButtonHeightWithSpacing + 'px';
            }

            ctaButtonHeightWithSpacing = ctaButton.offsetHeight + pixelSpacing + 'px';
        }

        let adPlayingDivPosition;
        let positionsAdText;
        if (adPlayingDiv !== null) {
            adPlayingDivPosition = (adListData.adTextPosition !== null) ? adListData.adTextPosition.toLowerCase() : self.displayOptions.vastOptions.adTextPosition.toLowerCase();

            if (allowedPosition.indexOf(adPlayingDivPosition) === -1) {
                console.log('[FP Error] Invalid position for adText. Reverting to "top left"');
                adPlayingDivPosition = 'top left';
            }

            positionsAdText = adPlayingDivPosition.split(' ');
            adPlayingDiv.style[positionsAdText[0]] = defaultPositions[positionsAdText[0]][positionsAdText[1]].v + 'px';
            adPlayingDiv.style[positionsAdText[1]] = defaultPositions[positionsAdText[0]][positionsAdText[1]].h + 'px';
            adPlayingDivHeightWithSpacing = adPlayingDiv.offsetHeight + pixelSpacing + 'px';
        }

        if (ctaButtonHeightWithSpacing > 0 && adPlayingDivHeightWithSpacing > 0 && CTATextPosition === adPlayingDivPosition) {
            if (isBottom) {
                if (positionsCTA[1] === 'right') {
                    adPlayingDiv.style.bottom = defaultPositions[positionsAdText[0]][positionsAdText[1]].v + skipButtonHeightWithSpacing + ctaButtonHeightWithSpacing + 'px';
                } else {
                    adPlayingDiv.style.bottom = defaultPositions[positionsAdText[0]][positionsAdText[1]].v + ctaButtonHeightWithSpacing + 'px';
                }
            } else {
                ctaButton.style.top = defaultPositions[positionsCTA[0]][positionsCTA[1]].v + adPlayingDivHeightWithSpacing + 'px';
            }
        }
    };

    self.removeAdPlayingText = () => {
        const div = document.getElementById(self.videoPlayerId + '_fluid_ad_playing');
        if (!div) {
            return;
        }
        div.parentElement.removeChild(div);
    };

    self.addCTAButton = (landingPage) => {
        if (!landingPage) {
            return;
        }

        const ctaButton = document.createElement('div');
        ctaButton.id = self.videoPlayerId + '_fluid_cta';
        ctaButton.className = 'fluid_ad_cta';

        const link = document.createElement('span');
        link.innerHTML = self.displayOptions.vastOptions.adCTAText + "<br/><span class=\"add_icon_clickthrough\">" + landingPage + "</span>";

        ctaButton.addEventListener('click', () => {
            if (!self.domRef.player.paused) {
                self.domRef.player.pause();
            }

            const win = window.open(self.vastOptions.clickthroughUrl, '_blank');
            win.focus();
            return true;
        }, false);

        ctaButton.appendChild(link);

        self.domRef.wrapper.appendChild(ctaButton);
    };

    self.removeCTAButton = () => {
        const btn = document.getElementById(self.videoPlayerId + '_fluid_cta');
        if (!btn) {
            return;
        }

        btn.parentElement.removeChild(btn);
    };

    self.decreaseSkipOffset = () => {
        let sec = self.vastOptions.skipoffset - Math.floor(self.domRef.player.currentTime);
        const btn = document.getElementById('skip_button_' + self.videoPlayerId);

        if (!btn) {
            self.domRef.player.removeEventListener('timeupdate', self.decreaseSkipOffset);
            return;
        }

        if (sec >= 1) {
            //set the button label with the remaining seconds
            btn.innerHTML = self.displayOptions.vastOptions.skipButtonCaption.replace('[seconds]', sec);
            return;
        }

        // TODO: refactored, but this is still terrible - remove all this and just make the button clickable...
        const skipLink = document.createElement('a');
        skipLink.href = '#';
        skipLink.id = 'skipHref_' + self.videoPlayerId;
        skipLink.innerHTML = self.displayOptions.vastOptions.skipButtonClickCaption;
        skipLink.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            self.pressSkipButton();
        };

        btn.innerHTML = '';
        btn.appendChild(skipLink);

        //removes the CSS class for a disabled button
        btn.className = btn.className.replace(/\bskip_button_disabled\b/, '');

        self.domRef.player.removeEventListener('timeupdate', self.decreaseSkipOffset);
    };

    self.pressSkipButton = () => {
        self.removeSkipButton();
        self.removeAdPlayingText();
        self.removeCTAButton();

        if (self.vastOptions.vpaid) {
            // skip the linear vpaid ad
            self.skipVpaidAd();
            return;
        }

        // skip the regular linear vast
        self.displayOptions.vastOptions.vastAdvanced.vastVideoSkippedCallback();
        const event = document.createEvent('Event');
        event.initEvent('ended', false, true);
        self.domRef.player.dispatchEvent(event);
    };

    self.removeSkipButton = () => {
        const btn = document.getElementById('skip_button_' + self.videoPlayerId);
        if (btn) {
            btn.parentElement.removeChild(btn);
        }
    };

    /**
     * Makes the player open the ad URL on clicking
     */
    self.addClickthroughLayer = () => {
        const divWrapper = self.domRef.wrapper;

        const divClickThrough = document.createElement('div');
        divClickThrough.className = 'vast_clickthrough_layer';
        divClickThrough.id = 'vast_clickthrough_layer_' + self.videoPlayerId;
        divClickThrough.setAttribute(
            'style',
            'position: absolute; cursor: pointer; top: 0; left: 0; width: ' +
            self.domRef.player.offsetWidth + 'px; height: ' +
            (self.domRef.player.offsetHeight) + 'px;'
        );

        divWrapper.appendChild(divClickThrough);

        //Bind the Onclick event
        const openClickthrough = function () {
            window.open(self.vastOptions.clickthroughUrl);

            //Tracking the Clickthorugh events
            if (typeof self.vastOptions.clicktracking !== 'undefined') {
                self.callUris(self.vastOptions.clicktracking);
            }
        };

        const clickthroughLayer = document.getElementById('vast_clickthrough_layer_' + self.videoPlayerId);
        const isIos9orLower = (self.mobileInfo.device === 'iPhone') && (self.mobileInfo.userOsMajor !== false) && (self.mobileInfo.userOsMajor <= 9);

        clickthroughLayer.onclick = () => {
            if (self.domRef.player.paused) {
                //On Mobile Safari on iPhones with iOS 9 or lower open the clickthrough only once
                if (isIos9orLower && !self.suppressClickthrough) {
                    openClickthrough();
                    self.suppressClickthrough = true;

                } else {
                    self.domRef.player.play();
                }

            } else {
                openClickthrough();
                self.domRef.player.pause();
            }
        };
    };

    /**
     * Remove the Clickthrough layer
     */
    self.removeClickthrough = () => {
        const clickthroughLayer = document.getElementById('vast_clickthrough_layer_' + self.videoPlayerId);

        if (clickthroughLayer) {
            clickthroughLayer.parentNode.removeChild(clickthroughLayer);
        }
    };
}
