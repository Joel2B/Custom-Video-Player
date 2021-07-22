'use strict';

// Prevent DASH.js from automatically attaching to video sources by default.
// Whoever thought this is a good idea?!
if (typeof window !== 'undefined' && !window.dashjs) {
    window.dashjs = {
        skipAutoCreate: true,
        isDefaultSubject: true
    };
}

export default function (playerInstance, options) {
    const $script = require('scriptjs');

    playerInstance.initialiseStreamers = () => {
        playerInstance.detachStreamers();
        switch (playerInstance.displayOptions.layoutControls.mediaType) {
            case 'application/dash+xml': // MPEG-DASH
                if (!playerInstance.dashScriptLoaded && (!window.dashjs || window.dashjs.isDefaultSubject)) {
                    playerInstance.dashScriptLoaded = true;
                    $script('https://cdn.dashjs.org/latest/dash.mediaplayer.min.js', function () {
                        playerInstance.initialiseDash();
                    });
                } else {
                    playerInstance.initialiseDash();
                }
                break;
            case 'application/x-mpegurl': // HLS
                if (!playerInstance.hlsScriptLoaded && !window.Hls) {
                    playerInstance.hlsScriptLoaded = true;
                    $script('https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js', () => {
                        playerInstance.initialiseHls();
                    });
                } else {
                    playerInstance.initialiseHls();
                }
                break;
        }
    };

    playerInstance.initialiseDash = () => {
        if (typeof (window.MediaSource || window.WebKitMediaSource) === 'function') {
            // If false we want to override the autoPlay, as it comes from postRoll
            const playVideo = !playerInstance.autoplayAfterAd
                ? playerInstance.autoplayAfterAd
                : playerInstance.displayOptions.layoutControls.autoPlay;

            const defaultOptions = {
                'debug': {
                    'logLevel': typeof FP_DEBUG !== 'undefined' && FP_DEBUG === true
                        ? dashjs.Debug.LOG_LEVEL_DEBUG
                        : dashjs.Debug.LOG_LEVEL_FATAL
                }
            };

            const dashPlayer = dashjs.MediaPlayer().create();
            const options = playerInstance.displayOptions.modules.configureDash(defaultOptions);

            dashPlayer.updateSettings(options);

            playerInstance.displayOptions.modules.onBeforeInitDash(dashPlayer);

            dashPlayer.initialize(playerInstance.domRef.player, playerInstance.originalSrc, playVideo);

            dashPlayer.on('streamInitializing', () => {
                playerInstance.toggleLoader(true);
            });

            dashPlayer.on('canPlay', () => {
                playerInstance.toggleLoader(false);
            });

            dashPlayer.on('playbackPlaying', () => {
                playerInstance.toggleLoader(false);
            });

            playerInstance.displayOptions.modules.onAfterInitDash(dashPlayer);

            playerInstance.dashPlayer = dashPlayer;
        } else {
            playerInstance.nextSource();
            console.log('[FP_WARNING] Media type not supported by this browser using DASH.js. (application/dash+xml)');
        }
    };

    playerInstance.updateViewQualityLevels = () => {
        const previousLevel = document.querySelector('.cvp_quality .cvp_active');
        if (previousLevel) {
            previousLevel.classList.remove('cvp_active');
        }

        if (!playerInstance.inSubMenu) {
            playerInstance.restartMenuLater();
        }

        const currentLevel = document.querySelector(`[data-level='${playerInstance.currentQualityLevel}']`)
        currentLevel.classList.add('cvp_active');

        playerInstance.domRef.controls.qualitySelector.lastChild.textContent = currentLevel.firstChild.textContent;
    }

    playerInstance.selectQualityLevel = (e) => {
        const levelSelect = Number(e.target.dataset.level);
        if (levelSelect == playerInstance.currentQualityLevel) {
            return;
        }

        playerInstance.inSubMenu = false;

        playerInstance.currentQualityLevel = levelSelect;
        playerInstance.updateViewQualityLevels();

        // reset the "auto" label, if a level is selected
        const auto = e.target.parentNode.lastChild;
        if (auto.textContent != 'Auto' && playerInstance.currentQualityLevel != -1) {
            auto.textContent = 'Auto';
        }

        playerInstance.closeMenu();

        playerInstance.hlsPlayer.currentLevel = levelSelect;
        playerInstance.setLocalStorage('forceQualityLevel', levelSelect, 30);
    };

    playerInstance.initialiseHls = () => {
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

            playerInstance.displayOptions.modules.onBeforeInitHls(hls);

            const options = playerInstance.displayOptions.modules.configureHls(defaultOptions);
            const hls = new Hls(options);

            playerInstance.hlsPlayer = hls;

            hls.attachMedia(playerInstance.domRef.player);

            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(playerInstance.originalSrc);
            })

            hls.on(Hls.Events.LEVEL_SWITCHED, (e, data) => {
                if (playerInstance.currentQualityLevel != -1) {
                    return;
                }

                playerInstance.currentQualityLevel = -1;
                playerInstance.updateViewQualityLevels();

                const autoLevel = document.querySelector(`[data-level='-1']`);
                const levelSwitched = document.querySelector(`[data-level='${data.level}']`).firstChild.textContent;
                const text = `Auto (${levelSwitched})`;

                autoLevel.textContent = text;
                playerInstance.domRef.controls.qualitySelector.lastChild.textContent = text;
            })

            hls.on(Hls.Events.LEVEL_SWITCHING, (e, data) => {
                console.log('LEVEL_SWITCHING', data)
            })

            hls.on(Hls.Events.MANIFEST_LOADED, (e, data) => {
                let level = playerInstance.getLocalStorage('forceQualityLevel');
                if (level === false || level == -1) {
                    // const previousLevel = document.querySelector('.cvp_quality .cvp_active');
                    // if (previousLevel) {
                    //     previousLevel.classList.remove('cvp_active');
                    // }
                    playerInstance.domRef.controls.levelsPage.lastChild.classList.add('cvp_active');
                    return;
                }

                level = Number(level);
                if (level >= data.levels.length) {
                    level = data.levels.length - 1;
                }

                playerInstance.hlsPlayer.startLevel = level;
                playerInstance.hlsPlayer.nextLevel = level;

                playerInstance.currentQualityLevel = level;
                playerInstance.updateViewQualityLevels();
            });

            hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
                console.log('MANIFEST_PARSED', data)

                let levels = []

                for (const [index, level] of data.levels.entries()) {
                    let info = [];
                    playerInstance.hightLevelOptions += 26;
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

                    levels.push(playerInstance.createElement({
                        tag: 'li',
                        textContent: `${height}p`,
                        dataset: { level: index },
                        childs: info,
                    }, (e) => {
                        playerInstance.selectQualityLevel(e);
                    }));
                }

                levels.reverse();
                levels.push(playerInstance.createElement({
                    tag: 'li',
                    className: 'cvp_active',
                    textContent: 'Auto',
                    dataset: { level: -1 },
                }, (e) => {
                    playerInstance.selectQualityLevel(e);
                }));

                playerInstance.domRef.controls.levelsPage.append(...levels);
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
                            playerInstance.recoverError();
                            break;
                    }
                }
            });

            playerInstance.displayOptions.modules.onAfterInitHls(hls);


            if (!playerInstance.firstPlayLaunched && playerInstance.getLocalStorage('autoPlay')) {
                playerInstance.domRef.player.play();
            }
        } else {
            playerInstance.nextSource();
            console.log('[FP_WARNING] Media type not supported by this browser using HLS.js. (application/x-mpegURL)');
        }
    };

    playerInstance.detachStreamers = () => {
        if (playerInstance.dashPlayer) {
            playerInstance.dashPlayer.reset();
            playerInstance.dashPlayer = false;
        } else if (playerInstance.hlsPlayer) {
            playerInstance.hlsPlayer.detachMedia();
            playerInstance.hlsPlayer = false;
        }
    };
}
