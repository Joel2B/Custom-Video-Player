'use strict';

// Player modules
import ControlBar from './modules/control-bar/control-bar';
import Controls from './modules/control-bar/controls';
import Download from './modules/control-bar/download';
import EventsControls from './modules/control-bar/events-controls';
import Fullscreen from './modules/control-bar/fullscreen';
import Keyboard from './modules/control-bar/keyboard';
import Mute from './modules/control-bar/mute';
import PlayPause from './modules/control-bar/play-pause';
import ProgressControl from './modules/control-bar/progress-control';
import Theatre from './modules/control-bar/theatre';
import Timeline from './modules/control-bar/timeline';
import VolumeControl from './modules/control-bar/volume-control';

import Autoplay from './modules/menu/autoplay';
import ContextMenu from './modules/menu/context-menu';
import Loop from './modules/menu/loop';
import Menu from './modules/menu/menu';
import PlaybackRate from './modules/menu/playback-rate';
import QualityLevels from './modules/menu/quality-levels';

import Browser from './modules/utils/browser';
import Dom from './modules/utils/dom';
import Events from './modules/utils/events';
import Media from './modules/utils/media';
import Request from './modules/utils/request';
import Storage from './modules/utils/storage';
import Time from './modules/utils/time';
import Version from './modules/utils/version';

import AdSupport from './modules/vast/adsupport';
import Vast from './modules/vast/vast';
import Vpaid from './modules/vast/vpaid';

import CardBoard from './modules/cardboard';
import Debug from './modules/debug';
import Handlers from './modules/handlers';
import HtmlOnPause from './modules/html-on-pause';
import Logo from './modules/logo';
import MeasureFPS from './modules/measure-fps';
import PersistentSettings from './modules/persistent-settings';
import Shortcuts from './modules/shortcuts';
import Streaming from './modules/streaming';
import Subtitles from './modules/subtitles';
import Title from './modules/title';

const FP_MODULES = [
    ControlBar,
    Controls,
    Download,
    EventsControls,
    Fullscreen,
    Keyboard,
    Mute,
    PlayPause,
    ProgressControl,
    Theatre,
    Timeline,
    VolumeControl,

    Autoplay,
    ContextMenu,
    Loop,
    Menu,
    PlaybackRate,
    QualityLevels,

    Browser,
    Dom,
    Events,
    Media,
    Request,
    Storage,
    Time,
    Version,

    AdSupport,
    Vast,
    Vpaid,

    CardBoard,
    Debug,
    Handlers,
    HtmlOnPause,
    Logo,
    MeasureFPS,
    PersistentSettings,
    Shortcuts,
    Streaming,
    Subtitles,
    Title
];

// Determine build mode
// noinspection JSUnresolvedVariable
const FP_DEVELOPMENT_MODE = typeof FP_ENV !== 'undefined' && FP_ENV === 'development';

// Are we running in debug mode?
// noinspection JSUnresolvedVariable
const FP_RUNTIME_DEBUG = typeof FP_DEBUG !== 'undefined' && FP_DEBUG === true;

let playerInstances = 0;

