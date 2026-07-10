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
      ERROR: 'error',
    };

    static ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
    static isSupported = () => true;

    constructor() {
      this.handlers = {};
      this.destroyed = false;
      window.mockHlsInstances = window.mockHlsInstances || [];
      window.mockHlsInstances.push(this);
    }

    on(event, callback) {
      this.handlers[event] = callback;
    }

    once(event, callback) {
      this.on(event, callback);
    }

    attachMedia(media) {
      this.media = media;
      setTimeout(() => this.handlers[Hls.Events.MEDIA_ATTACHED]?.(Hls.Events.MEDIA_ATTACHED, {}));
    }

    loadSource(source) {
      this.source = source;
    }

    stopLoad() {}
    detachMedia() {
      this.media = null;
    }

    destroy() {
      this.destroyed = true;
    }
  }

  window.Hls = Hls;
})();
