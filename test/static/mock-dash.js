(() => {
  const events = {
    STREAM_INITIALIZING: 'streamInitializing',
    STREAM_INITIALIZED: 'streamInitialized',
    CAN_PLAY: 'canPlay',
    PLAYBACK_PLAYING: 'playbackPlaying',
    PLAYBACK_NOT_ALLOWED: 'playbackNotAllowed',
    PLAYBACK_TIME_UPDATED: 'playbackTimeUpdated',
    ERROR: 'error',
    PLAYBACK_ERROR: 'playbackError',
  };

  const errors = {
    MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE: 10,
    TIME_SYNC_FAILED_ERROR_CODE: 16,
    FRAGMENT_LOADER_LOADING_FAILURE_ERROR_CODE: 17,
    CAPABILITY_MEDIASOURCE_ERROR_CODE: 23,
    CAPABILITY_MEDIAKEYS_ERROR_CODE: 24,
    DOWNLOAD_ERROR_ID_MANIFEST_CODE: 25,
    DOWNLOAD_ERROR_ID_CONTENT_CODE: 27,
    DOWNLOAD_ERROR_ID_INITIALIZATION_CODE: 28,
    MANIFEST_ERROR_ID_PARSE_CODE: 31,
    MANIFEST_ERROR_ID_NOSTREAMS_CODE: 32,
    TIMED_TEXT_ERROR_ID_PARSE_CODE: 33,
    MANIFEST_ERROR_ID_MULTIPLEXED_CODE: 34,
    MEDIASOURCE_TYPE_UNSUPPORTED_CODE: 35,
    NO_SUPPORTED_KEY_IDS: 36,
  };

  const create = () => {
    const instance = {
      handlers: {},
      resetCalled: false,
      playCalls: 0,
      pauseCalls: 0,
      updateSettings(settings) {
        this.settings = settings;
      },
      initialize(media, source, autoPlay) {
        this.media = media;
        this.source = source;
        this.autoPlay = autoPlay;
      },
      on(event, callback) {
        this.handlers[event] = callback;
      },
      emit(event, data = {}) {
        this.handlers[event]?.(data);
      },
      play() {
        this.playCalls++;
      },
      pause() {
        this.pauseCalls++;
      },
      isDynamic() {
        return false;
      },
      reset() {
        this.resetCalled = true;
      },
    };
    window.mockDashInstances = window.mockDashInstances || [];
    window.mockDashInstances.push(instance);
    return instance;
  };

  const MediaPlayer = () => ({ create });
  MediaPlayer.events = events;
  MediaPlayer.errors = errors;

  window.dashjs = {
    Debug: { LOG_LEVEL_DEBUG: 5, LOG_LEVEL_FATAL: 1 },
    MediaPlayer,
    supportsMediaSource: () => true,
  };
})();
