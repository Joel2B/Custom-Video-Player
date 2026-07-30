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
import { createElement, insertAfter, toggleClass, replaceElement } from './utils/dom';
import { off, on, once, unbindListeners, triggerEvent } from './utils/events';
import { IS_ANY_SAFARI, IS_IOS, IS_ANDROID, TOUCH_ENABLED } from './utils/browser';
import { getMimetype } from './utils/mimetypes';
import { clone } from './utils/object';
import is from './utils/is';
import delay from './utils/promise';
import { resolveLocale } from './locales';

class CVP {
  constructor(target, options) {
    this.version = FP_BUILD_VERSION;
    this.homepage = FP_HOMEPAGE;

    // State
    this.ready = false;

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
    this.config = clone(defaults);
    const locale = resolveLocale(options.locale);
    this.overwrite(locale, this.config);

    // Overwrite config
    this.overwrite(options, this.config);
    this.config.locale = locale.locale;

    const primaryColor = this.config.layoutControls.primaryColor;

    if (primaryColor && (!is.string(primaryColor) || !CSS.supports('color', primaryColor))) {
      this.config.layoutControls.primaryColor = false;
    }

    if (FP_ENV === 'development') {
      this.config.debug = true;
    }

    // Debugging
    this.debug = new Console(this.config.debug);

    // Cache original element state for .destroy()
    const original = this.media.cloneNode(true);
    original.autoplay = false;
    this.original = original;

    // Store reference
    this.media.cvp = this;

    this.videoPlayerId = !is.empty(this.media.id) ? this.media.id : `fp_instance_${playerInstances++}`;

    // Global variables
    this.defineVariables();

    // All control elements
    this.controls = new Controls(this);
    this.mobileControls = new Mobile(this);

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

    this.config.layoutControls.playerInitCallback();

    const play = this.media.play;

    this.media.play = (autoplayAttempt = false) => {
      const generation = ++this.playAttemptGeneration;
      const source = this.currentSource.src;
      const promise = play.call(this.media);

      if (!is.promise(promise)) {
        return null;
      }

      const promiseTimeout = setTimeout(() => {
        if (!this.playing) {
          this.debug.error('Timeout error. Failed to play video?');
        }
      }, 5000);

      this.promiseTimeouts.add(promiseTimeout);

      const clearPromiseTimeout = () => {
        clearTimeout(promiseTimeout);
        this.promiseTimeouts.delete(promiseTimeout);
      };

      Promise.resolve(promise)
        .then(clearPromiseTimeout)
        .catch((error) => {
          this.debug.error(error);

          if (
            this.ready &&
            this.media &&
            generation === this.playAttemptGeneration &&
            source === this.currentSource.src &&
            autoplayAttempt &&
            !this.muted &&
            error.name === 'NotAllowedError'
          ) {
            this.autoPlay.playMuted();
          }

          clearPromiseTimeout();
        });

      return promise;
    };

    this.ready = true;
    if (this.currentSource.src && !isDASH(this.currentSource.src, this.currentSource.type)) {
      this.autoPlay.apply();
    }
  }

  defineVariables = () => {
    this.firstPlayLaunched = false;

    // to display the loading animation
    this.isLoading = false;

    this.eventListeners = [];
    this.promiseTimeouts = new Set();

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
    this.streamReady = false;
    this.pendingStreamPlay = null;
    this.playAttemptGeneration = 0;
    this.sourceFailed = false;
  };

