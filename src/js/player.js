// Player modules
import ControlBar from './control-bar/control-bar';
import Controls from './control-bar/controls';
import Mobile from './mobile';
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
import Audio from './menu/audio';
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

import { isDASH, isHLS, isSource } from './utils/media';
import { createElement, insertAfter, toggleClass } from './utils/dom';
import { off, on, once, unbindListeners } from './utils/events';
import { IS_ANY_SAFARI, IS_IOS, IS_ANDROID, TOUCH_ENABLED } from './utils/browser';
import { getMimetype } from './utils/mimetypes';
import is from './utils/is';

// TODO: remove after tweaking adsupport, vast and vpaid
const FP_MODULES = [AdSupport, Vast, Vpaid];

class CVP {
    constructor(target, options) {
        this.version = FP_BUILD_VERSION;
        this.homepage = FP_HOMEPAGE;

        // Touch device
        this.touch = TOUCH_ENABLED;

        // Mobile device
        this.mobile = (IS_ANDROID && this.touch) || IS_IOS;

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

        // Global variables
        this.defineVariables();

        // All control elements
        this.controls = new Controls(this);
        this.mobileControls = new Mobile(this);

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
        this.setupDevice();
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

        // Apply mute
        this.initMute();

        // Set sources
        this.setVideoSources();

        // Setup vast
        this.setVastList();

        this.config.layoutControls.playerInitCallback();

        const play = this.media.play;
        this.media.play = () => {
            const promise = play.apply(this.media, arguments);

            if (!is.promise(promise)) {
                return null;
            }

            this.promiseTimeout = setTimeout(() => {
                if (!this.playing) {
                    this.debug.error('Timeout error. Failed to play video?');
                }
            }, 5000);

            promise
                .then(() => {
                    clearTimeout(this.promiseTimeout);
                })
                .catch((error) => {
                    this.debug.error(error);

                    if (error.name === 'NotAllowedError') {
                        this.autoPlay.playMuted();
                    }

                    clearTimeout(this.promiseTimeout);
                });

            return promise;
        };
    }

    defineVariables = () => {
        // to load ads
        this.firstPlayLaunched = false;

        // to display the loading animation
        this.isLoading = false;

        this.eventListeners = [];

        // for theater mode
        this.originalWidth = null;
        this.originalHeight = null;

        this.sources = [];
        this.currentSource = {
            src: '',
            type: '',
            title: '',
            hd: false,
        };

        // to avoid displaying the play/pause animation when changing sources
        this.isSwitchingSource = false;

        // to avoid using the functions for hls, we will use the native functions
        this.multipleSourceTypes = false;

        // to avoid using play before loading the stream
        this.allowPlayStream = false;
        this.playStream = false;

        // TODO: ads, remove after tweaking adsupport, vast and vpaid
        this.suppressClickthrough = false;
        this.vpaidTimer = null;
        this.vpaidAdUnit = null;
        this.vastOptions = null;
        this.isCurrentlyPlayingAd = false;
        this.mainVideoCurrentTime = 0;
        this.mainCurrentSource = null;
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

        toggleClass(this.wrapper, 'fluid_player_layout_' + this.config.layoutControls.layout, true);

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

        this.controls.setup();
        this.mobileControls.setup();

        this.posterImage();

        this.logo = new Logo(this);

        this.title = new Title(this);

        this.shortcuts = new Shortcuts(this);
    };

    setupMedia = () => {
        this.originalWidth = this.media.offsetWidth;
        this.originalHeight = this.media.offsetHeight;

        this.media.style.width = '100%';
        this.media.style.height = '100%';

        this.media.setAttribute('playsinline', '');
        this.media.setAttribute('webkit-playsinline', '');

        // Remove the default controls
        this.media.removeAttribute('controls');

        this.menu = new Menu(this);
        this.audio = new Audio(this);
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

        if (this.config.layoutControls.controlForwardRewind.show) {
            this.skipControls = new Skip(this);
        }

        this.download = new Download(this);
        this.fullscreen = new Fullscreen(this);
        this.theatre = new Theatre(this);
        this.HtmlOnPause = new HtmlOnPause(this);
        this.contextMenu = new ContextMenu(this);

        this.volumeControl = new VolumeControl(this);
        this.volumeControl.init();

        this.autoPlay = new Autoplay(this);
        this.loopMenu = new Loop(this);
        this.speedMenu = new Speed(this);
        this.audio.init();
        this.subtitles.init();
        this.quality = new Quality(this);
        this.menu.init();
    };

    resize = () => {
        this.recalculateAdDimensions();
        this.resizeVpaidAuto();

        this.progressBar.resize();
    };

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
        if (this.mobile) {
            toggleClass(this.wrapper, 'fluid_waiting', show);
        }

        this.isLoading = show;
        this.controls.loader.style.opacity = show ? '1' : '0';
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