const playerClass = function () {
    // "self" always points to current instance of the player within the scope of the instance
    // This should help readability and context awareness slightly...
    const self = this;

    self.domRef = {
        player: null,
        controls: {}
    };

    // noinspection JSUnresolvedVariable
    self.version = typeof FP_BUILD_VERSION !== 'undefined' ? FP_BUILD_VERSION : '';
    // noinspection JSUnresolvedVariable
    self.homepage = typeof FP_HOMEPAGE !== 'undefined'
        ? FP_HOMEPAGE + '/?utm_source=player&utm_medium=context_menu&utm_campaign=organic'
        : '';
    self.destructors = [];

    self.init = (playerTarget, options) => {
        // Install player modules and features
        const moduleOptions = {
            development: FP_DEVELOPMENT_MODE,
            debug: FP_RUNTIME_DEBUG,
        };

        for (const playerModule of FP_MODULES) {
            playerModule(self, moduleOptions);
        }

        let playerNode;
        if (playerTarget instanceof HTMLVideoElement) {
            playerNode = playerTarget;

            // Automatically assign ID if none exists
            if (!playerTarget.id) {
                playerTarget.id = 'fluid_player_instance_' + (playerInstances++).toString();
            }
        } else if (typeof playerTarget === 'string' || playerTarget instanceof String) {
            playerNode = document.getElementById(playerTarget);
        } else {
            throw 'Invalid initializer - player target must be HTMLVideoElement or ID';
        }

        if (!playerNode) {
            throw 'Could not find a HTML node to attach to for target ' + playerTarget + '"';
        }

        playerNode.setAttribute('playsinline', '');
        playerNode.setAttribute('webkit-playsinline', '');

        self.domRef.player = playerNode;
        self.vrROTATION_POSITION = 0.1;
        self.vrROTATION_SPEED = 80;
        self.vrMode = false;
        self.vrPanorama = null;
        self.vrViewer = null;
        self.vpaidTimer = null;
        self.vpaidAdUnit = null;
        self.vastOptions = null;
        /**
         * @deprecated Nothing should RELY on this. An internal ID generator
         * should be used where absolutely necessary and DOM objects under FP control
         * MUST be referenced in domRef.
         */
        self.videoPlayerId = playerNode.id;
        self.originalSrc = self.getCurrentSrc();
        self.isCurrentlyPlayingAd = false;
        self.recentWaiting = false;
        self.latestVolume = 1;
        self.currentVideoDuration = 0;
        self.firstPlayLaunched = false;
        self.suppressClickthrough = false;
        self.timelinePreviewData = [];
        self.mainVideoCurrentTime = 0;
        self.mainVideoDuration = 0;
        self.totalFPS = 0;
        self.currentFrameRate = 0;
        self.currentFrameCount = 0;
        self.countCheckFPS = 0;
        self.countRegularFPS = 0;
        self.fpsTimer = null;
        self.stopCheckFPSInterval = false;
        self.updateFpsTimer = 0.3;
        self.isTimer = false;
        self.timer = null;
        self.timerPool = {};
        self.adList = {};
        self.adPool = {};
        self.adGroupedByRolls = {};
        self.onPauseRollAdPods = [];
        self.currentOnPauseRollAd = '';
        self.preRollAdsResolved = false;
        self.preRollAdPods = [];
        self.preRollAdPodsLength = 0;
        self.preRollVastResolved = 0;
        self.temporaryAdPods = [];
        self.availableRolls = ['preRoll', 'midRoll', 'postRoll', 'onPauseRoll'];
        self.supportedNonLinearAd = ['300x250', '468x60', '728x90'];
        self.autoplayAfterAd = true;
        self.nonLinearDuration = 15;
        self.supportedStaticTypes = ['image/gif', 'image/jpeg', 'image/png'];
        self.inactivityTimeout = null;
        self.isUserActive = null;
        self.nonLinearVerticalAlign = 'bottom';
        self.vpaidNonLinearCloseButton = true;
        self.showTimeOnHover = true;
        self.initialAnimationSet = true;
        self.theatreMode = false;
        self.theatreModeAdvanced = false;
        self.fullscreenMode = false;
        self.originalWidth = playerNode.offsetWidth;
        self.originalHeight = playerNode.offsetHeight;
        self.dashPlayer = false;
        self.hlsPlayer = false;
        self.dashScriptLoaded = false;
        self.hlsScriptLoaded = false;
        self.isPlayingMedia = false;
        self.isSwitchingSource = false;
        self.isLoading = false;
        self.isInIframe = self.inIframe();
        self.mainVideoReadyState = false;
        self.xmlCollection = [];
        self.inLineFound = null;
        self.fluidStorage = {};
        self.fluidPseudoPause = false;
        self.mobileInfo = self.getMobileOs();
        self.events = {};
        self.menu = {
            enabledModules: 0,
            inSubmenu: false,
            option: {
                height: 27,
                width: 0
            },
            width: 185,
            height: 28,
            qualityLevels: {
                option: {
                    height: 26,
                    width: 0
                },
                width: 115,
                height: 67,
                current: -1
            },
            playbackRate: {
                width: 110,
                height: 171,
            }
        }
        self.updateInterval = null;
        self.updateRefreshInterval = 60;
        self.multipleVideoSources = false;
        self.playButtonTimer = null;

        //Default options
        self.displayOptions = {
            layoutControls: {
                mediaType: self.getCurrentSrcType(),
                primaryColor: false,
                posterImage: false,
                posterImageSize: 'contain',
                adProgressColor: '#f9d300',
                playButtonShowing: true,
                playPauseAnimation: false,
                closeButtonCaption: 'Close', // Remove?
                fillToContainer: false,
                autoPlay: false,
                preload: 'auto',
                mute: false,
                loop: false,
                keyboardControl: true,
                allowDownload: false,
                showCardBoardView: false,
                showCardBoardJoystick: false,
                allowTheatre: true,
                doubleclickFullscreen: true,
                menu: {
                    loop: false,
                    autoPlay: true,
                    playbackRate: true,
                    qualityLevels: true,
                    hotspots: false,
                    subtitles: false,
                },
                theatreSettings: {
                    width: '100%',
                    height: '60%',
                    marginTop: 0,
                    horizontalAlign: 'center',
                    keepPosition: false
                },
                theatreAdvanced: false,
                title: null,
                logo: {
                    imageUrl: null,
                    position: 'top left',
                    clickUrl: null,
                    opacity: 1,
                    mouseOverImageUrl: null,
                    imageMargin: '2px',
                    hideWithControls: false,
                    showOverAds: false
                },
                controlBar: {
                    autoHide: false,
                    autoHideTimeout: 3,
                    animated: true
                },
                timelinePreview: {
                    spriteImage: false,
                    spriteRelativePath: false
                },
                htmlOnPauseBlock: {
                    html: null,
                    height: null,
                    width: null
                },
                layout: 'default', //options: 'default', '<custom>'
                playerInitCallback: (function () {
                }),
                persistentSettings: {
                    volume: true,
                    quality: true,
                    speed: true,
                    theatre: true
                },
                controlForwardBackward: {
                    show: false
                },
                contextMenu: {
                    controls: true,
                    links: []
                },
            },
            vastOptions: {
                adList: {},
                skipButtonCaption: 'Skip ad in [seconds]',
                skipButtonClickCaption: 'Skip Ad <span class="skip_button_icon"></span>',
                adText: null,
                adTextPosition: 'top left',
                adCTAText: 'Visit now!',
                adCTATextPosition: 'bottom right',
                adClickable: true,
                vastTimeout: 5000,
                showProgressbarMarkers: false,
                allowVPAID: false,
                showPlayButton: false,
                maxAllowedVastTagRedirects: 3,
                vpaidTimeout: 3000,

                vastAdvanced: {
                    vastLoadedCallback: (function () {
                    }),
                    noVastVideoCallback: (function () {
                    }),
                    vastVideoSkippedCallback: (function () {
                    }),
                    vastVideoEndedCallback: (function () {
                    })
                }
            },
            captions: {
                play: 'Play',
                pause: 'Pause',
                mute: 'Mute',
                unmute: 'Unmute',
                fullscreen: 'Fullscreen',
                subtitles: 'Subtitles',
                exitFullscreen: 'Exit Fullscreen',
                shortcutsInfo: 'Keyboard Shortcuts'
            },
            debug: FP_RUNTIME_DEBUG,
            modules: {
                configureHls: (options) => {
                    return options;
                },
                onBeforeInitHls: (hls) => {
                },
                onAfterInitHls: (hls) => {
                },
                configureDash: (options) => {
                    return options;
                },
                onBeforeInitDash: (dash) => {
                },
                onAfterInitDash: (dash) => {
                }
            },
            onBeforeXMLHttpRequestOpen: (request) => {
            },
            onBeforeXMLHttpRequest: (request) => {
                if (FP_RUNTIME_DEBUG || FP_DEVELOPMENT_MODE) {
                    console.debug('[FP_DEBUG] Request made', request);
                }
            }
        };

        if (!!options.hlsjsConfig) {
            console.error('[FP_ERROR] player option hlsjsConfig is removed and has no effect. ' +
                'Use module callbacks instead!')
        }

        // Overriding the default options
        self.overrideOptions(self.displayOptions, options)

        self.setupPlayerWrapper();

        playerNode.addEventListener('webkitfullscreenchange', self.recalculateAdDimensions);
        playerNode.addEventListener('fullscreenchange', self.recalculateAdDimensions);
        playerNode.addEventListener('waiting', self.onRecentWaiting);
        playerNode.addEventListener('pause', self.onFluidPlayerPause);
        playerNode.addEventListener('loadedmetadata', self.mainVideoReady);
        playerNode.addEventListener('error', self.onErrorDetection);
        playerNode.addEventListener('ended', self.onMainVideoEnded);
        playerNode.addEventListener('durationchange', () => {
            self.currentVideoDuration = self.getCurrentVideoDuration();
        });

        if (self.displayOptions.layoutControls.showCardBoardView) {
            // This fixes cross origin errors on three.js
            playerNode.setAttribute('crossOrigin', 'anonymous');
        }

        //Manually load the video duration if the video was loaded before adding the event listener
        self.currentVideoDuration = self.getCurrentVideoDuration();

        if (isNaN(self.currentVideoDuration) || !isFinite(self.currentVideoDuration)) {
            self.currentVideoDuration = 0;
        }

        self.setLayout();

        //Set the volume control state
        self.latestVolume = playerNode.volume;

        // Set the default animation setting
        self.initialAnimationSet = self.displayOptions.layoutControls.playPauseAnimation;

        //Set the custom fullscreen behaviour
        self.handleFullscreen();

        self.initLogo();

        self.initTitle();

        self.initMute();

        self.initLoop();

        self.displayOptions.layoutControls.playerInitCallback();

        self.setupMenu();

        self.setupShortcuts();

        self.sourcesInVideoTag();

        self.createSubtitles();

        self.createCardboard();

        self.userActivityChecker();

        self.setVastList();

        self.setPersistentSettings();

        // DO NOT initialize streamers if there are pre-rolls. It will break the streamers!
        // Streamers will re-initialize once ad has been shown.
        const preRolls = self.findRoll('preRoll');
        if (!preRolls || 0 === preRolls.length) {
            self.initialiseStreamers();
        }

        const _play_videoPlayer = playerNode.play;

        playerNode.play = function () {
            let promise = null;

            if (self.displayOptions.layoutControls.showCardBoardView) {
                if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                    DeviceOrientationEvent.requestPermission()
                        .then(function (response) {
                            if (response === 'granted') {
                                self.debugMessage('DeviceOrientationEvent permission granted!');
                            }
                        })
                        .catch(console.error);
                }
            }

            try {
                promise = _play_videoPlayer.apply(this, arguments);

                if (promise !== undefined && promise !== null) {
                    promise.then(() => {
                        self.isPlayingMedia = true;
                        clearTimeout(self.promiseTimeout);
                    }).catch(error => {
                        console.error('[FP_ERROR] Playback error', error);
                        const isAbortError = (typeof error.name !== 'undefined' && error.name === 'AbortError');
                        // Ignore abort errors which caused for example Safari or autoplay functions
                        // (example: interrupted by a new load request)
                        if (isAbortError) {
                            // Ignore AbortError error reporting
                        } else {
                            self.announceLocalError(202, 'Failed to play video.');
                        }

                        clearTimeout(self.promiseTimeout);
                    });

                    self.promiseTimeout = setTimeout(function () {
                        if (self.isPlayingMedia === false) {
                            self.announceLocalError(204, '[FP_ERROR] Timeout error. Failed to play video?');
                        }
                    }, 5000);

                }

                return promise;
            } catch (error) {
                console.error('[FP_ERROR] Playback error', error);
                self.announceLocalError(201, 'Failed to play video.');
            }
        };

        const videoPauseOriginal = playerNode.pause;
        playerNode.pause = function () {
            if (self.isPlayingMedia === true) {
                self.isPlayingMedia = false;
                return videoPauseOriginal.apply(this, arguments);
            }

            // just in case
            if (self.isCurrentlyPlayingVideo(self.domRef.player)) {
                try {
                    self.isPlayingMedia = false;
                    return videoPauseOriginal.apply(this, arguments);
                } catch (e) {
                    self.announceLocalError(203, 'Failed to play video.');
                }
            }
        };

        if (self.applyAutoPlay() && !self.dashScriptLoaded && !self.hlsScriptLoaded) {
            //There is known issue with Safari 11+, will prevent autoPlay, so we wont try
            const browserVersion = self.getBrowserVersion();

            if ('Safari' === browserVersion.browserName) {
                return;
            }

            playerNode.play();
        }

        const videoWrapper = self.domRef.wrapper;

        if (!self.mobileInfo.userOs) {
            videoWrapper.addEventListener('mouseleave', self.handleMouseleave, false);
            videoWrapper.addEventListener('mouseenter', self.showControlBar, false);
            videoWrapper.addEventListener('mouseenter', self.showTitle, false);
        } else {
            //On mobile mouseleave behavior does not make sense, so it's better to keep controls, once the playback starts
            //Autohide behavior on timer is a separate functionality
            self.hideControlBar();
            videoWrapper.addEventListener('touchstart', self.showControlBar, false);
        }

        //Keyboard Controls
        if (self.displayOptions.layoutControls.keyboardControl) {
            self.keyboardControl();
        }

        if (self.displayOptions.layoutControls.controlBar.autoHide) {
            self.linkControlBarUserActivity();
        }

        // Hide the captions on init if user added subtitles track.
        // We are taking captions track kind of as metadata
        try {
            if (!!self.domRef.player.textTracks) {
                for (const textTrack of self.domRef.player.textTracks) {
                    textTrack.mode = 'hidden';
                }
            }
        } catch (_ignored) {
        }
    };

    self.overrideOptions = (opt1, opt2) => {
        for (let key in opt2) {
            if (opt2[key] != null && typeof opt2[key] == 'object') {
                if (Object.keys(opt1[key]).length === 0) {
                    opt1[key] = opt2[key];
                } else {
                    self.overrideOptions(opt1[key], opt2[key]);
                }
            } else {
                opt1[key] = opt2[key];
            }
        }
    }

    self.getCurrentVideoDuration = () => {
        if (self.domRef.player) {
            return self.domRef.player.duration;
        }

        return 0;
    };

    self.toggleLoader = (showLoader) => {
        self.isLoading = !!showLoader;

        const loaderDiv = self.domRef.controls.loader;

        loaderDiv.style.opacity = showLoader ? '1' : '0';
    };

    self.onMainVideoEnded = (event) => {
        self.debugMessage('onMainVideoEnded is called');

        if (self.isCurrentlyPlayingAd && self.autoplayAfterAd) {  // It may be in-stream ending, and if it's not postroll then we don't execute anything
            return;
        }

        //we can remove timer as no more ad will be shown
        if (Math.floor(self.getCurrentTime()) >= Math.floor(self.mainVideoDuration)) {

            // play pre-roll ad
            // sometime pre-roll ad will be missed because we are clearing the timer
            self.adKeytimePlay(Math.floor(self.mainVideoDuration));

            clearInterval(self.timer);
        }

        if (self.applyLoop()) {
            self.switchToMainVideo();
            self.playPauseToggle();
        }
    };

    self.getCurrentTime = () => {
        return self.isCurrentlyPlayingAd
            ? self.mainVideoCurrentTime
            : self.domRef.player.currentTime;
    };

    /**
     * Gets the src value of the first source element of the video tag.
     *
     * @returns string|null
     */
    self.getCurrentSrc = () => {
        const sources = self.domRef.player.getElementsByTagName('source');

        if (sources.length) {
            return sources[0].getAttribute('src');
        }

        return null;
    };

    /**
     * Src types required for streaming elements
     */
    self.getCurrentSrcType = () => {
        const sources = self.domRef.player.getElementsByTagName('source');

        if (!sources.length) {
            return null;
        }

        for (let i = 0; i < sources.length; i++) {
            if (sources[i].getAttribute('src') === self.originalSrc) {
                return sources[i].getAttribute('type').toLowerCase();
            }
        }

        return null;
    };

    self.onRecentWaiting = () => {
        self.recentWaiting = true;

        setTimeout(function () {
            self.recentWaiting = false;
        }, 1000);
    };

    self.findRoll = (roll) => {
        const ids = [];
        ids.length = 0;

        if (!roll || !self.hasOwnProperty('adList')) {
            return;
        }

        for (let key in self.adList) {
            if (!self.adList.hasOwnProperty(key)) {
                continue;
            }

            if (self.adList[key].roll === roll) {
                ids.push(key);
            }
        }

        return ids;
    };

    self.setDefaultLayout = () => {
        self.domRef.wrapper.className += ' fluid_player_layout_' + self.displayOptions.layoutControls.layout;

        self.setCustomContextMenu();

        const controls = self.generateCustomControlTags({
            displayVolumeBar: self.checkShouldDisplayVolumeBar(),
            primaryColor: self.displayOptions.layoutControls.primaryColor
                ? self.displayOptions.layoutControls.primaryColor
                : '#f00',
            controlForwardBackward: !!self.displayOptions.layoutControls.controlForwardBackward.show
        });

        // Remove the default controls
        self.domRef.player.removeAttribute('controls');

        // Insert custom controls and append loader
        self.domRef.player.parentNode.insertBefore(controls.root, self.domRef.player.nextSibling);
        self.domRef.player.parentNode.insertBefore(controls.loader, self.domRef.player.nextSibling);

        // Register controls locally
        self.domRef.controls = Object.assign(controls, self.domRef.controls);

        /**
         * Set the volumebar after its elements are properly rendered.
         */
        let remainingAttemptsToInitiateVolumeBar = 100;

        const initiateVolumebar = function () {
            if (!remainingAttemptsToInitiateVolumeBar) {
                clearInterval(initiateVolumebarTimerId);
            } else if (self.checkIfVolumebarIsRendered()) {
                clearInterval(initiateVolumebarTimerId);
                self.contolVolumebarUpdate(self.videoPlayerId);
            } else {
                remainingAttemptsToInitiateVolumeBar--;
            }
        };
        let initiateVolumebarTimerId = setInterval(initiateVolumebar, 100);

        if (self.displayOptions.layoutControls.doubleclickFullscreen) {
            self.domRef.player.addEventListener('dblclick', self.fullscreenToggle);
        }

        self.initHtmlOnPauseBlock();

        self.setCustomControls();

        self.setupThumbnailPreview();

        self.createTimePositionPreview();

        self.posterImage();

        self.initPlayButton();

        self.setVideoPreload();

        self.createDownload();

        if (!!self.displayOptions.layoutControls.controlForwardBackward.show) {
            self.initSkipControls();
        }
    };

    self.initSkipControls = () => {
        const skipFunction = (period) => {
            if (self.isCurrentlyPlayingAd) {
                return;
            }

            let skipTo = self.domRef.player.currentTime + period;
            if (skipTo < 0) {
                skipTo = 0;
            }
            self.domRef.player.currentTime = skipTo;
        };

        self.domRef.controls.skipBack.addEventListener('click', skipFunction.bind(this, -10));
        self.domRef.controls.skipForward.addEventListener('click', skipFunction.bind(this, 10));
    };

    self.setLayout = () => {
        //All other browsers
        const listenTo = (self.isTouchDevice()) ? 'touchend' : 'click';
        self.domRef.player.addEventListener(listenTo, () => self.playPauseToggle(), false);
        //Mobile Safari - because it does not emit a click event on initial click of the video
        self.domRef.player.addEventListener('play', self.initialPlay, false);
        self.setDefaultLayout();
    };

    self.setupPlayerWrapper = () => {
        const fillToContainer = self.displayOptions.layoutControls.fillToContainer;
        self.domRef.wrapper = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_video_wrapper',
            className: self.isTouchDevice() ? 'fluid_video_wrapper mobile' : 'fluid_video_wrapper',
            style: {
                //Assign the height/width dimensions to the wrapper
                ...(fillToContainer) && {
                    width: '100%',
                    height: '100%'
                },
                ...(!fillToContainer) && {
                    width: self.domRef.player.clientWidth + 'px',
                    height: self.domRef.player.clientHeight + 'px'
                },
            },
        });

        self.domRef.player.style.height = '100%';
        self.domRef.player.style.width = '100%';

        self.domRef.player.parentNode.insertBefore(self.domRef.wrapper, self.domRef.player);
        self.domRef.wrapper.appendChild(self.domRef.player);
    };

    self.onErrorDetection = () => {
        if (self.domRef.player.networkState === self.domRef.player.NETWORK_NO_SOURCE && self.isCurrentlyPlayingAd) {
            //Probably the video ad file was not loaded successfully
            self.playMainVideoWhenVastFails(401);
        }
    };

    self.sourcesInVideoTag = () => {
        const sourcesList = self.domRef.player.querySelectorAll('source');
        if (sourcesList.length == 0) {
            return;
        }

        if (sourcesList.length == 1) {
            if (!self.isHLS(sourcesList[0].src) && self.isEnabledModule('qualityLevels')) {
                self.removeOption('qualitySelector');
            }
            return;
        }

        self.multipleVideoSources = true;

        let firstStreamingSource = false;
        const sources = [];
        for (const [index, source] of sourcesList.entries()) {
            if (source.src && source.type) {
                if (self.mobileInfo.userOs === 'iOS' && self.isMKV(source.src)) {
                    continue;
                }
                if (index == 0) {
                    if (self.isHLS(source.src) || self.isDASH(source.src)) {
                        firstStreamingSource = true;
                    }
                }
                sources.push({
                    title: source.title,
                    src: source.src,
                    isHD: source.getAttribute('data-fluid-hd') != null
                });
            }
        }

        sources.reverse();
        self.videoSources = sources;
        self.insertQualityLevels(sources);

        if (firstStreamingSource) {
            const interval = setInterval(() => {
                if (window.Hls || window.dashjs.MediaPlayer) {
                    self.applyQualityLevel(sources);
                    clearInterval(interval);
                }
            }, 100);
        } else {
            self.applyQualityLevel(sources);
        }
    }

    self.setVideoSource = (url) => {
        if (self.mobileInfo.userOs === 'iOS' && self.isMKV(url)) {
            console.log('[FP_ERROR] .mkv files not supported by iOS devices.');
            return false;
        }

        if (url == self.originalSrc) {
            return;
        }

        if (self.isCurrentlyPlayingAd) {
            self.originalSrc = url;
            return;
        }

        self.isSwitchingSource = true;
        let play = false;
        if (!self.domRef.player.paused) {
            self.domRef.player.pause();
            play = true;
        }

        const currentTime = self.domRef.player.currentTime;
        self.setCurrentTimeAndPlay(currentTime, play);

        self.domRef.player.src = url;
        self.originalSrc = url;
        self.displayOptions.layoutControls.mediaType = self.getCurrentSrcType();
        self.initialiseStreamers();
    };

    self.setCurrentTimeAndPlay = (newCurrentTime, shouldPlay) => {
        const loadedMetadata = () => {
            self.domRef.player.currentTime = newCurrentTime;
            self.domRef.player.removeEventListener('loadedmetadata', loadedMetadata);
            // Safari ios and mac fix to set currentTime
            if (self.mobileInfo.userOs === 'iOS' || self.getBrowserVersion().browserName.toLowerCase() === 'safari') {
                self.domRef.player.addEventListener('playing', videoPlayStart);
            }

            if (shouldPlay) {
                self.domRef.player.play();
            } else {
                self.domRef.player.pause();
                self.controlPlayPauseToggle(self.videoPlayerId);
            }

            self.isSwitchingSource = false;
            self.domRef.player.style.width = '100%';
            self.domRef.player.style.height = '100%';
        };

        let videoPlayStart = () => {
            self.currentTime = newCurrentTime;
            self.domRef.player.removeEventListener('playing', videoPlayStart);
        };

        self.domRef.player.addEventListener('loadedmetadata', loadedMetadata, false);
        self.domRef.player.load();
    };



    /**
     * Play button in the middle when the video loads
     */
    self.initPlayButton = () => {
        // Create the html for the play button
        self.domRef.controls.initialPlayButtonContainer = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_initial_play_button',
            className: 'fluid_html_on_pause',
        });

        const backgroundColor = (self.displayOptions.layoutControls.primaryColor) ? self.displayOptions.layoutControls.primaryColor : '#333333';

        self.domRef.controls.initialPlayButton = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_initial_play',
            className: 'fluid_initial_play',
            style: {
                backgroundColor: backgroundColor
            },
            parent: self.domRef.controls.initialPlayButtonContainer,
        });

        self.domRef.controls.stateButton = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_state_button',
            className: 'fluid_initial_play_button',
            parent: self.domRef.controls.initialPlayButton,
        });

        const initPlayFunction = () => {
            self.playPauseToggle();
            self.domRef.controls.initialPlayButtonContainer.removeEventListener('click', initPlayFunction);

            self.domRef.controls.initialPlayButton.addEventListener('click', () => {
                self.domRef.controls.initialPlayButton.style.cursor = 'default';
                self.playPauseToggle();
                self.domRef.controls.initialPlayButton.addEventListener('dblclick', self.fullscreenToggle);
            });
        }
        self.domRef.controls.initialPlayButtonContainer.addEventListener('click', initPlayFunction);
        // If the user has chosen to not show the play button we'll make it invisible
        // We don't hide altogether because animations might still be used
        if (!self.displayOptions.layoutControls.playButtonShowing) {
            const initialControlsDisplay = self.domRef.controls.root;
            initialControlsDisplay.classList.add('initial_controls_show');
            self.domRef.controls.initialPlayButtonContainer.style.opacity = '0';
        }

        self.domRef.player.parentNode.insertBefore(self.domRef.controls.initialPlayButtonContainer, null);
    };

    /**
     * Set the mainVideoDuration property one the video is loaded
     */
    self.mainVideoReady = () => {
        if (!(self.mainVideoDuration === 0 && !self.isCurrentlyPlayingAd && self.mainVideoReadyState === false)) {
            return;
        }
        const event = new CustomEvent('mainVideoDurationSet');

        self.mainVideoDuration = self.domRef.player.duration;
        self.mainVideoReadyState = true;
        self.domRef.player.dispatchEvent(event);
        self.domRef.player.removeEventListener('loadedmetadata', self.mainVideoReady);
    };

    self.userActivityChecker = () => {
        const videoPlayer = self.domRef.wrapper;
        self.newActivity = null;

        let isMouseStillDown = false;

        const activity = event => {
            if (event.type === 'touchstart' || event.type === 'mousedown') {
                isMouseStillDown = true;
            }
            if (event.type === 'touchend' || event.type === 'mouseup') {
                isMouseStillDown = false;
            }
            self.newActivity = true;
        };

        setInterval(() => {
            if (self.newActivity !== true) {
                return;
            }

            if (!isMouseStillDown && !self.isLoading) {
                self.newActivity = false;
            }

            if (self.isUserActive === false || !self.isControlBarVisible()) {
                let event = new CustomEvent('userActive');
                self.domRef.player.dispatchEvent(event);
                self.isUserActive = true;
            }

            clearTimeout(self.inactivityTimeout);

            self.inactivityTimeout = setTimeout(() => {
                if (self.newActivity === true) {
                    clearTimeout(self.inactivityTimeout);
                    return;
                }

                self.isUserActive = false;

                let event = new CustomEvent('userInactive');
                self.domRef.player.dispatchEvent(event);
            }, self.displayOptions.layoutControls.controlBar.autoHideTimeout * 1000);
        }, 300);

        const listenTo = (self.isTouchDevice())
            ? ['touchstart', 'touchmove', 'touchend']
            : ['mousemove', 'mousedown', 'mouseup'];

        for (let i = 0; i < listenTo.length; i++) {
            videoPlayer.addEventListener(listenTo[i], activity);
        }
    };

    self.setVideoPreload = () => {
        self.domRef.player.setAttribute('preload', self.displayOptions.layoutControls.preload);
    };

    self.initLoop = () => {
        self.domRef.player.loop = self.applyLoop();
    };

    self.setBuffering = () => {
        let progressInterval;
        const bufferBar = self.domRef.player.parentNode.getElementsByClassName('fluid_controls_buffered');

        for (let j = 0; j < bufferBar.length; j++) {
            bufferBar[j].style.width = 0;
        }

        // Buffering
        const logProgress = () => {
            const duration = self.domRef.player.duration;
            if (duration <= 0) {
                return;
            }

            for (let i = 0; i < self.domRef.player.buffered.length; i++) {
                if (self.domRef.player.buffered.start(self.domRef.player.buffered.length - 1 - i) >= self.domRef.player.currentTime) {
                    continue;
                }

                const newBufferLength = (self.domRef.player.buffered.end(self.domRef.player.buffered.length - 1 - i) / duration) * 100 + '%';

                for (let j = 0; j < bufferBar.length; j++) {
                    bufferBar[j].style.width = newBufferLength;
                }

                // Stop checking for buffering if the video is fully buffered
                if (!!progressInterval && 1 === (self.domRef.player.buffered.end(self.domRef.player.buffered.length - 1 - i) / duration)) {
                    clearInterval(progressInterval);
                }

                break;
            }
        };
        progressInterval = setInterval(logProgress, 500);
    };

    // Set the poster for the video, taken from custom params
    // Cannot use the standard video tag poster image as it can be removed by the persistent settings
    self.posterImage = () => {
        if (!self.displayOptions.layoutControls.posterImage) {
            return;
        }

        const containerDiv = document.createElement('div');
        containerDiv.id = self.videoPlayerId + '_fluid_pseudo_poster';
        containerDiv.className = 'fluid_pseudo_poster';
        if (['auto', 'contain', 'cover'].indexOf(self.displayOptions.layoutControls.posterImageSize) === -1) {
            console.log('[FP_ERROR] Not allowed value in posterImageSize');
            return;
        }
        containerDiv.style.background = "url('" + self.displayOptions.layoutControls.posterImage + "') center center / "
            + self.displayOptions.layoutControls.posterImageSize + ' no-repeat black';
        self.domRef.player.parentNode.insertBefore(containerDiv, null);
    };

    // This is called when a media type is unsupported. We'll find the current source and try set the next source if it exists
    self.nextSource = () => {
        const sources = self.domRef.player.getElementsByTagName('source');

        if (!sources.length) {
            return null;
        }

        for (let i = 0; i < sources.length - 1; i++) {
            if (sources[i].getAttribute('src') === self.originalSrc && sources[i + 1].getAttribute('src')) {
                self.setVideoSource(sources[i + 1].getAttribute('src'));
                return;
            }
        }
    };

    // "API" Functions
    self.play = () => {
        if (!self.domRef.player.paused) {
            return;
        }
        self.playPauseToggle();
        return true;
    };

    self.pause = () => {
        if (!self.domRef.player.paused) {
            self.playPauseToggle();
        }
        return true;
    };

    self.skipTo = (time) => {
        self.domRef.player.currentTime = time;
    };

    self.isCurrentlyPlayingVideo = (instance) => {
        return instance && instance.currentTime > 0 && !instance.paused && !instance.ended && instance.readyState > 2;
    };

    self.destroy = () => {
        const numDestructors = self.destructors.length;

        if (0 === numDestructors) {
            return;
        }

        for (let i = 0; i < numDestructors; ++i) {
            self.destructors[i].bind(this)();
        }

        const container = self.domRef.wrapper;

        if (!container) {
            console.warn('Unable to remove wrapper element for Fluid Player instance - element not found ' + self.videoPlayerId);
            return;
        }

        if ('function' === typeof container.remove) {
            container.remove();
            return;
        }

        if (container.parentNode) {
            container.parentNode.removeChild(container);
            return;
        }

        console.error('Unable to remove wrapper element for Fluid Player instance - no parent' + self.videoPlayerId);
    }
};

