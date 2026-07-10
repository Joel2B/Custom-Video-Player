(() => {
  const events = {
    STREAM_INITIALIZING: 'streamInitializing',
    STREAM_INITIALIZED: 'streamInitialized',
    CAN_PLAY: 'canPlay',
    PLAYBACK_PLAYING: 'playbackPlaying',
    PLAYBACK_TIME_UPDATED: 'playbackTimeUpdated',
  };

  const create = () => {
    const instance = {
      handlers: {},
      resetCalled: false,
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

  window.dashjs = {
    Debug: { LOG_LEVEL_DEBUG: 5, LOG_LEVEL_FATAL: 1 },
    MediaPlayer,
    supportsMediaSource: () => true,
  };
})();
