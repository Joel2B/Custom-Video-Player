// Prevent DASH.js from automatically attaching to video sources by default.
// Whoever thought this is a good idea?!
if (typeof window !== 'undefined' && !window.dashjs) {
    window.dashjs = {
        skipAutoCreate: true,
        isDefaultSubject: true,
    };
}

export default function(self, options) {
    const $script = require('scriptjs');

    self.initialiseStreamers = () => {
        self.detachStreamers();
        switch (self.displayOptions.layoutControls.mediaType) {
            case 'application/dash+xml': // MPEG-DASH
                if (!self.dashScriptLoaded && (!window.dashjs || window.dashjs.isDefaultSubject)) {
                    self.dashScriptLoaded = true;
                    $script('https://cdn.dashjs.org/latest/dash.all.min.js', () => {
                        self.initialiseDash();
                    });
                } else {
                    self.initialiseDash();
                }
                break;
            case 'application/x-mpegurl': // HLS
                if (!self.hlsScriptLoaded && !window.Hls) {
                    self.hlsScriptLoaded = true;
                    $script('https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js', () => {
                        self.initialiseHls();
                    });
                } else {
                    self.initialiseHls();
                }
                break;
        }
    };

    self.initialiseDash = () => {
        if (typeof (window.MediaSource || window.WebKitMediaSource) === 'function') {
            // If false we want to override the autoPlay, as it comes from postRoll
            const playVideo = !self.autoplayAfterAd
                ? self.autoplayAfterAd
                : self.autoPlay.apply();

            const defaultOptions = {
                debug: {
                    logLevel: typeof FP_DEBUG !== 'undefined' && FP_DEBUG === true
                        ? dashjs.Debug.LOG_LEVEL_DEBUG
                        : dashjs.Debug.LOG_LEVEL_FATAL,
                },
            };

            const dashPlayer = dashjs.MediaPlayer().create();
            const options = self.displayOptions.modules.configureDash(defaultOptions);

            dashPlayer.updateSettings(options);

            self.displayOptions.modules.onBeforeInitDash(dashPlayer);

            dashPlayer.initialize(self.domRef.player, self.originalSrc, playVideo);

            dashPlayer.on('streamInitializing', () => {
                self.toggleLoader(true);
            });

            dashPlayer.on('canPlay', () => {
                self.toggleLoader(false);
            });

            dashPlayer.on('playbackPlaying', () => {
                self.toggleLoader(false);
            });

            self.displayOptions.modules.onAfterInitDash(dashPlayer);

            self.dashPlayer = dashPlayer;
        } else {
            self.nextSource();
            console.log('[FP_WARNING] Media type not supported by this browser using DASH.js. (application/dash+xml)');
        }
    };

    self.initialiseHls = () => {
        if (self.domRef.player.canPlayType('application/vnd.apple.mpegurl')) {
            if (!self.multipleVideoSources) {
                self.menu.remove('qualityLevels');
            }
        } else if (Hls.isSupported()) {
            const defaultOptions = {
                debug: typeof FP_DEBUG !== 'undefined' && FP_DEBUG === true,
                // autoStartLoad: i,
                // capLevelToPlayerSize: false,
                // maxBufferLength: 30,
                maxMaxBufferLength: 30,
                maxBufferSize: 50000000,
                maxBufferHole: 0.3,
                maxSeekHole: 3,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 10,
                // enableWorker: true,
                // enableSoftwareAES: true,
                // manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 3,
                manifestLoadingRetryDelay: 500,
                // levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 3,
                levelLoadingRetryDelay: 500,
                fragLoadingTimeOut: 30000,
                fragLoadingMaxRetry: 3,
                fragLoadingRetryDelay: 500,
                // fpsDroppedMonitoringPeriod: 5000,
                // fpsDroppedMonitoringThreshold: 0.2,
                // appendErrorMaxRetry: 3,
                abrBandWidthFactor: 0.6,
                abrBandWidthUpFactor: 0.5,
            };

            self.displayOptions.modules.onBeforeInitHls();

            const options = self.displayOptions.modules.configureHls(defaultOptions);
            const hls = new Hls(options);

            self.hlsPlayer = hls;

            hls.attachMedia(self.domRef.player);

            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(self.originalSrc);
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (e, data) => {
                if ((self.quality.current !== -1 && !self.quality.auto) || self.multipleVideoSources) {
                    return;
                }

                self.quality.auto = true;
                self.quality.current = data.level;
                self.quality.update();
            });

            if (process.env.NODE_ENV === 'development') {
                hls.on(Hls.Events.LEVEL_SWITCHING, (e, data) => {
                    console.log('LEVEL_SWITCHING', data);
                });
            }

            hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
                if (process.env.NODE_ENV === 'development') {
                    console.log('MANIFEST_PARSED', data);
                }
                if (data.levels.length === 1 && !self.multipleVideoSources) {
                    self.menu.remove('qualityLevels');
                    return;
                }

                if (self.multipleVideoSources) {
                    return;
                }

                self.quality.add(data.levels);
                self.quality.set(data.levels);
            });

            hls.on(Hls.Events.ERROR, (e, data) => {
                if (self.isCurrentlyPlayingAd) {
                    return;
                }

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                        // try to recover network error
                            console.log('fatal network error encountered, try to recover');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('fatal media error encountered, try to recover');
                            hls.recoverMediaError();
                            break;
                        default:
                        // cannot recover
                            self.recoverError();
                            break;
                    }
                }
            });

            self.displayOptions.modules.onAfterInitHls(hls);

            if (!self.firstPlayLaunched && self.autoPlay.apply()) {
                self.domRef.player.play();
            }
        } else {
            self.nextSource();
            console.log('[FP_WARNING] Media type not supported by this browser using HLS.js. (application/x-mpegURL)');
        }
    };

    self.detachStreamers = () => {
        if (self.dashPlayer) {
            self.dashPlayer.reset();
            self.dashPlayer = false;
        } else if (self.hlsPlayer) {
            self.hlsPlayer.detachMedia();
            self.hlsPlayer = false;
        }
    };
}
