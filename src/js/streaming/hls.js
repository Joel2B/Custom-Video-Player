import { supportsHLS } from '../utils/media';
import { formatTime } from '../utils/time';
import { once } from '../utils/events';
import is from '../utils/is';
import loadScript from './load-script';

const MAX_FATAL_RECOVERIES = 2;
const MAX_SUBTITLE_CUES = 20000;
const LIVE_CUE_RETENTION_SECONDS = 300;

class Hlsjs {
  constructor(player) {
    this.player = player;
    this.source = player.currentSource.src;
    this.loadStarted = false;
    this.networkErrorRetries = 0;
    this.mediaErrorRetries = 0;

    this.url = player.config.hls.url;

    if (player.subtitles.enabled && !player.subtitles.config.timestampMap) {
      this.url = player.config.hls.customUrl;
    }
  }

  load = async () => {
    if (!window.Hls) {
      await loadScript(this.url);
    }

    if (!window.Hls) {
      throw new Error(`HLS.js unavailable after loading script: ${this.url}`);
    }
  };

  detach = () => {
    const hls = this.hls;
    this.hls = null;

    if (!hls) {
      return;
    }

    hls.stopLoad();
    hls.detachMedia();
    hls.destroy();
    clearInterval(hls.bufferTimer);
  };

  useNative = () => {
    const { player } = this;
    const source = this.source;
    this.native = true;

    player.media.src = source;

    once.call(player, player.media, 'canplay', () => {
      if (player.streaming.hlsController !== this || player.currentSource.src !== source) {
        return;
      }

      player.streamReady = true;
      player.resumePendingStreamPlay();
    });

    player.media.load();
  };

  startLoad = () => {
    if (this.hls && this.hls.userConfig.autoStartLoad === false && !this.loadStarted) {
      this.loadStarted = true;
      this.hls.startLoad();
    }
  };

  isCurrent = (hls) =>
    this.player.streaming.hlsController === this && this.hls === hls && this.player.currentSource.src === this.source;

  listen = (event, callback, once = false) => {
    const hls = this.hls;
    hls[once ? 'once' : 'on'](event, (...args) => {
      if (this.isCurrent(hls)) {
        callback(hls, ...args);
      }
    });
  };

  fail = (hls, message) => {
    this.hls = null;
    hls.destroy();
    this.player.failSource(message);
  };

  init = () => {
    const { player } = this;
    const { config } = player;

    // Use native hls
    if (supportsHLS && !config.hls.overrideNative) {
      this.useNative();
      return;
    }

    // Check if hls.js can be used
    if (!Hls.isSupported()) {
      player.debug.warn('Media type not supported by this browser using HLS.js. (application/x-mpegURL)');

      if (supportsHLS) {
        this.useNative();
      } else {
        throw new Error('Media type not supported by this browser using HLS.js. (application/x-mpegURL)');
      }
      return;
    }

    let settings = {
      debug: FP_DEBUG || config.hls.debug,
      maxMaxBufferLength: 30,
      maxBufferSize: (player.touch ? 25 : 50) * 1000 * 1000,
    };

    // The current configuration may cause an infinite cycle of fragment download, use a custom one
    settings = config.hls.config(settings);

    if (!player.subtitles.native) {
      settings.renderTextTracksNatively = false;
    }

    player.speedMenu.lock = true;

    this.hls = new Hls(settings);

    config.hls.onBeforeInit(this.hls);

    this.listeners();

    this.hls.attachMedia(player.media);

    config.hls.onAfterInit(this.hls);

    return this.hls;
  };