/**
 * Public Fluid Player API interface
 * @param instance
 */
const playerInterface = function (instance) {
    this.play = () => {
        return instance.play()
    };

    this.pause = () => {
        return instance.pause()
    };

    this.skipTo = (position) => {
        return instance.skipTo(position)
    };

    this.setPlaybackSpeed = (speed) => {
        return instance.setPlaybackSpeed(speed)
    };

    this.setVolume = (volume) => {
        return instance.setVolume(volume)
    };

    this.setHtmlOnPauseBlock = (options) => {
        return instance.setHtmlOnPauseBlock(options)
    };

    this.toggleControlBar = (state) => {
        return instance.toggleControlBar(state)
    };

    this.toggleFullScreen = (state) => {
        return instance.fullscreenToggle(state)
    };

    this.destroy = () => {
        return instance.destroy()
    };

    this.dashInstance = () => {
        return !!instance.dashPlayer ? instance.dashPlayer : null;
    }

    this.hlsInstance = () => {
        return !!instance.hlsPlayer ? instance.hlsPlayer : null;
    }

    this.on = (event, callback) => {
        return instance.on(event, callback)
    };
}

/**
 * Initialize and attach Fluid Player to instance of HTMLVideoElement
 *
 * @param target ID of HTMLVideoElement or reference to HTMLVideoElement
 * @param options Fluid Player configuration options
 * @returns {playerInterface}
 */
const playerInitializer = function (target, options) {
    const instance = new playerClass();

    if (!options) {
        options = {};
    }

    instance.init(target, options);

    const publicInstance = new playerInterface(instance);

    if (window && FP_DEVELOPMENT_MODE) {
        const debugApi = {
            id: target,
            options: options,
            instance: publicInstance,
            internals: instance
        };

        if (typeof window.fluidPlayerDebug === 'undefined') {
            window.fluidPlayerDebug = [];
        }

        window.fluidPlayerDebug.push(debugApi);

        console.log('Created instance of Fluid Player. ' +
            'Debug API available at window.fluidPlayerDebug[' + (window.fluidPlayerDebug.length - 1) + '].', debugApi);
    }

    return publicInstance;
}

if (FP_DEVELOPMENT_MODE) {
    console.log('Fluid Player - Development Build' + (FP_RUNTIME_DEBUG ? ' (in debug mode)' : ''));
}

export default playerInitializer;
