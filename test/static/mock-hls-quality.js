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
      ERROR: 'error',
    };

    static ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
    static isSupported = () => true;

    constructor() {
      this.handlers = {};
      this.autoLevelEnabled = true;
      this.currentLevel = -1;
      this.userConfig = {};
    }

    on(event, callback) {
      this.handlers[event] = callback;
    }

    once(event, callback) {
      this.on(event, callback);
    }

    attachMedia(media) {
      this.media = media;
      setTimeout(() => {
        this.handlers[Hls.Events.MEDIA_ATTACHED]?.(Hls.Events.MEDIA_ATTACHED, {});
        this.handlers[Hls.Events.MANIFEST_PARSED]?.(Hls.Events.MANIFEST_PARSED, { levels });
        this.handlers[Hls.Events.LEVEL_SWITCHED]?.(Hls.Events.LEVEL_SWITCHED, { level: 0 });
        this.handlers[Hls.Events.LEVEL_LOADED]?.(Hls.Events.LEVEL_LOADED, { details: { live: false } });
      });
    }

    loadSource(source) {
      this.source = source;
    }

    stopLoad() {}
    startLoad() {
      this.startLoadCalled = true;
    }
    detachMedia() {}
    destroy() {}
  }

  window.Hls = Hls;
})();
