// Player modules
import ControlBar from './control-bar/control-bar';
import Controls from './control-bar/controls';
import Download from './control-bar/download';
import Fullscreen from './fullscreen';
import Theatre from './control-bar/theatre';
import Preview from './control-bar/preview';
import VolumeControl from './control-bar/volume';
import ContextMenu from './context-menu';

import Menu from './menu/menu';
import Loop from './menu/loop';
import Autoplay from './menu/autoplay';
import Speed from './menu/playback-rate';
import Subtitles from './menu/subtitles';
import Quality from './menu/quality-levels';

import Storage from './storage';

import AdSupport from './vast/adsupport';
import Vast from './vast/vast';
import Vpaid from './vast/vpaid';

import HtmlOnPause from './html-on-pause';
import Logo from './logo';
import Fps from './fps';
import Shortcuts from './shortcuts';
import Streaming from './streaming/streaming';
import Title from './title';

import Console from './console';
import defaults from './config/defaults';
import PlayPause from './control-bar/play-pause';
import ProgressBar from './control-bar/progress-bar';
import Listeners from './listeners/listeners';
import Skip from './control-bar/skip';
import Keyboard from './listeners/keyboard';
import UserActivity from './user-activity';

import { isDASH, isHLS, isMKV, isSource } from './utils/media';
import { createElement, insertAfter, toggleClass } from './utils/dom';
import { off, on, once, unbindListeners } from './utils/events';
import { IS_IOS, IS_ANY_SAFARI, TOUCH_ENABLED } from './utils/browser';
import is from './utils/is';

// TODO: remove after tweaking adsupport, vast and vpaid
const FP_MODULES = [AdSupport, Vast, Vpaid];

class CVP {
    constructor(target, options) {
        this.version = FP_BUILD_VERSION;
        this.homepage = FP_HOMEPAGE;

        // Set the media element
        this.media = target;

        if (is.string(this.media)) {
            this.media = document.getElementById(target);
        }

        // Set config
        this.config = defaults;

        // Overwrite config
        this.overwrite(options, this.config);

        if (FP_ENV === 'development') {
            this.config.debug = true;
        }

        // Debugging
        this.debug = new Console(this.config.debug);

        if (!(this.media instanceof HTMLVideoElement)) {
            this.debug.error('Invalid initializer - player target must be HTMLVideoElement or ID');
            return;
        }

        if (this.media.cvp) {
            this.debug.warn('Target already setup');
            return;
        }

        // Store reference
        this.media.cvp = this;

        // TODO: don't use this anymore, remove after tweaking adsupport, vast and vpaid
        this.videoPlayerId = !is.empty(this.media.id) ? this.media.id : `fp_instance_${playerInstances++}`;
        this.originalSrc = this.getCurrentSrc();
        this.originalWidth = this.media.offsetWidth;
        this.originalHeight = this.media.offsetHeight;
        this.config.layoutControls.mediaType = this.getCurrentSrcType();

        // Global variables
        this.defineVariables();

        // All control elements
        this.controls = new Controls(this);

        // Install modules
        for (const playerModule of FP_MODULES) {
            playerModule(this);
        }

        // Listen for events if debugging
        if (this.config.debug) {
            on.call(this, this.media, this.config.events.join(' '), (event) => {
                this.debug.log(`event: ${event.type}`);
            });
        }

        // Setup local storage for user settings
        this.storage = new Storage(this);

        this.setupWrapper();
        this.setupTouchDevice();
        this.setupMedia();
        this.setupControlBar();

        // Setup user activity
        this.userActivity = new UserActivity(this);

        // Create listeners
        this.listeners = new Listeners(this);

        // Setup the keyboard and its listeners
        this.keyboard = new Keyboard(this);
        if (this.config.layoutControls.keyboardControl) {
            this.keyboard.listeners();
        }

        // Apply persistent settings
        this.setPersistentSettings();

        // Apply mute
        this.initMute();

        // Set sources
        this.sourcesInVideoTag();

        // Setup vast
        this.setVastList();

        this.config.layoutControls.playerInitCallback();

        // DO NOT initialize streamers if there are pre-rolls. It will break the streamers!
        // Streamers will re-initialize once ad has been shown.
        const preRolls = this.findRoll('preRoll');
        if (!preRolls || preRolls.length === 0) {
            this.streaming.init();
        } else {
            if (isHLS(this.originalSrc) || isDASH(this.originalSrc)) {
                this.autoPlay.apply();
            }
        }

        const play = this.media.play;
        this.media.play = () => {
            const promise = play.apply(this.media, arguments);

            if (!is.promise(promise)) {
                return null;
            }

            promise
                .then(() => {
                    clearTimeout(this.promiseTimeout);
                })
                .catch((error) => {
                    this.debug.error(error);
                    clearTimeout(this.promiseTimeout);
                });

            this.promiseTimeout = setTimeout(() => {
                this.debug.error('Timeout error. Failed to play video?');
            }, 5000);

            return promise;
        };
    }

