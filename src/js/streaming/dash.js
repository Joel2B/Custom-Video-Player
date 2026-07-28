import { formatTime } from '../utils/time';
import is from '../utils/is';
import loadScript from './load-script';

class Dash {
  constructor(player) {
    this.player = player;

    this.liveThresholdSecs = 12;
    this.autoPlayPending = false;
    this.autoPlayCancelled = false;
    this.terminal = false;
  }

  load = async () => {
    if (!window.dashjs || !is.function(window.dashjs.MediaPlayer)) {
      window.dashjs = {
        skipAutoCreate: true,
        isDefaultSubject: true,
      };

      await loadScript(this.player.config.dash.url);
    }

    if (!window.dashjs || !is.function(window.dashjs.MediaPlayer)) {
      throw new Error(`DASH.js unavailable after loading script: ${this.player.config.dash.url}`);
    }
  };

  detach = () => {
    this.cancelPlay();

    const dash = this.dash;
    this.dash = null;

    if (!dash) {
      return;
    }

    dash.reset();
  };

  init = () => {
    const { player } = this;
    const { config } = player;

    if (!dashjs.supportsMediaSource()) {
      player.debug.warn('Media type not supported by this browser using DASH.js. (application/dash+xml)');
      throw new Error('Media type not supported by this browser using DASH.js. (application/dash+xml)');
    }

    const autoPlay = !this.autoPlayCancelled && !player.pendingStreamPlay && player.autoPlay.apply(false);
    this.autoPlayPending = autoPlay;
    player.autoPlay.applied = autoPlay;

    let settings = {
      debug: {
        logLevel: FP_DEBUG || config.dash.debug ? dashjs.Debug.LOG_LEVEL_DEBUG : dashjs.Debug.LOG_LEVEL_FATAL,
      },
    };

    settings = config.dash.config(settings);

    this.dash = dashjs.MediaPlayer().create();

    this.dash.updateSettings(settings);

    config.dash.onBeforeInit(this.dash);

    this.listeners();

    this.dash.initialize(player.media, player.currentSource.src, autoPlay);

    if (player.pendingStreamPlay) {
      player.resumePendingStreamPlay();
    }

    config.dash.onAfterInit(this.dash);

    return this.dash;
  };

