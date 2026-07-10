import { formatTime } from '../utils/time';
import is from '../utils/is';
import loadScript from './load-script';

class Dash {
  constructor(player) {
    this.player = player;

    this.liveThresholdSecs = 12;
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
    if (!this.dash) {
      return;
    }

    this.dash.reset();
    this.dash = null;
  };

  init = () => {
    const { player } = this;
    const { config } = player;

    if (!dashjs.supportsMediaSource()) {
      player.debug.warn('Media type not supported by this browser using DASH.js. (application/dash+xml)');
      throw new Error('Media type not supported by this browser using DASH.js. (application/dash+xml)');
    }

    const autoPlay = player.autoPlay.apply(false);

    let settings = {
      debug: {
        logLevel: FP_DEBUG || config.dash.debug ? dashjs.Debug.LOG_LEVEL_DEBUG : dashjs.Debug.LOG_LEVEL_FATAL,
      },
    };

    settings = config.dash.config(settings);

    this.dash = dashjs.MediaPlayer().create();

    this.dash.updateSettings(settings);

    config.dash.onBeforeInit(this.dash);

    this.dash.initialize(player.media, player.currentSource.src, autoPlay);

    this.listeners();

    config.dash.onAfterInit(this.dash);

    return this.dash;
  };

  listeners = () => {
    const { player } = this;

    this.dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZING, () => {
      player.toggleLoader(true);
    });

    this.dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
      if (this.dash.isDynamic()) {
        this.setupLive();
      }
    });

    this.dash.on(dashjs.MediaPlayer.events.CAN_PLAY, () => {
      player.toggleLoader(false);
    });

    this.dash.on(dashjs.MediaPlayer.events.PLAYBACK_PLAYING, () => {
      player.toggleLoader(false);
    });

    this.dash.on(dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED, () => {
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
