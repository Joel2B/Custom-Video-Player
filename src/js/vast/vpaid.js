/* eslint-disable */
// VPAID support module
export default function (self, options) {
    const callbacks = {
        AdStarted: () => self.onStartVpaidAd,
        AdStopped: () => self.onStopVpaidAd,
        AdSkipped: () => self.onSkipVpaidAd,
        AdLoaded: () => self.onVpaidAdLoaded,
        AdLinearChange: () => self.onVpaidAdLinearChange,
        AdSizeChange: () => self.onVpaidAdSizeChange,
        AdExpandedChange: () => self.onVpaidAdExpandedChange,
        AdSkippableStateChange: () => self.onVpaidAdSkippableStateChange,
        AdDurationChange: () => self.onVpaidAdDurationChange,
        AdRemainingTimeChange: () => self.onVpaidAdRemainingTimeChange,
        AdVolumeChange: () => self.onVpaidAdVolumeChange,
        AdImpression: () => self.onVpaidAdImpression,
        AdClickThru: () => self.onVpaidAdClickThru,
        AdInteraction: () => self.onVpaidAdInteraction,
        AdVideoStart: () => self.onVpaidAdVideoStart,
        AdVideoFirstQuartile: () => self.onVpaidAdVideoFirstQuartile,
        AdVideoMidpoint: () => self.onVpaidAdVideoMidpoint,
        AdVideoThirdQuartile: () => self.onVpaidAdVideoThirdQuartile,
        AdVideoComplete: () => self.onVpaidAdVideoComplete,
        AdUserAcceptInvitation: () => self.onVpaidAdUserAcceptInvitation,
        AdUserMinimize: () => self.onVpaidAdUserMinimize,
        AdUserClose: () => self.onVpaidAdUserClose,
        AdPaused: () => self.onVpaidAdPaused,
        AdPlaying: () => self.onVpaidAdPlaying,
        AdError: () => self.onVpaidAdError,
        AdLog: () => self.onVpaidAdLog
    };

    self.checkVPAIDInterface = (vpaidAdUnit) => {
        const VPAIDCreative = vpaidAdUnit;
        // checks if all the mandatory params present
        return !!(VPAIDCreative.handshakeVersion && typeof VPAIDCreative.handshakeVersion == "function"
            && VPAIDCreative.initAd && typeof VPAIDCreative.initAd == "function"
            && VPAIDCreative.startAd && typeof VPAIDCreative.startAd == "function"
            && VPAIDCreative.stopAd && typeof VPAIDCreative.stopAd == "function"
            && VPAIDCreative.skipAd && typeof VPAIDCreative.skipAd == "function"
            && VPAIDCreative.resizeAd && typeof VPAIDCreative.resizeAd == "function"
            && VPAIDCreative.pauseAd && typeof VPAIDCreative.pauseAd == "function"
            && VPAIDCreative.resumeAd && typeof VPAIDCreative.resumeAd == "function"
            && VPAIDCreative.expandAd && typeof VPAIDCreative.expandAd == "function"
            && VPAIDCreative.collapseAd && typeof VPAIDCreative.collapseAd == "function"
            && VPAIDCreative.subscribe && typeof VPAIDCreative.subscribe == "function"
            && VPAIDCreative.unsubscribe && typeof VPAIDCreative.unsubscribe == "function");
    };

    // Callback for AdPaused
    self.onVpaidAdPaused = () => {
        self.vpaidTimeoutTimerClear();
        self.debugMessage("onAdPaused");
    };

    // Callback for AdPlaying
    self.onVpaidAdPlaying = () => {
        self.vpaidTimeoutTimerClear();
        self.debugMessage("onAdPlaying");
    };

    // Callback for AdError
    self.onVpaidAdError = (message) => {
        self.debugMessage("onAdError: " + message);
        self.vpaidTimeoutTimerClear();
        self.onVpaidEnded();
    };

    // Callback for AdLog
    self.onVpaidAdLog = (message) => {
        self.debugMessage("onAdLog: " + message);
    };

    // Callback for AdUserAcceptInvitation
    self.onVpaidAdUserAcceptInvitation = () => {
        self.debugMessage("onAdUserAcceptInvitation");
    };

    // Callback for AdUserMinimize
    self.onVpaidAdUserMinimize = () => {
        self.debugMessage("onAdUserMinimize");
    };

    // Callback for AdUserClose
    self.onVpaidAdUserClose = () => {
        self.debugMessage("onAdUserClose");
    };

    // Callback for AdUserClose
    self.onVpaidAdSkippableStateChange = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.debugMessage("Ad Skippable State Changed to: " + self.vpaidAdUnit.getAdSkippableState());
    };

    // Callback for AdUserClose
    self.onVpaidAdExpandedChange = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.debugMessage("Ad Expanded Changed to: " + self.vpaidAdUnit.getAdExpanded());
    };

    // Pass through for getAdExpanded
    self.getVpaidAdExpanded = () => {
        self.debugMessage("getAdExpanded");

        if (!self.vpaidAdUnit) {
            return;
        }

        return self.vpaidAdUnit.getAdExpanded();
    };

    // Pass through for getAdSkippableState
    self.getVpaidAdSkippableState = () => {
        self.debugMessage("getAdSkippableState");

        if (!self.vpaidAdUnit) {
            return;
        }
        return self.vpaidAdUnit.getAdSkippableState();
    };

    // Callback for AdSizeChange
    self.onVpaidAdSizeChange = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.debugMessage("Ad size changed to: w=" + self.vpaidAdUnit.getAdWidth() + " h=" + self.vpaidAdUnit.getAdHeight());
    };

    // Callback for AdDurationChange
    self.onVpaidAdDurationChange = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.debugMessage("Ad Duration Changed to: " + self.vpaidAdUnit.getAdDuration());
    };

    // Callback for AdRemainingTimeChange
    self.onVpaidAdRemainingTimeChange = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.debugMessage("Ad Remaining Time Changed to: " + self.vpaidAdUnit.getAdRemainingTime());
    };

    // Pass through for getAdRemainingTime
    self.getVpaidAdRemainingTime = () => {
        self.debugMessage("getAdRemainingTime");
        if (!self.vpaidAdUnit) {
            return;
        }
        return self.vpaidAdUnit.getAdRemainingTime();
    };

    // Callback for AdImpression
    self.onVpaidAdImpression = () => {
        self.debugMessage("Ad Impression");

        //Announce the impressions
        self.trackSingleEvent('impression');
    };

    // Callback for AdClickThru
    self.onVpaidAdClickThru = (url, id, playerHandles) => {
        self.debugMessage("Clickthrough portion of the ad was clicked");

        // if playerHandles flag is set to true
        // then player need to open click thorough url in new window
        if (playerHandles) {
            window.open(self.vastOptions.clickthroughUrl);
        }

        self.pauseVpaidAd();
        // fire click tracking
        self.callUris(self.vastOptions.clicktracking);
    };

    // Callback for AdInteraction
    self.onVpaidAdInteraction = (id) => {
        self.debugMessage("A non-clickthrough event has occured");
    };

    // Callback for AdVideoStart
    self.onVpaidAdVideoStart = () => {
        self.debugMessage("Video 0% completed");
        self.trackSingleEvent('start');
    };

    // Callback for AdUserClose
    self.onVpaidAdVideoFirstQuartile = () => {
        self.debugMessage("Video 25% completed");
        self.trackSingleEvent('firstQuartile');
    };

    // Callback for AdUserClose
    self.onVpaidAdVideoMidpoint = () => {
        self.debugMessage("Video 50% completed");
        self.trackSingleEvent('midpoint');
    };

    // Callback for AdUserClose
    self.onVpaidAdVideoThirdQuartile = () => {
        self.debugMessage("Video 75% completed");
        self.trackSingleEvent('thirdQuartile');
    };

    // Callback for AdVideoComplete
    self.onVpaidAdVideoComplete = () => {
        self.debugMessage("Video 100% completed");
        self.trackSingleEvent('complete');
    };

    // Callback for AdLinearChange
    self.onVpaidAdLinearChange = () => {
        const vpaidNonLinearSlot = document.getElementsByClassName("fluid_vpaidNonLinear_ad")[0];
        const closeBtn = document.getElementById('close_button_' + self.videoPlayerId);
        const adListId = vpaidNonLinearSlot.getAttribute('adlistid');
        self.debugMessage("Ad linear has changed: " + self.vpaidAdUnit.getAdLinear());

        if (!self.vpaidAdUnit.getAdLinear()) {
            return;
        }

        self.backupMainVideoContentTime(adListId);
        self.isCurrentlyPlayingAd = true;

        if (closeBtn) {
            closeBtn.remove();
        }

        vpaidNonLinearSlot.className = 'fluid_vpaid_slot';
        vpaidNonLinearSlot.id = self.videoPlayerId + "_fluid_vpaid_slot";
        self.domRef.player.loop = false;
        self.domRef.player.removeAttribute('controls');

        const progressbarContainer = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_currentprogress');

        for (let i = 0; i < progressbarContainer.length; i++) {
            progressbarContainer[i].style.backgroundColor = self.displayOptions.layoutControls.adProgressColor;
        }
        const progressCurrentMarker = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_currentpos');
        for (let i = 0; i < progressCurrentMarker.length; i++) {
            progressCurrentMarker[i].style.backgroundColor = self.displayOptions.layoutControls.adProgressColor;
        }

        self.toggleLoader(false);
    };

    // Pass through for getAdLinear
    self.getVpaidAdLinear = () => {
        self.debugMessage("getAdLinear");
        return self.vpaidAdUnit.getAdLinear();
    };

    // Pass through for startAd()
    self.startVpaidAd = () => {
        self.debugMessage("startAd");
        self.vpaidTimeoutTimerStart();
        self.vpaidAdUnit.startAd();
    };

    // Callback for AdLoaded
    self.onVpaidAdLoaded = () => {
        self.debugMessage("ad has been loaded");
        // start the video play as vpaid is loaded successfully
        self.vpaidTimeoutTimerClear();
        self.startVpaidAd();
    };

    // Callback for StartAd()
    self.onStartVpaidAd = () => {
        self.debugMessage("Ad has started");
        self.vpaidTimeoutTimerClear();
    };

    // Pass through for stopAd()
    self.stopVpaidAd = () => {
        self.vpaidTimeoutTimerStart();
        self.vpaidAdUnit.stopAd();
    };

    // Hard Pass through for stopAd() excluding deleteOtherVpaidAdsApart
    self.hardStopVpaidAd = (deleteOtherVpaidAdsApart) => {
        // this is hard stop of vpaid ads
        // we delete all the vpaid assets so the new one can be loaded
        // delete all assets apart from the ad from deleteOtherVpaidAdsApart
        if (self.vpaidAdUnit) {
            self.vpaidAdUnit.stopAd();
            self.vpaidAdUnit = null;
        }

        const vpaidIframes = document.getElementsByClassName("fluid_vpaid_iframe");
        const vpaidSlots = document.getElementsByClassName("fluid_vpaid_slot");
        const vpaidNonLinearSlots = document.getElementsByClassName("fluid_vpaidNonLinear_ad");

        for (let i = 0; i < vpaidIframes.length; i++) {
            if (vpaidIframes[i].getAttribute('adListId') !== deleteOtherVpaidAdsApart) {
                vpaidIframes[i].remove();
            }
        }

        for (let j = 0; j < vpaidSlots.length; j++) {
            if (vpaidSlots[j].getAttribute('adListId') !== deleteOtherVpaidAdsApart) {
                vpaidSlots[j].remove();
            }
        }

        for (let k = 0; k < vpaidNonLinearSlots.length; k++) {
            if (vpaidNonLinearSlots[k].getAttribute('adListId') !== deleteOtherVpaidAdsApart) {
                vpaidNonLinearSlots[k].remove();
            }
        }
    };

    // Callback for AdUserClose
    self.onStopVpaidAd = () => {
        self.debugMessage("Ad has stopped");
        self.vpaidTimeoutTimerClear();
        self.onVpaidEnded();
    };

    // Callback for AdUserClose
    self.onSkipVpaidAd = () => {
        self.debugMessage("Ad was skipped");

        self.vpaidTimeoutTimerClear();
        self.onVpaidEnded();
    };

    // Passthrough for skipAd
    self.skipVpaidAd = () => {
        self.vpaidTimeoutTimerStart();
        if (!self.vpaidAdUnit) {
            return;
        }
        self.vpaidAdUnit.skipAd()
        self.vpaidTimeoutTimerClear();
        self.onVpaidEnded();
    };

    // Passthrough for setAdVolume
    self.setVpaidAdVolume = (val) => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.vpaidAdUnit.setAdVolume(val);
    };

    // Passthrough for getAdVolume
    self.getVpaidAdVolume = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        return self.vpaidAdUnit.getAdVolume();
    };

    // Callback for AdVolumeChange
    self.onVpaidAdVolumeChange = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.debugMessage("Ad Volume has changed to - " + self.vpaidAdUnit.getAdVolume());
    };

    self.resizeVpaidAuto = () => {
        if (self.vastOptions !== null && self.vastOptions.vpaid && self.vastOptions.linear) {
            const adWidth = self.domRef.player.offsetWidth;
            const adHeight = self.domRef.player.offsetHeight;
            const mode = (self.fullscreenMode ? 'fullscreen' : 'normal');
            self.resizeVpaidAd(adWidth, adHeight, mode);
        }
    };

    //Passthrough for resizeAd
    self.resizeVpaidAd = (width, height, viewMode) => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.vpaidAdUnit.resizeAd(width, height, viewMode);
    };

    // Passthrough for pauseAd()
    self.pauseVpaidAd = () => {
        self.vpaidTimeoutTimerStart();
        if (!self.vpaidAdUnit) {
            return;
        }
        self.vpaidAdUnit.pauseAd();
    };

    // Passthrough for resumeAd()
    self.resumeVpaidAd = () => {
        self.vpaidTimeoutTimerStart();
        if (!self.vpaidAdUnit) {
            return;
        }
        self.vpaidAdUnit.resumeAd();
    };

    //Passthrough for expandAd()
    self.expandVpaidAd = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.vpaidAdUnit.expandAd();
    };

    //Passthrough for collapseAd()
    self.collapseVpaidAd = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        self.vpaidAdUnit.collapseAd();
    };

    self.vpaidTimeoutTimerClear = () => {
        if (self.vpaidTimer) {
            clearTimeout(self.vpaidTimer);
        }
    };

    // placeholder for timer function
    self.vpaidTimeoutTimerStart = () => {
        // clear previous timer if any
        self.vpaidTimeoutTimerClear();
        self.vpaidTimer = setTimeout(function () {
            self.announceLocalError('901');
            self.onVpaidEnded();
        }, self.displayOptions.vastOptions.vpaidTimeout);
    };

    self.vpaidCallbackListenersAttach = () => {
        //The key of the object is the event name and the value is a reference to the callback function that is registered with the creative
        // Looping through the object and registering each of the callbacks with the creative
        for (let eventName in callbacks) {
            self.vpaidAdUnit.subscribe(callbacks[eventName](), eventName, self);
        }
    };

    self.vpaidCallbackListenersDetach = () => {
        if (!self.vpaidAdUnit) {
            return;
        }
        for (let eventName in callbacks) {
            self.vpaidAdUnit.unsubscribe(callbacks[eventName](), eventName, self);
        }
    };

    self.loadVpaid = (adListId, vpaidJsUrl) => {
        const vpaidIframe = document.createElement('iframe');
        vpaidIframe.id = self.videoPlayerId + "_" + adListId + "_fluid_vpaid_iframe";
        vpaidIframe.className = 'fluid_vpaid_iframe';
        vpaidIframe.setAttribute('adListId', adListId);
        vpaidIframe.setAttribute('frameborder', '0');

        self.domRef.player.parentNode.insertBefore(vpaidIframe, self.domRef.player.nextSibling);

        vpaidIframe.contentWindow.document.write('<script src="' + vpaidJsUrl + '"></scr' + 'ipt>');

        // set interval with timeout
        self.tempVpaidCounter = 0;
        self.getVPAIDAdInterval = setInterval(function () {

            const fn = vpaidIframe.contentWindow['getVPAIDAd'];

            // check if JS is loaded fully in iframe
            if (fn && typeof fn == 'function') {

                if (self.vpaidAdUnit) {
                    self.hardStopVpaidAd(adListId);
                }

                self.vpaidAdUnit = fn();
                clearInterval(self.getVPAIDAdInterval);
                if (self.checkVPAIDInterface(self.vpaidAdUnit)) {

                    if (self.getVpaidAdLinear()) {
                        self.isCurrentlyPlayingAd = true;
                        self.switchPlayerToVpaidMode(adListId);
                    } else {
                        self.debugMessage('non linear vpaid ad is loaded');
                        self.loadVpaidNonlinearAssets(adListId);
                    }

                }

            } else {

                // video player will wait for 2seconds if vpaid is not loaded, then it will declare vast error and move ahead
                self.tempVpaidCounter++;
                if (self.tempVpaidCounter >= 20) {
                    clearInterval(self.getVPAIDAdInterval);
                    self.adList[adListId].error = true;
                    self.playMainVideoWhenVpaidFails(403);
                    return false;
                } else {
                    self.debugMessage(self.tempVpaidCounter);
                }

            }

        }, 100);

    };

    self.onVpaidEnded = (event) => {
        if (event) {
            event.stopImmediatePropagation();
        }

        const vpaidSlot = document.getElementById(self.videoPlayerId + "_fluid_vpaid_slot");

        self.vpaidCallbackListenersDetach();

        self.vpaidAdUnit = null;
        clearInterval(self.getVPAIDAdInterval);

        if (!!vpaidSlot) {
            vpaidSlot.remove();
        }

        self.checkForNextAd();
    };

    self.playMainVideoWhenVpaidFails = (errorCode) => {
        const vpaidSlot = document.getElementById(self.videoPlayerId + "_fluid_vpaid_slot");

        if (vpaidSlot) {
            vpaidSlot.remove();
        }

        clearInterval(self.getVPAIDAdInterval);
        self.playMainVideoWhenVastFails(errorCode);
    };

    // TODO: ???
    self.switchPlayerToVpaidMode = () => {
    };
}