  play = (origin = 'manual') => {
    if (origin !== 'autoplay') {
      this.autoPlayPending = false;
    }

    if (!this.dash) {
      return null;
    }

    if (!this.pendingPlay) {
      let resolve;
      let reject;
      const promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
      });
      promise.catch(() => {});
      this.pendingPlay = { promise, resolve, reject };
    }

    const promise = this.pendingPlay.promise;

    try {
      this.dash.play();
    } catch (error) {
      this.rejectPlay(error);
    }

    return promise;
  };

  pause = () => {
    this.autoPlayCancelled = true;
    this.autoPlayPending = false;
    this.cancelPlay();
    return this.dash?.pause();
  };

  resolvePlay = () => {
    const request = this.pendingPlay;
    this.pendingPlay = null;
    request?.resolve();
  };

  rejectPlay = (error) => {
    const request = this.pendingPlay;
    this.pendingPlay = null;
    request?.reject(error);
  };

  cancelPlay = () => {
    if (!this.pendingPlay) {
      return;
    }

    const error = new Error('The play request was interrupted.');
    error.name = 'AbortError';
    this.rejectPlay(error);
  };

  listen = (event, callback) => {
    const dash = this.dash;
    dash.on(event, (...args) => {
      if (this.player.streaming.dashController === this && this.dash === dash) {
        callback(...args);
      }
    });
  };

  fail = (error) => {
    if (this.terminal) {
      return;
    }

    this.terminal = true;
    this.autoPlayPending = false;
    this.cancelPlay();

    const { player } = this;
    const unsupported = [4, 5, 23, 24, 34, 35, 36].includes(error.code);
    const message =
      error.code === 2 || error.code === 25
        ? player.config.captions.mediaErrorNetwork
        : error.code === 3
          ? player.config.captions.mediaErrorDecode
          : unsupported
            ? player.config.captions.mediaErrorUnsupported
            : player.config.captions.mediaErrorUnknown;

    player.debug.error(error);
    player.failSource(message);
  };

  listeners = () => {
    const { player } = this;
    const errors = dashjs.MediaPlayer.errors;
    const startupTerminalCodes = [
      errors.MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE,
      errors.DOWNLOAD_ERROR_ID_MANIFEST_CODE,
      errors.MANIFEST_ERROR_ID_PARSE_CODE,
      errors.MANIFEST_ERROR_ID_NOSTREAMS_CODE,
      errors.MANIFEST_ERROR_ID_MULTIPLEXED_CODE,
      errors.MEDIASOURCE_TYPE_UNSUPPORTED_CODE,
      errors.CAPABILITY_MEDIASOURCE_ERROR_CODE,
      errors.CAPABILITY_MEDIAKEYS_ERROR_CODE,
      errors.NO_SUPPORTED_KEY_IDS,
    ];

    this.listen(dashjs.MediaPlayer.events.STREAM_INITIALIZING, () => {
      player.toggleLoader(true);
    });

    this.listen(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
      player.streamReady = true;

      if (this.dash.isDynamic()) {
        this.setupLive();
      }
    });

    this.listen(dashjs.MediaPlayer.events.CAN_PLAY, () => {
      player.toggleLoader(false);
    });

    this.listen(dashjs.MediaPlayer.events.PLAYBACK_PLAYING, () => {
      this.autoPlayPending = false;
      this.resolvePlay();
      player.toggleLoader(false);
    });

    this.listen(dashjs.MediaPlayer.events.PLAYBACK_NOT_ALLOWED, () => {
      const error = new Error('Playback is not allowed without user interaction.');
      error.name = 'NotAllowedError';
      this.rejectPlay(error);

      if (!this.autoPlayPending) {
        return;
      }

      this.autoPlayPending = false;
      player.autoPlay.playMuted();
    });

    this.listen(dashjs.MediaPlayer.events.PLAYBACK_ERROR, (event) => {
      const error = event?.error;
      player.debug.warn(error);

      if (error?.code >= 2 && error.code <= 5) {
        this.fail(error);
      }
    });

    this.listen(dashjs.MediaPlayer.events.ERROR, (event) => {
      const error = event?.error;
      const code = error?.code;
      const terminalPlaybackError = code >= 2 && code <= 5;
      const terminalStartupError = !player.streamReady && startupTerminalCodes.includes(code);

      if (!error || code === 1 || (!terminalPlaybackError && !terminalStartupError)) {
        return;
      }

      this.fail(error);
    });

    this.listen(dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED, () => {
      player.listeners.time();
      player.listeners.duration();
      player.listeners.progress();
    });
  };

  setupLive = () => {
    const { player } = this;
    const live = player.streaming.live;

    live.init().onClick(() => {
      this.dash.seek(player.duration);
    });

    live.setCurrentTime = (input) => {
      if (!is.number(input)) {
        return;
      }

      const duration = player.duration;
      const seekTo = Math.max(0, Math.min(input, duration));

      this.dash.seek(seekTo);
    };

    live.getCurrentTime = () => {
      if (is.function(this.dash.timeInDvrWindow)) {
        const dvrTime = this.dash.timeInDvrWindow();
        return is.number(dvrTime) && dvrTime >= 0 ? dvrTime : 0;
      }

      const time = this.dash.time();
      return is.number(time) && time >= 0 ? time : 0;
    };

    live.duration = () => {
      const duration = this.dash.duration();
      return is.number(duration) && duration > 0 ? duration : 0;
    };

    live.timeDisplay = () => {
      let liveDelay = player.duration - player.currentTime;

      if (is.function(this.dash.getCurrentLiveLatency)) {
        const latency = this.dash.getCurrentLiveLatency();

        if (is.number(latency) && latency >= 0) {
          liveDelay = latency;
        }
      }

      liveDelay = Math.max(liveDelay, 0);
      let syncThreshold = this.liveThresholdSecs;

      if (is.function(this.dash.getTargetLiveDelay)) {
        const targetLiveDelay = this.dash.getTargetLiveDelay();

        if (is.number(targetLiveDelay) && targetLiveDelay > 0) {
          syncThreshold = targetLiveDelay;
        }
      }

      live.toggleStatus(liveDelay < syncThreshold);

      return `- ${formatTime(liveDelay)}`;
    };
  };
}

export default Dash;