    defineVariables = () => {
        this.recentWaiting = false;
        this.firstPlayLaunched = false;
        this.isSwitchingSource = false;
        this.isLoading = false;
        this.eventListeners = [];
        this.multipleVideoSources = false;

        // TODO: ads, remove after tweaking adsupport, vast and vpaid
        this.suppressClickthrough = false;
        this.vpaidTimer = null;
        this.vpaidAdUnit = null;
        this.vastOptions = null;
        this.isCurrentlyPlayingAd = false;
        this.mainVideoCurrentTime = 0;
        this.isTimer = false;
        this.timer = null;
        this.timerPool = {};
        this.adList = {};
        this.adPool = {};
        this.adGroupedByRolls = {};
        this.onPauseRollAdPods = [];
        this.currentOnPauseRollAd = '';
        this.preRollAdsResolved = false;
        this.preRollAdPods = [];
        this.preRollAdPodsLength = 0;
        this.preRollVastResolved = 0;
        this.temporaryAdPods = [];
        this.availableRolls = ['preRoll', 'midRoll', 'postRoll', 'onPauseRoll'];
        this.supportedNonLinearAd = ['300x250', '468x60', '728x90'];
        this.autoplayAfterAd = true;
        this.nonLinearDuration = 15;
        this.supportedStaticTypes = ['image/gif', 'image/jpeg', 'image/png'];
        this.nonLinearVerticalAlign = 'bottom';
        this.vpaidNonLinearCloseButton = true;
        this.inLineFound = null;
    };

    setupWrapper = () => {
        this.wrapper = createElement('div', {
            class: 'fluid_video_wrapper',
        });

        this.wrapper.className += ' fluid_player_layout_' + this.config.layoutControls.layout;

        // Assign the height/width dimensions to the wrapper
        let width = `${this.media.clientWidth}px`;
        let height = `${this.media.clientHeight}px`;

        if (this.config.layoutControls.fillToContainer) {
            width = '100%';
            height = '100%';
        }

        this.wrapper.style.width = width;
        this.wrapper.style.height = height;

        insertAfter(this.wrapper, this.media);
        this.wrapper.appendChild(this.media);

        insertAfter(this.controls.container, this.media);
        insertAfter(this.controls.loader, this.media);

        this.posterImage();

        this.logo = new Logo(this);

        this.title = new Title(this);

        this.shortcuts = new Shortcuts(this);
    };

    setupMedia = () => {
        this.media.style.width = '100%';
        this.media.style.height = '100%';

        this.media.setAttribute('playsinline', '');
        this.media.setAttribute('webkit-playsinline', '');

        this.setVideoPreload();

        // Remove the default controls
        this.media.removeAttribute('controls');

        this.menu = new Menu(this);
        this.subtitles = new Subtitles(this);

        this.streaming = new Streaming(this);

        this.fps = new Fps(this);
    };

    setupControlBar = () => {
        this.controlBar = new ControlBar(this);
        if (this.config.layoutControls.controlBar.autoHide) {
            this.controlBar.linkControlBarUserActivity();
        }

        this.playPause = new PlayPause(this);

        this.progressBar = new ProgressBar(this);

        this.preview = new Preview(this);

        if (this.config.layoutControls.controlForwardBackward.show) {
            this.skipControls = new Skip(this);
        }

        this.volumeControl = new VolumeControl(this);

        this.autoPlay = new Autoplay(this);
        this.loopMenu = new Loop(this);
        this.speedMenu = new Speed(this);
        this.subtitles.init();
        this.quality = new Quality(this);
        this.menu.init();

        this.download = new Download(this);
        this.theatre = new Theatre(this);
        this.fullscreen = new Fullscreen(this);

        this.HtmlOnPause = new HtmlOnPause(this);

        this.contextMenu = new ContextMenu(this);
    };

    resize = () => {
        this.recalculateAdDimensions();
        this.resizeVpaidAuto();
        this.progressBar.resize();
    }

