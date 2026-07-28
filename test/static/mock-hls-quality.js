(() => {
  const levels = [
    { height: 1080, bitrate: 4500000 },
    { height: 720, bitrate: 2500000 },
    { height: 480, bitrate: 1200000 },
  ];

  class Hls {
    static Events = {
      MEDIA_ATTACHED: 'mediaAttached',
      AUDIO_TRACKS_UPDATED: 'audioTracksUpdated',
      AUDIO_TRACK_SWITCHED: 'audioTrackSwitched',
      NON_NATIVE_TEXT_TRACKS_FOUND: 'nonNativeTextTracksFound',
      CUES_PARSED: 'cuesParsed',
      SUBTITLE_TRACK_SWITCH: 'subtitleTrackSwitch',
      LEVEL_SWITCHING: 'levelSwitching',
      LEVEL_SWITCHED: 'levelSwitched',
      MANIFEST_PARSED: 'manifestParsed',
      LEVEL_LOADED: 'levelLoaded',
      FRAG_LOADED: 'fragLoaded',
      FRAG_BUFFERED: 'fragBuffered',
      ERROR: 'error',
    };

    static ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
    static isSupported = () => true;

    constructor(settings = {}) {
      this.handlers = {};
      this.autoLevelEnabled = true;
      this.currentLevel = -1;
      this.userConfig = settings;
      window.mockHlsInstances = window.mockHlsInstances || [];
      window.mockHlsInstances.push(this);
    }

    on(event, callback) {
      this.handlers[event] = this.handlers[event] || [];
      this.handlers[event].push(callback);
    }

    once(event, callback) {
      const onceCallback = (...args) => {
        this.handlers[event] = this.handlers[event].filter((handler) => handler !== onceCallback);
        callback(...args);
      };
      this.on(event, onceCallback);
    }

    emit(event, data = {}) {
      for (const callback of [...(this.handlers[event] || [])]) {
        callback(event, data);
      }
    }

    attachMedia(media) {
      this.media = media;
      setTimeout(() => {
        this.emit(Hls.Events.MEDIA_ATTACHED);
        this.emit(Hls.Events.MANIFEST_PARSED, { levels });
        this.emit(Hls.Events.LEVEL_SWITCHED, { level: 0 });
        this.emit(Hls.Events.LEVEL_LOADED, { details: { live: false } });
      });
    }

    loadSource(source) {
      this.source = source;
    }

    stopLoad() {}
    startLoad() {
      this.startLoadCalled = true;
    }
    recoverMediaError() {}
    swapAudioCodec() {}
    detachMedia() {}
    destroy() {}
  }

  window.Hls = Hls;
})();
