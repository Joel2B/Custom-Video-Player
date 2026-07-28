(() => {
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
      this.destroyed = false;
      this.userConfig = settings;
      this.startLoadCalls = 0;
      this.stopLoadCalls = 0;
      this.detachCalls = 0;
      this.destroyCalls = 0;
      this.loadedSources = [];
      this.recoverMediaErrorCalls = 0;
      this.swapAudioCodecCalls = 0;
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
      if (window.mockHlsOptions?.autoAttach !== false) {
        setTimeout(() => this.emit(Hls.Events.MEDIA_ATTACHED));
      }
    }

    loadSource(source) {
      this.source = source;
      this.loadedSources.push(source);
      if (window.mockHlsOptions?.autoManifest !== false) {
        setTimeout(() => this.emit(Hls.Events.MANIFEST_PARSED, { levels: [] }));
      }
    }

    stopLoad() {
      this.stopLoadCalls++;
    }
    startLoad() {
      this.startLoadCalls++;
    }
    recoverMediaError() {
      this.recoverMediaErrorCalls++;
    }
    swapAudioCodec() {
      this.swapAudioCodecCalls++;
    }
    detachMedia() {
      this.detachCalls++;
      this.media = null;
    }

    destroy() {
      this.destroyCalls++;
      this.destroyed = true;
    }
  }

  window.Hls = Hls;
})();