    overwrite = (from, to) => {
        for (const key in from) {
            if (is.object(from[key])) {
                this.overwrite(from[key], to[key]);
            } else {
                to[key] = from[key];
            }
        }
    };

    toggleLoader = (show) => {
        this.isLoading = show;
        this.controls.loader.style.opacity = show ? '1' : '0';
    };

    // TODO: ads, remove after tweaking adsupport, vast and vpaid
    onMainVideoEnded = () => {
        if (this.isCurrentlyPlayingAd && this.autoplayAfterAd) {
            // It may be in-stream ending, and if it's not postroll then we don't execute anything
            return;
        }

        // we can remove timer as no more ad will be shown
        if (Math.floor(this.getCurrentTime()) >= Math.floor(this.duration)) {
            // play pre-roll ad
            // sometime pre-roll ad will be missed because we are clearing the timer
            this.adKeytimePlay(Math.floor(this.duration));

            clearInterval(this.timer);
        }

        this.loopMenu.apply();
    };

    // TODO: ads, remove after tweaking adsupport, vast and vpaid
    getCurrentTime = () => {
        return this.isCurrentlyPlayingAd ? this.mainVideoCurrentTime : this.currentTime;
    };

    /**
     * Gets the src value of the first source element of the video tag.
     *
     * @returns string|null
     */
    getCurrentSrc = () => {
        const sources = this.media.getElementsByTagName('source');

        if (sources.length) {
            return sources[0].getAttribute('src');
        }

        return null;
    };

    /**
     * Src types required for streaming elements
     */
    getCurrentSrcType = () => {
        const sources = this.media.getElementsByTagName('source');

        if (!sources.length) {
            return null;
        }

        for (const source of sources) {
            if (source.getAttribute('src') === this.originalSrc) {
                return source.getAttribute('type').toLowerCase();
            }
        }

        return null;
    };

    findRoll = (roll) => {
        const ids = [];
        ids.length = 0;

        if (!roll || !this.hasOwnProperty('adList')) {
            return;
        }

        for (const key in this.adList) {
            if (!this.adList.hasOwnProperty(key)) {
                continue;
            }

            if (this.adList[key].roll === roll) {
                ids.push(key);
            }
        }

        return ids;
    };

    setupTouchDevice = () => {
        if (!TOUCH_ENABLED) {
            return;
        }

        toggleClass(this.wrapper, 'mobile', true);
        toggleClass(this.wrapper, 'fluid_touch', true);

        this.config.layoutControls.controlBar.autoHide = true;
        this.config.layoutControls.playButtonShowing = true;
        this.config.layoutControls.playPauseAnimation = false;
    };

    onErrorDetection = () => {
        if (this.media.networkState === this.media.NETWORK_NO_SOURCE && this.isCurrentlyPlayingAd) {
            // Probably the video ad file was not loaded successfully
            this.playMainVideoWhenVastFails(401);
        }
    };

    setPersistentSettings = () => {
        if (this.config.layoutControls.persistentSettings.volume) {
            this.volumeControl.apply();
            this.volumeControl.update();
        }

        if (this.config.layoutControls.persistentSettings.speed) {
            this.speedMenu.apply();
        }

        if (this.config.layoutControls.persistentSettings.theatre) {
            this.theatre.apply();
        }
    };

    sourcesInVideoTag = () => {
        const sourcesList = this.media.querySelectorAll('source');
        if (sourcesList.length === 0) {
            return;
        }

        if (sourcesList.length === 1) {
            if (!isHLS(sourcesList[0].src)) {
                this.menu.remove('qualityLevels');
            }
            return;
        }

        this.multipleVideoSources = true;

        let firstStreamingSource = false;

        const sources = [];

        for (const [index, source] of sourcesList.entries()) {
            if (!isSource(source.src) || !source.type || (IS_IOS && isMKV(source.src))) {
                continue;
            }

            if (index === 0) {
                if (isHLS(source.src) || isDASH(source.src)) {
                    firstStreamingSource = true;
                }
            }

            sources.push({
                title: source.title,
                src: source.src,
                isHD: source.getAttribute('data-fluid-hd') !== null,
            });
        }

        if (sources.length === 0) {
            return;
        }

        sources.reverse();

        this.videoSources = sources;

        this.quality.add(sources);

        if (firstStreamingSource) {
            const interval = setInterval(() => {
                if (window.Hls || (window.dashjs && is.function(window.dashjs.MediaPlayer))) {
                    this.quality.set(sources);
                    clearInterval(interval);
                }
            }, 100);
        } else {
            this.quality.set(sources);
        }
    };