  listeners = () => {
    const { player } = this;

    this.listen(Hls.Events.MEDIA_ATTACHED, (hls, e, data) => {
      player.debug.log(e, data);

      hls.loadSource(this.source);
      if (player.pendingStreamPlay) {
        this.startLoad();
      }
    });

    this.listen(Hls.Events.AUDIO_TRACKS_UPDATED, (hls, e, data) => {
      if (!player.audio.enabled) {
        return;
      }

      player.debug.log(e, data);

      for (const audio of data.audioTracks) {
        player.audio.addTrack(audio);
      }

      player.audio.update();
    });

    this.listen(Hls.Events.AUDIO_TRACK_SWITCHED, (hls, e, data) => {
      if (!player.audio.enabled) {
        return;
      }

      player.debug.log(e, data);

      player.audio.checkTrack(data.id);
    });

    this.listen(Hls.Events.NON_NATIVE_TEXT_TRACKS_FOUND, (hls, e, data) => {
      if (!player.subtitles.enabled) {
        return;
      }

      player.debug.log(e, data);

      // ocultar subtitulos de hls
      hls.subtitleDisplay = false;

      for (const rawTrack of data.tracks) {
        let id = rawTrack._id;
        let forced = false;
        let src = null;
        let lang = null;

        if (!is.nullOrUndefined(rawTrack.subtitleTrack)) {
          id = rawTrack.subtitleTrack.id;
          forced = rawTrack.subtitleTrack.forced;
          src = rawTrack.subtitleTrack.url;
          lang = rawTrack.subtitleTrack.lang;
        }

        const track = {
          id,
          type: 'hls',
          kind: rawTrack.kind,
          label: rawTrack.label,
          src,
          srclang: lang,
          default: rawTrack.default,
          forced,
        };

        player.subtitles.addTrack(track);
      }

      player.subtitles.emulateTextTracks('external');
    });

    this.listen(Hls.Events.CUES_PARSED, (hls, e, data) => {
      if (!player.subtitles.enabled) {
        return;
      }

      player.debug.log(e, data);

      const tracks = player.subtitles.getTracks();

      for (const track of tracks) {
        const id = track.id.toString();
        if (
          id === data.track ||
          id === data.track.replace(/subtitles/, '') ||
          (track.type === 'hls' && track.default && data.track === 'default')
        ) {
          const liveCutoff = player.streaming.live.active
            ? player.media.currentTime - LIVE_CUE_RETENTION_SECONDS
            : -Infinity;

          let cueCount = 0;

          for (const cue of track.cues) {
            if (cue.endTime >= liveCutoff) {
              track.cues[cueCount++] = cue;
            }
          }

          track.cues.length = cueCount;

          for (const cue of data.cues) {
            if (track.cues.length >= MAX_SUBTITLE_CUES) {
              break;
            }

            if (cue.endTime >= liveCutoff) {
              track.cues.push(cue);
            }
          }

          player.subtitles.updateActiveCues();
          player.subtitles.render();
          return;
        }
      }
    });

    this.listen(Hls.Events.SUBTITLE_TRACK_SWITCH, (hls, e, data) => {
      if (!player.subtitles.enabled) {
        return;
      }

      player.debug.log(e, data);

      player.subtitles.checkTrack(data.id);
    });

    this.listen(Hls.Events.LEVEL_SWITCHING, (hls, e, data) => {
      player.debug.log(e, data);

      if (!hls.autoLevelEnabled && !player.multipleSourceTypes) {
        player.toggleLoader(true);
        player.listeners.waiting = true;
      }
    });

    this.listen(Hls.Events.LEVEL_SWITCHED, (hls, e, data) => {
      player.debug.log(e, data);

      if (!hls.autoLevelEnabled || player.multipleSourceTypes) {
        if (!player.multipleSourceTypes) {
          player.toggleLoader(false);
          player.listeners.waiting = false;
        }
        return;
      }

      player.quality.auto = true;
      player.quality.current = data.level;
      player.quality.update();
    });

    this.listen(Hls.Events.MANIFEST_PARSED, (hls, e, data) => {
      player.debug.log(e, data);

      this.networkErrorRetries = 0;
      player.speedMenu.lock = false;
      player.streamReady = true;
      player.resumePendingStreamPlay();

      if (player.multipleSourceTypes) {
        return;
      }

      player.quality.add(data.levels);
    });

    this.listen(Hls.Events.FRAG_LOADED, () => {
      this.networkErrorRetries = 0;
    });

    this.listen(Hls.Events.FRAG_BUFFERED, () => {
      this.mediaErrorRetries = 0;
    });

    this.listen(
      Hls.Events.LEVEL_LOADED,
      (hls, e, data) => {
        player.debug.log(e, data);

        if (data.details.live) {
          this.setupLive(hls);
        }
      },
      true,
    );

    this.listen(Hls.Events.ERROR, (hls, e, data) => {
      if (!data.fatal) {
        return;
      }

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          if (this.networkErrorRetries++ < MAX_FATAL_RECOVERIES) {
            player.debug.log('fatal network error encountered, try to recover');
            hls.startLoad();
            return;
          }

          this.fail(hls, player.config.captions.mediaErrorNetwork);
          return;
        case Hls.ErrorTypes.MEDIA_ERROR:
          if (this.mediaErrorRetries++ < MAX_FATAL_RECOVERIES) {
            player.debug.log('fatal media error encountered, try to recover');

            if (this.mediaErrorRetries === MAX_FATAL_RECOVERIES) {
              hls.swapAudioCodec();
            }

            hls.recoverMediaError();
            return;
          }

          this.fail(hls, player.config.captions.mediaErrorDecode);
          return;
        default:
          this.fail(hls, player.config.captions.mediaErrorUnknown);
      }
    });
  };

  setupLive = (hls) => {
    const { player } = this;
    const live = player.streaming.live;

    this.listen(Hls.Events.LEVEL_LOADED, () => {
      player.listeners.time();
      player.listeners.duration();
      player.listeners.progress();
    });

    live.init().onClick(() => {
      player.currentTime = hls.liveSyncPosition;
    });

    live.timeDisplay = () => {
      const liveDelay = player.duration - player.currentTime;

      live.toggleStatus(liveDelay < hls.targetLatency);

      return `- ${formatTime(liveDelay)}`;
    };
  };
}

export default Hlsjs;