  setupWrapper = () => {
    this.wrapper = createElement('div', {
      class: 'fluid_video_wrapper',
      lang: this.config.locale,
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
    this.progressBar.resize();
    this.volumeControl.resize();
  };

  overwrite = (from, to) => {
    for (const key of Object.keys(from)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) {
        continue;
      }

      const value = from[key];
      const prototype = value !== null && typeof value === 'object' ? Object.getPrototypeOf(value) : null;
      const plainObject =
        value !== null && typeof value === 'object' && (prototype === Object.prototype || prototype === null);

      if (plainObject) {
        if (!is.object(to[key])) {
          to[key] = {};
        }
        this.overwrite(value, to[key]);
      } else {
        to[key] = value;
      }
    }
  };

  toggleLoader = (show) => {
    if (this.isLoading === show) {
      return;
    }

    this.isLoading = show;

    toggleClass(this.wrapper, 'fluid_waiting', show);

    this.controls.loader.style.opacity = show ? '1' : '0';
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

    const hasSources = sources.length > 0;
    const hadSource = Boolean(this.currentSource.src || this.media.currentSrc || this.media.getAttribute('src'));
    this.sources = [];

    if (!hasSources) {
      if (hadSource) {
        this.pause();
        this.streaming.detach();
        this.media.removeAttribute('src');
        this.media.load();
      }
      this.media.querySelectorAll('source').forEach((source) => source.remove());
      this.currentSource = { src: '', type: '', title: '', hd: false };
      this.multipleSourceTypes = false;
      this.streamReady = false;
      this.sourceFailed = false;
      this.isSwitchingSource = false;
      this.autoPlay.applied = false;
      this.quality.reset();
      this.progressBar.update();
      this.listeners.time();
      this.listeners.duration();
      this.listeners.buffer();
      this.showError();
      return;
    }

    for (const source of sources) {
      if (!source.src) {
        continue;
      }

      const capabilityType = (source.type || '').trim();
      const type = getMimetype(source.src) || capabilityType.toLowerCase().split(';')[0].trim();

      if (!type || !isSource(source.src, type, this.media, capabilityType || type)) {
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
        type,
        title: source.title,
        hd,
      });
    }

    if (this.sources.length === 0) {
      if (hasSources) {
        this.failSource(this.config.captions.mediaErrorUnsupported);
      }

      return;
    }

    this.multipleSourceTypes = false;

    this.source = this.sources[0];

    this.sources.reverse();

    if (
      !isHLS(this.currentSource.src, this.currentSource.type) &&
      !isDASH(this.currentSource.src, this.currentSource.type)
    ) {
      this.multipleSourceTypes = this.sources.some(
        (source) => isHLS(source.src, source.type) || isDASH(source.src, source.type),
      );

      this.quality.add(this.sources);

      if (this.ready) {
        this.autoPlay.apply();
      }
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
    const pendingStreamPlay =
      isHLS(src, source.type) && this.pendingStreamPlay?.autoplayAttempt ? this.pendingStreamPlay : null;

    this.autoPlay.cancelWaitInteraction();
    this.playAttemptGeneration++;

    if (this.pendingStreamPlay?.autoplayAttempt && !pendingStreamPlay) {
      this.autoPlay.applied = false;
    }

    if (!pendingStreamPlay) {
      this.cancelPendingStreamPlay();
    }

    this.debug.log('Set source: ', src);
    this.showError();

    if (this.currentSource.src) {
      this.isSwitchingSource = true;
    }

    this.currentSource = source;
    this.sourceFailed = false;

    this.streamReady = false;
    this.pendingStreamPlay = pendingStreamPlay;

    this.streaming.detach();

    if (isHLS(src, source.type) || isDASH(src, source.type)) {
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
    this.quality.reset();

    for (let i = this.sources.length - 1; i > 0; i--) {
      if (this.sources[i].src === this.currentSource.src && this.sources[i - 1].src) {
        const resumeAutoplay = this.autoPlay.applied || this.pendingStreamPlay?.autoplayAttempt;
        if (resumeAutoplay) {
          this.autoPlay.applied = false;
        }
        this.source = this.sources[i - 1];

        if (
          !isHLS(this.currentSource.src, this.currentSource.type) &&
          !isDASH(this.currentSource.src, this.currentSource.type)
        ) {
          once.call(this, this.media, 'canplay', () => {
            if (resumeAutoplay) {
              this.autoPlay.apply();
            }
          });

          this.media.load();
        }

        return true;
      }
    }

    return false;
  };

  showError = (message = '') => {
    if (!this.controls?.error) {
      return;
    }

    this.controls.error.textContent = message;
    this.controls.error.hidden = !message;
  };

  failSource = (message) => {
    if (this.nextSource()) {
      return;
    }

    this.cancelPendingStreamPlay();
    this.autoPlay.applied = false;
    this.sourceFailed = true;
    this.toggleLoader(false);
    this.showError(message || this.config.captions.mediaErrorUnknown);
  };

  // "API" Functions
  play = (autoplayAttempt = false) => {
    if (this.sourceFailed) {
      const error = new Error('The media source failed.');
      error.name = 'NotSupportedError';
      const promise = Promise.reject(error);
      promise.catch(() => {});
      return promise;
    }

    if (this.streaming.dashController?.dash) {
      return this.streaming.dashController.play(autoplayAttempt ? 'autoplay' : 'manual');
    }

    if (!is.function(this.media.play)) {
      return null;
    }

    if (
      (isHLS(this.currentSource.src, this.currentSource.type) && !this.streamReady) ||
      (isDASH(this.currentSource.src, this.currentSource.type) && this.streaming.dashController)
    ) {
      return this.queueStreamPlay(autoplayAttempt);
    }

    return this.media.play(autoplayAttempt);
  };

  pause = () => {
    this.autoPlay.cancelWaitInteraction();
    this.playAttemptGeneration++;
    this.cancelPendingStreamPlay();

    if (this.streaming.dashController) {
      return this.streaming.dashController.pause();
    }

    if (this.paused || !is.function(this.media.pause)) {
      return null;
    }

    return this.media.pause();
  };

  queueStreamPlay = (autoplayAttempt) => {
    if (this.pendingStreamPlay) {
      return this.pendingStreamPlay.promise;
    }

    let resolve;
    let reject;
    const promise = new Promise((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    // UI-triggered play requests do not consume the returned Promise.
    promise.catch(() => {});
    this.pendingStreamPlay = { autoplayAttempt, promise, resolve, reject };
    this.streaming.hlsController?.startLoad?.();

    return promise;
  };

  resumePendingStreamPlay = () => {
    const request = this.pendingStreamPlay;
    this.pendingStreamPlay = null;

    if (!request) {
      this.autoPlay.apply();
      return;
    }

    Promise.resolve(this.play(request.autoplayAttempt)).then(request.resolve, request.reject);
  };

  cancelPendingStreamPlay = () => {
    const request = this.pendingStreamPlay;
    this.pendingStreamPlay = null;

    if (request) {
      const error = new Error('The play request was interrupted.');
      error.name = 'AbortError';
      request.reject(error);
    }
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
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('Volume must be a finite number between 0 and 1');
    }

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
    if (!Number.isFinite(input) || input <= 0) {
      throw new RangeError('Playback speed must be a finite number greater than 0');
    }

    this.media.playbackRate = input;
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
    return Boolean(this.ready && !this.paused && !this.ended && this.media.readyState > 2);
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
    if (!this.ready) {
      return;
    }

    this.playAttemptGeneration++;

    const wrapper = this.wrapper;

    if (!is.element(wrapper)) {
      this.debug.error('Wrapper element not found');
      return;
    }

    if (!is.element(this.media)) {
      this.debug.error('Media element not found');
      return;
    }

    [
      this.userActivity,
      this.listeners,
      this.volumeControl,
      this.mobileControls,
      this.playPause,
      this.progressBar,
      this.preview?.current,
      this.autoPlay,
      this.menu,
      this.subtitles,
      this.fps,
      this.fullscreen,
      this.theatre,
    ].forEach((module) => module?.destroy?.());

    this.promiseTimeouts.forEach(clearTimeout);
    this.promiseTimeouts.clear();

    unbindListeners.call(this);

    // destroy video
    this.pause();

    this.streaming.detach();

    this.media.removeAttribute('src');
    this.media.querySelectorAll('source').forEach((source) => source.remove());
    this.media.load();

    replaceElement(this.original, this.wrapper);

    triggerEvent.call(this, this.original, 'destroyed', true);

    this.ready = false;

    // Clear for garbage collection
    return delay(200, () => {
      this.media = null;
      this.controls = null;
      this.mobileControls = null;
      this.wrapper = null;
    });
  };
}

/**
 * Public Fluid Player API interface
 * @param instance
 */
class PlayerInterface {
  constructor(instance) {
    this.instance = instance;
  }

  src = (src) => {
    return this.instance.src(src);
  };

  play = () => {
    return this.instance.play();
  };

  pause = () => {
    return this.instance.pause();
  };

  skipTo = (time) => {
    return this.instance.skipTo(time);
  };

  setPlaybackSpeed = (speed) => {
    return (this.instance.speed = speed);
  };

  setVolume = (volume) => {
    return (this.instance.volume = volume);
  };

  setHtmlOnPauseBlock = (options) => {
    return this.instance.HtmlOnPause.setHtmlOnPauseBlock(options);
  };

  toggleControlBar = (state) => {
    return this.instance.controlBar.toggleControlBar(state);
  };

  toggleFullScreen = (state) => {
    return this.instance.fullscreen.toggle(state);
  };

  destroy = async () => {
    await this.instance.destroy();
  };

  dashInstance = () => {
    return this.instance.streaming.dash ? this.instance.streaming.dash : null;
  };

  hlsInstance = () => {
    return this.instance.streaming.hls ? this.instance.streaming.hls : null;
  };

  on = (event, callback) => {
    return this.instance.on(event, callback);
  };

  once = (event, callback) => {
    return this.instance.once(event, callback);
  };

  off = (event, callback) => {
    return this.instance.off(event, callback);
  };
}

const FP_DEVELOPMENT_MODE = FP_ENV === 'development';

let playerInstances = 0;

/**
 * Initialize and attach Fluid Player to instance of HTMLVideoElement
 *
 * @param target ID of HTMLVideoElement or reference to HTMLVideoElement
 * @param options Fluid Player configuration options
 * @returns {playerInterface}
 */
function playerInitializer(target, options = {}) {
  const media = is.string(target) ? document.getElementById(target) : target;

  if (!(media instanceof HTMLVideoElement)) {
    throw new TypeError('Invalid initializer - player target must be HTMLVideoElement or ID');
  }

  if (media.cvp) {
    throw new Error('Target already setup');
  }

  const instance = new CVP(media, options);

  const publicInstance = new PlayerInterface(instance);

  if (window && FP_DEVELOPMENT_MODE) {
    const debugApi = {
      id: target,
      options,
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
}

if (FP_DEVELOPMENT_MODE) {
  console.log(`Fluid Player - Development Build ${FP_DEBUG ? '(in debug mode)' : ''}`);
}

export default playerInitializer;