    setVideoSource = (url) => {
        if (IS_IOS && isMKV(url)) {
            this.debug.error('.mkv files not supported by iOS devices.');
            return;
        }

        if (url === this.originalSrc) {
            if (!isHLS(this.originalSrc) && !isDASH(this.originalSrc)) {
                this.autoPlay.apply();
            }
            return;
        }

        if (this.isCurrentlyPlayingAd) {
            this.originalSrc = url;
            return;
        }

        this.isSwitchingSource = true;

        let play = false;
        if (!this.paused) {
            this.pause();
            play = true;
        }

        this.setCurrentTimeAndPlay(this.currentTime, play);

        this.media.src = url;
        this.originalSrc = url;
        this.config.layoutControls.mediaType = this.getCurrentSrcType();

        this.streaming.init();
    };

    setCurrentTimeAndPlay = (newCurrentTime, shouldPlay) => {
        once.call(this, this.media, 'loadedmetadata', () => {
            this.currentTime = newCurrentTime;

            // Safari ios and mac fix to set currentTime
            if (IS_ANY_SAFARI) {
                once.call(this, this.media, 'canplaythrough', () => {
                    this.currentTime = newCurrentTime;
                });
            }

            if (shouldPlay) {
                this.play();
            } else {
                this.pause();
            }

            if (!isHLS(this.originalSrc) && !isDASH(this.originalSrc)) {
                this.autoPlay.apply();
            }

            this.isSwitchingSource = false;

            this.media.style.width = '100%';
            this.media.style.height = '100%';
        });

        this.media.load();
    };

    setVideoPreload = () => {
        this.media.setAttribute('preload', this.config.layoutControls.preload);
    };

    // Set the poster for the video, taken from custom params
    posterImage = () => {
        if (!this.config.layoutControls.posterImage) {
            return;
        }

        const poster = createElement('div', {
            class: 'fluid_poster',
        });

        if (['auto', 'contain', 'cover'].indexOf(this.config.layoutControls.posterImageSize) === -1) {
            this.debug.error('Not allowed value in posterImageSize');
            return;
        }

        poster.style.backgroundImage = `url('${this.config.layoutControls.posterImage}')`;
        poster.style.backgroundSize = `${this.config.layoutControls.posterImageSize}`;

        this.controls.poster = poster;
        this.wrapper.appendChild(poster);
    };

    // This is called when a media type is unsupported
    // We'll find the current source and try set the next source if it exists
    nextSource = () => {
        const sources = this.media.getElementsByTagName('source');

        if (!sources.length) {
            return null;
        }

        for (let i = 0; i < sources.length - 1; i++) {
            if (sources[i].getAttribute('src') === this.originalSrc && sources[i + 1].getAttribute('src')) {
                this.setVideoSource(sources[i + 1].getAttribute('src'));
                return;
            }
        }
    };

    // "API" Functions
    play = () => {
        if (!is.function(this.media.play)) {
            return null;
        }

        return this.media.play();
    };

    pause = () => {
        if (!this.playing || !is.function(this.media.pause)) {
            return null;
        }

        return this.media.pause();
    };

    set currentTime(input) {
        if (!this.duration) {
            return;
        }

        const inputIsValid = is.number(input) && input > 0;

        this.media.currentTime = inputIsValid ? Math.min(input, this.duration) : 0;
    }

    get currentTime() {
        return Number(this.media.currentTime);
    }

    get duration() {
        const duration = (this.media || {}).duration;
        return !is.number(duration) || duration === Infinity ? 0 : duration;
    }

    set volume(volume) {
        this.media.volume = volume;
    }

    get volume() {
        return Number(this.media.volume);
    }

    initMute = () => {
        if (!this.config.layoutControls.mute) {
            return;
        }

        this.volume = 0;
        this.muted = true;
    };

    toggleMute = () => {
        if (this.volume !== 0 && !this.muted) {
            this.volume = 0;
            this.muted = true;
        } else {
            this.volume = this.volumeControl.latestVolume;
            this.muted = false;
        }

        // Persistent settings
        this.storage.set('volume', this.volumeControl.latestVolume);
        this.storage.set('mute', this.muted);
    };

    set muted(mute) {
        this.media.muted = mute;
    }

    get muted() {
        return Boolean(this.media.muted);
    }

    set speed(input) {
        setTimeout(() => {
            if (this.media) {
                this.media.playbackRate = input;
            }
        }, 500);
    }

    get speed() {
        return Number(this.media.playbackRate);
    }

