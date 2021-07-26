// VAST support module
'use strict';
export default function (self, options) {
    self.getClickThroughUrlFromLinear = (linear) => {
        const videoClicks = linear.getElementsByTagName('VideoClicks');

        if (videoClicks.length) { //There should be exactly 1 node
            const clickThroughs = videoClicks[0].getElementsByTagName('ClickThrough');

            if (clickThroughs.length) {
                return self.extractNodeData(clickThroughs[0]);
            }
        }

        return false;
    };

    self.getVastAdTagUriFromWrapper = (xmlResponse) => {
        const wrapper = xmlResponse.getElementsByTagName('Wrapper');

        if (typeof wrapper !== 'undefined' && wrapper.length) {
            const vastAdTagURI = wrapper[0].getElementsByTagName('VASTAdTagURI');

            if (vastAdTagURI.length) {
                return self.extractNodeData(vastAdTagURI[0]);
            }
        }

        return false;
    };

    self.hasInLine = (xmlResponse) => {
        const inLine = xmlResponse.getElementsByTagName('InLine');
        return ((typeof inLine !== 'undefined') && inLine.length);
    };

    self.hasVastAdTagUri = (xmlResponse) => {
        const vastAdTagURI = xmlResponse.getElementsByTagName('VASTAdTagURI');
        return ((typeof vastAdTagURI !== 'undefined') && vastAdTagURI.length);
    };

    self.getClickThroughUrlFromNonLinear = (nonLinear) => {
        let result = '';
        const nonLinears = nonLinear.getElementsByTagName('NonLinear');

        if (nonLinears.length) {//There should be exactly 1 node
            const nonLinearClickThrough = nonLinear.getElementsByTagName('NonLinearClickThrough');
            if (nonLinearClickThrough.length) {
                result = self.extractNodeData(nonLinearClickThrough[0]);
            }
        }

        return result;
    };

    self.getTrackingFromLinear = (linear) => {
        const trackingEvents = linear.getElementsByTagName('TrackingEvents');

        if (trackingEvents.length) {//There should be no more than one node
            return trackingEvents[0].getElementsByTagName('Tracking');
        }

        return [];
    };

    self.getDurationFromLinear = (linear) => {
        const duration = linear.getElementsByTagName('Duration');

        if (duration.length && (typeof duration[0].childNodes[0] !== 'undefined')) {
            const nodeDuration = self.extractNodeData(duration[0]);
            return self.convertTimeStringToSeconds(nodeDuration);
        }

        return false;
    };

    self.getDurationFromNonLinear = (tag) => {
        let result = 0;
        const nonLinear = tag.getElementsByTagName('NonLinear');
        if (nonLinear.length && (typeof nonLinear[0].getAttribute('minSuggestedDuration') !== 'undefined')) {
            result = self.convertTimeStringToSeconds(nonLinear[0].getAttribute('minSuggestedDuration'));
        }
        return result;
    };

    self.getDimensionFromNonLinear = (tag) => {
        const result = { 'width': null, 'height': null };
        const nonLinear = tag.getElementsByTagName('NonLinear');

        if (nonLinear.length) {
            if (typeof nonLinear[0].getAttribute('width') !== 'undefined') {
                result.width = nonLinear[0].getAttribute('width');
            }
            if (typeof nonLinear[0].getAttribute('height') !== 'undefined') {
                result.height = nonLinear[0].getAttribute('height');
            }
        }

        return result;
    };

    self.getCreativeTypeFromStaticResources = (tag) => {
        let result = '';
        const nonLinears = tag.getElementsByTagName('NonLinear');

        if (nonLinears.length && (typeof nonLinears[0].childNodes[0] !== 'undefined')) {//There should be exactly 1 StaticResource node
            result = nonLinears[0].getElementsByTagName('StaticResource')[0].getAttribute('creativeType');
        }

        return result.toLowerCase();
    };

    self.getMediaFilesFromLinear = (linear) => {
        const mediaFiles = linear.getElementsByTagName('MediaFiles');

        if (mediaFiles.length) {//There should be exactly 1 MediaFiles node
            return mediaFiles[0].getElementsByTagName('MediaFile');
        }

        return [];
    };

    self.getStaticResourcesFromNonLinear = (linear) => {
        let result = [];
        const nonLinears = linear.getElementsByTagName('NonLinear');

        if (nonLinears.length) {//There should be exactly 1 StaticResource node
            result = nonLinears[0].getElementsByTagName('StaticResource');
        }

        return result;
    };

    self.extractNodeData = (parentNode) => {
        let contentAsString = "";
        for (let n = 0; n < parentNode.childNodes.length; n++) {
            const child = parentNode.childNodes[n];
            if (child.nodeType === 8 || (child.nodeType === 3 && /^\s*$/.test(child.nodeValue))) {
                // Comments or text with no content
            } else {
                contentAsString += child.nodeValue;
            }
        }
        return contentAsString.replace(/(^\s+|\s+$)/g, '');
    };

    self.getAdParametersFromLinear = (linear) => {
        const adParameters = linear.getElementsByTagName('AdParameters');
        let adParametersData = null;

        if (adParameters.length) {
            adParametersData = self.extractNodeData(adParameters[0]);
        }

        return adParametersData;
    };

    self.getMediaFileListFromLinear = (linear) => {
        const mediaFileList = [];
        const mediaFiles = self.getMediaFilesFromLinear(linear);

        if (!mediaFiles.length) {
            return mediaFileList;
        }

        for (let n = 0; n < mediaFiles.length; n++) {
            let mediaType = mediaFiles[n].getAttribute('mediaType');

            if (!mediaType) {
                // if there is no mediaType attribute then the video is 2D
                mediaType = '2D';
            }

            // get all the attributes of media file
            mediaFileList.push({
                'src': self.extractNodeData(mediaFiles[n]),
                'type': mediaFiles[n].getAttribute('type'),
                'apiFramework': mediaFiles[n].getAttribute('apiFramework'),
                'codec': mediaFiles[n].getAttribute('codec'),
                'id': mediaFiles[n].getAttribute('codec'),
                'fileSize': mediaFiles[n].getAttribute('fileSize'),
                'delivery': mediaFiles[n].getAttribute('delivery'),
                'width': mediaFiles[n].getAttribute('width'),
                'height': mediaFiles[n].getAttribute('height'),
                'mediaType': mediaType.toLowerCase()
            });

        }

        return mediaFileList;
    };

    self.getIconClickThroughFromLinear = (linear) => {
        const iconClickThrough = linear.getElementsByTagName('IconClickThrough');

        if (iconClickThrough.length) {
            return self.extractNodeData(iconClickThrough[0]);
        }

        return '';
    };

    self.getStaticResourceFromNonLinear = (linear) => {
        let fallbackStaticResource;
        const staticResources = self.getStaticResourcesFromNonLinear(linear);

        for (let i = 0; i < staticResources.length; i++) {
            if (!staticResources[i].getAttribute('type')) {
                fallbackStaticResource = self.extractNodeData(staticResources[i]);
            }

            if (staticResources[i].getAttribute('type') === self.displayOptions.staticResource) {
                return self.extractNodeData(staticResources[i]);
            }
        }

        return fallbackStaticResource;
    };

    self.registerTrackingEvents = (creativeLinear, tmpOptions) => {
        const trackingEvents = self.getTrackingFromLinear(creativeLinear);
        let eventType = '';
        let oneEventOffset = 0;

        for (let i = 0; i < trackingEvents.length; i++) {
            eventType = trackingEvents[i].getAttribute('event');

            switch (eventType) {
                case 'start':
                case 'firstQuartile':
                case 'midpoint':
                case 'thirdQuartile':
                case 'complete':
                    if (typeof tmpOptions.tracking[eventType] === 'undefined') {
                        tmpOptions.tracking[eventType] = [];
                    }

                    if (typeof tmpOptions.stopTracking[eventType] === 'undefined') {
                        tmpOptions.stopTracking[eventType] = [];
                    }
                    tmpOptions.tracking[eventType].push(trackingEvents[i].childNodes[0].nodeValue);
                    tmpOptions.stopTracking[eventType] = false;

                    break;

                case 'progress':
                    if (typeof tmpOptions.tracking[eventType] === 'undefined') {
                        tmpOptions.tracking[eventType] = [];
                    }

                    oneEventOffset = self.convertTimeStringToSeconds(trackingEvents[i].getAttribute('offset'));

                    if (typeof tmpOptions.tracking[eventType][oneEventOffset] === 'undefined') {
                        tmpOptions.tracking[eventType][oneEventOffset] = {
                            elements: [],
                            stopTracking: false
                        };
                    }

                    tmpOptions.tracking[eventType][oneEventOffset].elements.push(trackingEvents[i].childNodes[0].nodeValue);

                    break;

                default:
                    break;
            }
        }
    };

    self.registerClickTracking = (clickTrackingTag, tmpOptions) => {
        if (!clickTrackingTag || !clickTrackingTag.length) {
            return;
        }

        for (let i = 0; i < clickTrackingTag.length; i++) {
            if (clickTrackingTag[i] === '') {
                continue;
            }

            tmpOptions.clicktracking.push(clickTrackingTag[i]);
        }

    };

    self.registerImpressionEvents = (impressionTags, tmpOptions) => {
        if (!impressionTags.length) {
            return;
        }

        for (let i = 0; i < impressionTags.length; i++) {
            const impressionEvent = self.extractNodeData(impressionTags[i]);
            tmpOptions.impression.push(impressionEvent);
        }
    };

    self.registerErrorEvents = (errorTags, tmpOptions) => {
        if ((typeof errorTags !== 'undefined') &&
            (errorTags !== null) &&
            (errorTags.length === 1) && //Only 1 Error tag is expected
            (errorTags[0].childNodes.length === 1)) {
            tmpOptions.errorUrl = errorTags[0].childNodes[0].nodeValue;
        }
    };

    self.announceError = (code) => {
        if (typeof self.vastOptions.errorUrl === 'undefined' || !self.vastOptions.errorUrl) {
            return;
        }

        const parsedCode = typeof code !== 'undefined' ? parseInt(code) : 900;
        const errorUrl = self.vastOptions.errorUrl.replace('[ERRORCODE]', parsedCode);

        //Send the error request
        self.callUris([errorUrl]);
    };

    self.getClickTrackingEvents = (linear) => {
        const result = [];

        const videoClicks = linear.getElementsByTagName('VideoClicks');

        //There should be exactly 1 node
        if (!videoClicks.length) {
            return;
        }

        const clickTracking = videoClicks[0].getElementsByTagName('ClickTracking');

        if (!clickTracking.length) {
            return;
        }

        for (let i = 0; i < clickTracking.length; i++) {
            const clickTrackingEvent = self.extractNodeData(clickTracking[i]);
            result.push(clickTrackingEvent);
        }

        return result;
    };

    self.getNonLinearClickTrackingEvents = (nonLinear) => {
        const result = [];
        const nonLinears = nonLinear.getElementsByTagName('NonLinear');

        if (!nonLinears.length) {
            return;
        }

        const clickTracking = nonLinear.getElementsByTagName('NonLinearClickTracking');

        if (!clickTracking.length) {
            return;
        }

        for (let i = 0; i < clickTracking.length; i++) {
            const NonLinearClickTracking = self.extractNodeData(clickTracking[i]);
            result.push(NonLinearClickTracking);
        }

        return result;
    };

    // TODO: ???
    self.callUris = (uris) => {
        for (let i = 0; i < uris.length; i++) {
            new Image().src = uris[i];
        }
    };

    self.recalculateAdDimensions = () => {
        const videoPlayer = document.getElementById(self.videoPlayerId);
        const divClickThrough = document.getElementById('vast_clickthrough_layer_' + self.videoPlayerId);

        if (divClickThrough) {
            divClickThrough.style.width = videoPlayer.offsetWidth + 'px';
            divClickThrough.style.height = videoPlayer.offsetHeight + 'px';
        }

        const requestFullscreenFunctionNames = self.checkFullscreenSupport(self.videoPlayerId + '_fluid_video_wrapper');
        const fullscreenButton = document.getElementById(self.videoPlayerId + '_fluid_control_fullscreen');
        const menuOptionFullscreen = document.getElementById(self.videoPlayerId + '_context_option_fullscreen');

        if (requestFullscreenFunctionNames) {
            // this will go other way around because we already exited full screen
            if (document[requestFullscreenFunctionNames.isFullscreen] === null) {
                // Exit fullscreen
                self.fullscreenOff(fullscreenButton, menuOptionFullscreen);
            } else {
                // Go fullscreen
                self.fullscreenOn(fullscreenButton, menuOptionFullscreen);
            }
        } else {
            // TODO: I am fairly certain this fallback does not work...
            //The browser does not support the Fullscreen API, so a pseudo-fullscreen implementation is used
            const fullscreenTag = self.domRef.wrapper;

            if (fullscreenTag.className.search(/\bpseudo_fullscreen\b/g) !== -1) {
                fullscreenTag.className += ' pseudo_fullscreen';
                self.fullscreenOn(fullscreenButton, menuOptionFullscreen);
            } else {
                fullscreenTag.className = fullscreenTag.className.replace(/\bpseudo_fullscreen\b/g, '');
                self.fullscreenOff(fullscreenButton, menuOptionFullscreen);
            }
        }
    };

    self.prepareVast = (roll) => {
        let list = self.findRoll(roll);

        for (let i = 0; i < list.length; i++) {
            const adListId = list[i];

            if (!(self.adList[adListId].vastLoaded !== true && self.adList[adListId].error !== true)) {
                continue;
            }

            self.processVastWithRetries(self.adList[adListId]);
            self.domRef.player.addEventListener('adId_' + adListId, self[roll]);
        }
    };


    self.playMainVideoWhenVastFails = (errorCode) => {
        self.debugMessage('playMainVideoWhenVastFails called');
        self.domRef.player.removeEventListener('loadedmetadata', self.switchPlayerToVastMode);
        self.domRef.player.pause();
        self.toggleLoader(false);
        self.displayOptions.vastOptions.vastAdvanced.noVastVideoCallback();

        if (!self.vastOptions || typeof self.vastOptions.errorUrl === 'undefined') {
            self.announceLocalError(errorCode);
        } else {
            self.announceError(errorCode);
        }

        self.switchToMainVideo();
    };

    // TODO: ???
    self.switchPlayerToVastMode = () => {
    };

    /**
     * Process the XML response
     *
     * @param xmlResponse
     * @param tmpOptions
     * @param callBack
     */
    self.processVastXml = (xmlResponse, tmpOptions, callBack) => {
        let clickTracks;

        if (!xmlResponse) {
            callBack(false);
            return;
        }

        //Get impression tag
        const impression = xmlResponse.getElementsByTagName('Impression');
        if (impression !== null) {
            self.registerImpressionEvents(impression, tmpOptions);
        }

        //Get the error tag, if any
        const errorTags = xmlResponse.getElementsByTagName('Error');
        if (errorTags !== null) {
            self.registerErrorEvents(errorTags, tmpOptions);
        }

        //Get Creative
        const creative = xmlResponse.getElementsByTagName('Creative');

        //Currently only 1 creative and 1 linear is supported
        if ((typeof creative !== 'undefined') && creative.length) {
            const arrayCreativeLinears = creative[0].getElementsByTagName('Linear');

            if ((typeof arrayCreativeLinears !== 'undefined') && (arrayCreativeLinears !== null) && arrayCreativeLinears.length) {

                const creativeLinear = arrayCreativeLinears[0];
                self.registerTrackingEvents(creativeLinear, tmpOptions);

                clickTracks = self.getClickTrackingEvents(creativeLinear);
                self.registerClickTracking(clickTracks, tmpOptions);

                //Extract the Ad data if it is actually the Ad (!wrapper)
                if (!self.hasVastAdTagUri(xmlResponse) && self.hasInLine(xmlResponse)) {

                    //Set initial values
                    tmpOptions.adFinished = false;
                    tmpOptions.adType = 'linear';
                    tmpOptions.vpaid = false;

                    //Extract the necessary data from the Linear node
                    tmpOptions.skipoffset = self.convertTimeStringToSeconds(creativeLinear.getAttribute('skipoffset'));
                    tmpOptions.clickthroughUrl = self.getClickThroughUrlFromLinear(creativeLinear);
                    tmpOptions.duration = self.getDurationFromLinear(creativeLinear);
                    tmpOptions.mediaFileList = self.getMediaFileListFromLinear(creativeLinear);
                    tmpOptions.adParameters = self.getAdParametersFromLinear(creativeLinear);
                    tmpOptions.iconClick = self.getIconClickThroughFromLinear(creativeLinear);

                    if (tmpOptions.adParameters) {
                        tmpOptions.vpaid = true;
                    }
                }
            }

            const arrayCreativeNonLinears = creative[0].getElementsByTagName('NonLinearAds');

            if ((typeof arrayCreativeNonLinears !== 'undefined') && (arrayCreativeNonLinears !== null) && arrayCreativeNonLinears.length) {

                const creativeNonLinear = arrayCreativeNonLinears[0];
                self.registerTrackingEvents(creativeNonLinear, tmpOptions);

                clickTracks = self.getNonLinearClickTrackingEvents(creativeNonLinear);
                self.registerClickTracking(clickTracks, tmpOptions);

                //Extract the Ad data if it is actually the Ad (!wrapper)
                if (!self.hasVastAdTagUri(xmlResponse) && self.hasInLine(xmlResponse)) {

                    //Set initial values
                    tmpOptions.adType = 'nonLinear';
                    tmpOptions.vpaid = false;

                    //Extract the necessary data from the NonLinear node
                    tmpOptions.clickthroughUrl = self.getClickThroughUrlFromNonLinear(creativeNonLinear);
                    tmpOptions.duration = self.getDurationFromNonLinear(creativeNonLinear); // VAST version < 4.0
                    tmpOptions.dimension = self.getDimensionFromNonLinear(creativeNonLinear); // VAST version < 4.0
                    tmpOptions.staticResource = self.getStaticResourceFromNonLinear(creativeNonLinear);
                    tmpOptions.creativeType = self.getCreativeTypeFromStaticResources(creativeNonLinear);
                    tmpOptions.adParameters = self.getAdParametersFromLinear(creativeNonLinear);

                    if (tmpOptions.adParameters) {
                        tmpOptions.vpaid = true;
                    }

                }
            }

            //Extract the Ad data if it is actually the Ad (!wrapper)
            if (!self.hasVastAdTagUri(xmlResponse) && self.hasInLine(xmlResponse)) {
                if (typeof tmpOptions.mediaFileList !== 'undefined' || typeof tmpOptions.staticResource !== 'undefined') {
                    callBack(true, tmpOptions);
                } else {
                    callBack(false);
                }
            }
        } else {
            callBack(false);
        }
    };

    /**
     * Parse the VAST Tag
     *
     * @param vastTag
     * @param adListId
     */

    self.processVastWithRetries = (vastObj) => {
        let vastTag = vastObj.vastTag;
        const adListId = vastObj.id;

        const handleVastResult = function (pass, tmpOptions) {
            if (pass && typeof tmpOptions !== 'undefined' && tmpOptions.vpaid && !self.displayOptions.vastOptions.allowVPAID) {
                pass = false;
                self.announceLocalError('103', 'VPAID not allowed, so skipping this VAST tag.')
            }

            if (pass) {
                // ok
                if (tmpOptions.adType === 'linear') {

                    if ((typeof tmpOptions.iconClick !== 'undefined') && (tmpOptions.iconClick !== null) && tmpOptions.iconClick.length) {
                        self.adList[adListId].landingPage = tmpOptions.iconClick;
                    }

                    const selectedMediaFile = self.getSupportedMediaFileObject(tmpOptions.mediaFileList);
                    if (selectedMediaFile) {
                        self.adList[adListId].mediaType = selectedMediaFile.mediaType;
                    }

                }

                self.adList[adListId].adType = tmpOptions.adType ? tmpOptions.adType : 'unknown';
                self.adList[adListId].vastLoaded = true;
                self.adPool[adListId] = Object.assign({}, tmpOptions);

                const event = document.createEvent('Event');

                event.initEvent('adId_' + adListId, false, true);
                self.domRef.player.dispatchEvent(event);
                self.displayOptions.vastOptions.vastAdvanced.vastLoadedCallback();

                if (self.hasTitle()) {
                    const title = document.getElementById(self.videoPlayerId + '_title');
                    title.style.display = 'none';
                }

            } else {
                // when vast failed
                self.announceLocalError('101');

                if (vastObj.hasOwnProperty('fallbackVastTags') && vastObj.fallbackVastTags.length > 0) {
                    vastTag = vastObj.fallbackVastTags.shift();
                    self.processUrl(vastTag, handleVastResult);
                } else {
                    if (vastObj.roll === 'preRoll') {
                        self.preRollFail(vastObj);
                    }
                    self.adList[adListId].error = true;
                }
            }
        };

        self.processUrl(vastTag, handleVastResult);
    };


    self.processUrl = (vastTag, callBack) => {
        const numberOfRedirects = 0;

        const tmpOptions = {
            tracking: [],
            stopTracking: [],
            impression: [],
            clicktracking: [],
            vastLoaded: false
        };

        self.resolveVastTag(
            vastTag,
            numberOfRedirects,
            tmpOptions,
            callBack
        );
    };

    self.resolveVastTag = (vastTag, numberOfRedirects, tmpOptions, callBack) => {
        if (!vastTag || vastTag === '') {
            callBack(false);
            return;
        }

        const handleXmlHttpReq = function () {
            const xmlHttpReq = this;
            let xmlResponse = false;

            if (xmlHttpReq.readyState === 4 && xmlHttpReq.status === 404) {
                callBack(false);
                return;
            }

            if (xmlHttpReq.readyState === 4 && xmlHttpReq.status === 0) {
                callBack(false); //Most likely that Ad Blocker exists
                return;
            }

            if (!((xmlHttpReq.readyState === 4) && (xmlHttpReq.status === 200))) {
                return;
            }

            if ((xmlHttpReq.readyState === 4) && (xmlHttpReq.status !== 200)) {
                callBack(false);
                return;
            }

            try {
                xmlResponse = xmlHttpReq.responseXML;
            } catch (e) {
                callBack(false);
                return;
            }

            if (!xmlResponse) {
                callBack(false);
                return;
            }

            self.inLineFound = self.hasInLine(xmlResponse);

            if (!self.inLineFound && self.hasVastAdTagUri(xmlResponse)) {

                const vastAdTagUri = self.getVastAdTagUriFromWrapper(xmlResponse);
                if (vastAdTagUri) {
                    self.resolveVastTag(vastAdTagUri, numberOfRedirects, tmpOptions, callBack);
                } else {
                    callBack(false);
                    return;
                }
            }

            if (numberOfRedirects > self.displayOptions.vastOptions.maxAllowedVastTagRedirects && !self.inLineFound) {
                callBack(false);
                return;
            }

            self.processVastXml(xmlResponse, tmpOptions, callBack);
        };

        if (numberOfRedirects <= self.displayOptions.vastOptions.maxAllowedVastTagRedirects) {

            self.sendRequest(
                vastTag,
                true,
                self.displayOptions.vastOptions.vastTimeout,
                handleXmlHttpReq
            );
        }

        numberOfRedirects++;
    };

    self.setVastList = () => {
        const ads = {};
        const adGroupedByRolls = { preRoll: [], postRoll: [], midRoll: [], onPauseRoll: [] };
        const def = {
            id: null,
            roll: null,
            played: false,
            vastLoaded: false,
            error: false,
            adText: null,
            adTextPosition: null
        };
        let idPart = 0;

        const validateVastList = function (item) {
            let hasError = false;

            if (item.roll === 'midRoll') {
                if (typeof item.timer === 'undefined') {
                    hasError = true;
                }
            }

            return hasError;
        };

        const validateRequiredParams = function (item) {
            let hasError = false;

            if (!item.vastTag) {
                self.announceLocalError(102, '"vastTag" property is missing from adList.');
                hasError = true;
            }

            if (!item.roll) {
                self.announceLocalError(102, '"roll" is missing from adList.');
                hasError = true;
            }

            if (self.availableRolls.indexOf(item.roll) === -1) {
                self.announceLocalError(102, 'Only ' + self.availableRolls.join(',') + ' rolls are supported.');
                hasError = true;
            }

            if (item.size && self.supportedNonLinearAd.indexOf(item.size) === -1) {
                self.announceLocalError(102, 'Only ' + self.supportedNonLinearAd.join(',') + ' size are supported.');
                hasError = true;
            }

            return hasError;
        };

        if (self.displayOptions.vastOptions.hasOwnProperty('adList')) {

            for (let key in self.displayOptions.vastOptions.adList) {

                let adItem = self.displayOptions.vastOptions.adList[key];

                if (validateRequiredParams(adItem)) {
                    self.announceLocalError(102, 'Wrong adList parameters.');
                    continue;
                }
                const id = 'ID' + idPart;

                ads[id] = Object.assign({}, def);
                ads[id] = Object.assign(ads[id], self.displayOptions.vastOptions.adList[key]);
                if (adItem.roll == 'midRoll') {
                    ads[id].error = validateVastList('midRoll', adItem);
                }
                ads[id].id = id;
                idPart++;

            }
        }

        // group the ads by roll
        // pushing object references and forming json
        Object.keys(ads).map(function (e) {
            if (ads[e].roll.toLowerCase() === 'preRoll'.toLowerCase()) {
                adGroupedByRolls.preRoll.push(ads[e]);
            } else if (ads[e].roll.toLowerCase() === 'midRoll'.toLowerCase()) {
                adGroupedByRolls.midRoll.push(ads[e]);
            } else if (ads[e].roll.toLowerCase() === 'postRoll'.toLowerCase()) {
                adGroupedByRolls.postRoll.push(ads[e]);
            } else if (ads[e].roll.toLowerCase() === 'onPauseRoll'.toLowerCase()) {
                adGroupedByRolls.onPauseRoll.push(ads[e]);
            }
        });

        self.adGroupedByRolls = adGroupedByRolls;
        self.adList = ads;
    };

    self.onVastAdEnded = (event) => {
        if (event) {
            event.stopImmediatePropagation();
        }
        //"this" is the HTML5 video tag, because it disptches the "ended" event
        self.deleteVastAdElements();
        self.checkForNextAd();
    };

    self.vastLogoBehaviour = (vastPlaying) => {
        if (!self.displayOptions.layoutControls.logo.showOverAds) {
            const logoHolder = document.getElementById(self.videoPlayerId + '_logo');
            const logoImage = document.getElementById(self.videoPlayerId + '_logo_image');

            if (!logoHolder || !logoImage) {
                return;
            }

            logoHolder.style.display = vastPlaying ? 'none' : 'inline';
        }
    };

    self.deleteVastAdElements = () => {
        self.removeClickthrough();
        self.removeSkipButton();
        self.removeAdCountdown();
        self.removeAdPlayingText();
        self.removeCTAButton();
        self.vastLogoBehaviour(false);
    };
}
