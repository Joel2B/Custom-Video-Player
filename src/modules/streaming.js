'use strict';

// Prevent DASH.js from automatically attaching to video sources by default.
// Whoever thought this is a good idea?!
if (typeof window !== 'undefined' && !window.dashjs) {
    window.dashjs = {
        skipAutoCreate: true,
        isDefaultSubject: true
    };
}

export default function (self, options) {
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
                : self.displayOptions.layoutControls.autoPlay;

            const defaultOptions = {
                'debug': {
                    'logLevel': typeof FP_DEBUG !== 'undefined' && FP_DEBUG === true
                        ? dashjs.Debug.LOG_LEVEL_DEBUG
                        : dashjs.Debug.LOG_LEVEL_FATAL
                }
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

    self.updateViewQualityLevels = () => {
        const previousLevel = document.querySelector('.cvp_quality .cvp_active');
        if (previousLevel) {
            previousLevel.classList.remove('cvp_active');
        }

        if (!self.inSubMenu) {
            self.restartMenuLater();
        }

        const currentLevel = document.querySelector(`[data-level='${self.currentQualityLevel}']`)
        currentLevel.classList.add('cvp_active');

        self.domRef.controls.qualitySelector.lastChild.textContent = currentLevel.firstChild.textContent;
    }

    self.selectQualityLevel = (e) => {
        const levelSelect = Number(e.target.dataset.level);
        if (levelSelect == self.currentQualityLevel) {
            return;
        }

        self.inSubMenu = false;
        self.currentQualityLevel = levelSelect;
        self.updateViewQualityLevels();

        if (self.hlsPlayer) {
            // reset the "auto" label, if a level is selected
            const auto = e.target.parentNode.lastChild;
            if (auto.textContent != 'Auto' && self.currentQualityLevel != -1) {
                auto.textContent = 'Auto';
            }
            self.hlsPlayer.currentLevel = levelSelect;
        } else {
            self.setBuffering();
            self.setVideoSource(self.domRef.player.querySelectorAll('source')[levelSelect].src);
        }

        self.setLocalStorage('forceQualityLevel', levelSelect, 30);
        self.closeMenu();
    };

    self.initialiseHls = () => {
        if (Hls.isSupported()) {
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

            self.displayOptions.modules.onBeforeInitHls(hls);

            const options = self.displayOptions.modules.configureHls(defaultOptions);
            const hls = new Hls(options);

            self.hlsPlayer = hls;

            hls.attachMedia(self.domRef.player);

            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(self.originalSrc);
            })

            hls.on(Hls.Events.LEVEL_SWITCHED, (e, data) => {
                if (self.currentQualityLevel != -1) {
                    return;
                }

                self.currentQualityLevel = -1;
                self.updateViewQualityLevels();

                const autoLevel = document.querySelector(`[data-level='-1']`);
                const levelSwitched = document.querySelector(`[data-level='${data.level}']`).firstChild.textContent;
                const text = `Auto (${levelSwitched})`;

                autoLevel.textContent = text;
                self.domRef.controls.qualitySelector.lastChild.textContent = text;
            })

            hls.on(Hls.Events.LEVEL_SWITCHING, (e, data) => {
                console.log('LEVEL_SWITCHING', data)
            })

            hls.on(Hls.Events.MANIFEST_LOADED, (e, data) => {
                let level = self.getLocalStorage('forceQualityLevel');
                if (level === false || level == -1 || !self.displayOptions.layoutControls.persistentSettings.quality) {
                    self.domRef.controls.levelsPage.lastChild.classList.add('cvp_active');
                    return;
                }

                level = Number(level);
                if (level >= data.levels.length) {
                    level = data.levels.length - 1;
                }

                self.hlsPalayer.startLevel = level;
                self.hlsPlayer.nextLevel = level;

                self.currentQualityLevel = level;
                self.updateViewQualityLevels();
            });

            hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
                console.log('MANIFEST_PARSED', data)

                let levels = []

                for (const [index, level] of data.levels.entries()) {
                    let info = [];
                    self.hightLevelOptions += 26;
                    const height = level.height;
                    const bitrate = (level.bitrate / 1000).toFixed();

                    if (height >= 720) {
                        info.push({
                            tag: 'span',
                            className: 'hd',
                            textContent: 'HD',
                        });
                    }

                    info.push({
                        tag: 'span',
                        className: 'kbps',
                        textContent: `${bitrate} kbps`,
                    });

                    levels.push(self.createElement({
                        tag: 'li',
                        textContent: `${height}p`,
                        dataset: { level: index },
                        childs: info,
                    }, (e) => {
                        self.selectQualityLevel(e);
                    }));
                }

                levels.reverse();
                levels.push(self.createElement({
                    tag: 'li',
                    className: 'cvp_active',
                    textContent: 'Auto',
                    dataset: { level: -1 },
                }, (e) => {
                    self.selectQualityLevel(e);
                }));

                self.domRef.controls.levelsPage.append(...levels);
            });

            hls.on(Hls.Events.ERROR, (e, data) => {
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


            if (!self.firstPlayLaunched && self.getLocalStorage('autoPlay')) {
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