    set loop(loop) {
        this.media.loop = loop;
    }

    get loop() {
        return Boolean(this.media.loop);
    }

    get playing() {
        return Boolean(!this.paused && !this.ended && this.media.readyState > 2);
    }

    get paused() {
        return Boolean(this.media.paused);
    }

    get ended() {
        return Boolean(this.media.ended);
    }

    skipTo = (time) => {
        this.currentTime = time;
    };

    /**
     * Add event listeners
     * @param {String} event - Event type
     * @param {Function} callback - Callback for when event occurs
     */
    on = (event, callback) => {
        on.call(this, this.media, event, callback);
    };

    /**
     * Add event listeners once
     * @param {String} event - Event type
     * @param {Function} callback - Callback for when event occurs
     */
    once = (event, callback) => {
        once.call(this, this.media, event, callback);
    };

    /**
     * Remove event listeners
     * @param {String} event - Event type
     * @param {Function} callback - Callback for when event occurs
     */
    off = (event, callback) => {
        off(this.media, event, callback);
    };

    destroy = () => {
        const wrapper = this.wrapper;

        if (!is.element(wrapper)) {
            console.warn('Unable to remove wrapper element for Fluid Player instance - element not found');
            return;
        }

        unbindListeners.call(this);

        // destroy video
        if (is.element(this.media)) {
            this.pause();

            this.streaming.detach();

            for (const source of this.media.querySelectorAll('source')) {
                source.remove();
            }

            this.media.setAttribute('src', this.config.blankVideo);
            this.media.load();
            this.media.remove();
        } else {
            console.error('Unable to remove media element for Fluid Player instance');
        }

        if (is.element(wrapper)) {
            wrapper.remove();
        } else {
            console.error('Unable to remove wrapper element for Fluid Player instance');
        }

        // Stop checking fps
        clearInterval(this.fps.interval);

        // TODO: ads, remove after tweaking adsupport, vast and vpaid
        clearInterval(this.timer);

        // Clear for garbage collection
        setTimeout(() => {
            this.media = null;
            this.controls = null;
            this.wrapper = null;
        }, 200);
    };
}

/**
 * Public Fluid Player API interface
 * @param instance
 */
const PlayerInterface = function(instance) {
    this.play = () => {
        return instance.play();
    };

    this.pause = () => {
        return instance.pause();
    };

    this.skipTo = (time) => {
        instance.skipTo(time);
    };

    this.setPlaybackSpeed = (speed) => {
        instance.speed = speed;
    };

    this.setVolume = (volume) => {
        instance.volume = volume;
    };

    this.setHtmlOnPauseBlock = (options) => {
        return instance.HtmlOnPause.setHtmlOnPauseBlock(options);
    };

    this.toggleControlBar = (state) => {
        instance.controlBar.toggleControlBar(state);
    };

    this.toggleFullScreen = (state) => {
        instance.fullscreen.toggle(state);
    };

    this.destroy = () => {
        instance.destroy();
    };

    this.dashInstance = () => {
        return instance.streaming.dash ? instance.streaming.dash : null;
    };

    this.hlsInstance = () => {
        return instance.streaming.hls ? instance.streaming.hls : null;
    };

    this.on = (event, callback) => {
        instance.on(event, callback);
    };
};

const FP_DEVELOPMENT_MODE = FP_ENV === 'development';

let playerInstances = 0;

/**
 * Initialize and attach Fluid Player to instance of HTMLVideoElement
 *
 * @param target ID of HTMLVideoElement or reference to HTMLVideoElement
 * @param options Fluid Player configuration options
 * @returns {playerInterface}
 */
const playerInitializer = function(target, options = {}) {
    const instance = new CVP(target, options);

    const publicInstance = new PlayerInterface(instance);

    if (window && FP_DEVELOPMENT_MODE) {
        const debugApi = {
            id: target,
            options: options,
            instance: publicInstance,
            internals: instance,
        };

        if (is.nullOrUndefined(window.fluidPlayerDebug)) {
            window.fluidPlayerDebug = [];
        }

        window.fluidPlayerDebug.push(debugApi);

        console.log(
            'Created instance of Fluid Player.',
            `Debug API available at window.fluidPlayerDebug[${window.fluidPlayerDebug.length - 1}].`,
            debugApi,
        );
    }

    return publicInstance;
};

if (FP_DEVELOPMENT_MODE) {
    console.log(`Fluid Player - Development Build ${FP_DEBUG ? '(in debug mode)' : ''}`);
}

export default playerInitializer;