    setupDevice = () => {
        toggleClass(this.wrapper, 'fluid_touch', this.touch);
        toggleClass(this.wrapper, this.mobile ? 'fluid_mobile' : 'fluid_desktop', true);

        if (!this.touch) {
            return;
        }

        this.config.layoutControls.controlBar.autoHide = true;
        this.config.layoutControls.playButtonShowing = true;
        this.config.layoutControls.playPauseAnimation = this.mobile;
    };

    src = (sources) => {
        if (is.object(sources)) {
            sources = [sources];
        }

        this.setSources(sources);
    };

    setVideoSources = () => {
        const sources = Array.from(this.media.querySelectorAll('source'));

        this.setSources(sources);
    };

    setSources = (sources) => {
        if (!is.array(sources)) {
            return;
        }

        this.sources = [];

        for (const source of sources) {
            if (!source.src || !isSource(source.src)) {
                continue;
            }

            const type = (source.type || '').toLowerCase() || getMimetype(source.src);

            if (!type) {
                continue;
            }

            let hd = source.hd;

            if (is.element(source)) {
                if (is.nullOrUndefined(hd)) {
                    hd = source.getAttribute('data-fluid-hd') !== null;
                }

                source.remove();
            }

            this.sources.push({
                src: source.src,
                type: type,
                title: source.title,
                hd: hd,
            });
        }

        if (this.sources.length === 0) {
            return;
        }

        this.multipleSourceTypes = false;

        this.currentSource = this.sources[0];

        this.source = this.currentSource;

        this.sources.reverse();

        if (!isHLS(this.currentSource.src) && !isDASH(this.currentSource.src)) {
            this.multipleSourceTypes = this.sources.some((source) => isHLS(source.src) || isDASH(source.src));

            this.quality.add(this.sources);

            this.autoPlay.apply();
        }
    };

    loadSource = (currentTime, paused) => {
        once.call(this, this.media, 'loadedmetadata', () => {
            this.speed = this.speedMenu.current;
            this.loop = this.loopMenu.current;
            this.currentTime = currentTime;

            this.speedMenu.lock = false;

            // Safari ios and mac fix to set currentTime
            if (IS_ANY_SAFARI) {
                once.call(this, this.media, 'canplaythrough', () => {
                    this.currentTime = currentTime;
                });
            }

            // Resume playing
            if (!paused) {
                if (this.firstPlayLaunched) {
                    this.isSwitchingSource = true;
                }

                if (this.mobile) {
                    this.controlBar.toggleMobile(false);
                }

                this.play();
            }
        });

        this.media.load();
    };

    set source(source) {
        const src = source.src;

        this.debug.log('Set source: ', src);

        this.currentSource = source;

        if (this.firstPlayLaunched) {
            this.isSwitchingSource = true;
        }

        this.streaming.detach();

        if (isHLS(src) || isDASH(src)) {
            this.streaming.init();
        } else {
            this.media.src = src;
        }
    }

    get source() {
        return this.media.currentSrc;
    }

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
        this.menu.remove('qualityLevels');

        for (let i = this.sources.length - 1; i > 0; i--) {
            if (this.sources[i].src === this.currentSource.src && this.sources[i - 1].src) {
                this.source = this.sources[i - 1];

                if (!isHLS(this.source) && !isDASH(this.source)) {
                    on.call(this, this.media, 'canplay', () => {
                        if (this.autoPlay.applied) {
                            this.autoPlay.applied = false;
                            this.autoPlay.apply();
                        }
                    });

                    this.media.load();
                }

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

        if (this.streaming.live.active && this.streaming.live.setCurrentTime) {
            this.streaming.live.setCurrentTime(input);
            return;
        }

        const inputIsValid = is.number(input) && input > 0;

        this.media.currentTime = inputIsValid ? Math.min(input, this.duration) : 0;
    }

    get currentTime() {
        if (this.streaming.live.active && this.streaming.live.getCurrentTime) {
            return this.streaming.live.getCurrentTime();
        }

        return Number(this.media.currentTime);
    }

    get duration() {
        if (this.streaming.live.active && this.streaming.live.duration) {
            return this.streaming.live.duration();
        }

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
        if ((this.volume !== 0 || IS_IOS) && !this.muted) {
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
        }, 0);
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
            this.debug.warn('Wrapper element not found');
            return;
        }

        unbindListeners.call(this);

        // destroy video
        if (is.element(this.media)) {
            this.pause();

            this.streaming.detach();

            this.media.setAttribute('src', this.config.blankVideo);
            this.media.load();
            this.media.remove();
        } else {
            this.debug.error('Media element not found');
        }

        if (is.element(wrapper)) {
            wrapper.remove();
        } else {
            this.debug.error('Wrapper element not found');
        }

        // Stop checking fps
        clearInterval(this.fps.interval);

        // TODO: ads, remove after tweaking adsupport, vast and vpaid
        clearInterval(this.timer);

        // Clear for garbage collection
        setTimeout(() => {
            this.media = null;
            this.controls = null;
            this.mobileControls = null;
            this.wrapper = null;
        }, 200);
    };
}

/**
 * Public Fluid Player API interface
 * @param instance
 */
const PlayerInterface = function(instance) {
    this.src = (src) => {
        instance.src(src);
    };

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
