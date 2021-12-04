import $script from 'scriptjs';
import { TOUCH_ENABLED } from '../utils/browser';
import { supportsHLS } from '../utils/media';
import is from '../utils/is';

class Hlsjs {
    constructor(player) {
        this.player = player;

        this.url = player.config.hls.url;

        if (player.subtitles.enabled && !player.subtitles.config.timestampMap) {
            this.url = player.config.hls.customUrl;
        }
    }

    load = () => {
        return new Promise((resolve) => {
            if (!window.Hls) {
                $script(this.url, () => {
                    resolve(this.init());
                });
            } else {
                resolve(this.init());
            }
        });
    };

    useNative = () => {
        const { player } = this;

        if (!player.multipleVideoSources) {
            player.menu.remove('qualityLevels');
        }

        player.autoPlay.apply();
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
                player.nextSource();
            }
            return;
        }

        let settings = {
            debug: FP_DEBUG || config.hls.debug,
            autoStartLoad: true,
            capLevelToPlayerSize: false,
            maxBufferLength: 30,
            maxMaxBufferLength: 30,
            maxBufferSize: TOUCH_ENABLED ? 25000000 : 50000000,
            maxBufferHole: 0.3,
            maxSeekHole: 3,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10,
            enableWorker: true,
            enableSoftwareAES: true,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 500,
            levelLoadingTimeOut: 10000,
            levelLoadingMaxRetry: 3,
            levelLoadingRetryDelay: 500,
            fragLoadingTimeOut: 30000,
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 500,
            fpsDroppedMonitoringPeriod: 5000,
            fpsDroppedMonitoringThreshold: 0.2,
            appendErrorMaxRetry: 3,
            abrBandWidthFactor: 0.6,
            abrBandWidthUpFactor: 0.5,
        };

        // The current configuration may cause an infinite cycle of fragment download, use a custom one
        settings = config.hls.config(settings);

        if (!player.subtitles.native) {
            settings.renderTextTracksNatively = false;
        }

        this.hls = new Hls(settings);

        config.hls.onBeforeInit(this.hls);

        this.hls.attachMedia(player.media);

        this.listeners();

        config.hls.onAfterInit(this.hls);

        player.autoPlay.apply();

        return this.hls;
    };

    listeners = () => {
        const { player } = this;

        this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            this.hls.loadSource(player.originalSrc);
        });

        this.hls.on(Hls.Events.NON_NATIVE_TEXT_TRACKS_FOUND, (e, data) => {
            if (!player.subtitles.enabled) {
                return;
            }

            player.debug.log(e, data);

            // ocultar subtitulos de hls
            this.hls.subtitleDisplay = false;

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
                    id: id,
                    type: 'hls',
                    kind: rawTrack.kind,
                    label: rawTrack.label,
                    src: src,
                    srclang: lang,
                    default: rawTrack.default,
                    forced: forced,
                };

                player.subtitles.addTrack(track);
            }

            player.subtitles.emulateTextTracks('external');
        });

        this.hls.on(Hls.Events.CUES_PARSED, (e, data) => {
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
                    track.cues.push(...data.cues);

                    player.subtitles.updateActiveCues();
                    player.subtitles.render();
                    return;
                }
            }
        });

        this.hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (e, data) => {
            if (!player.subtitles.enabled) {
                return;
            }

            player.debug.log(e, data);

            player.subtitles.checkTrack(data.id);
        });

        this.hls.on(Hls.Events.LEVEL_SWITCHED, (e, data) => {
            if ((player.quality.current !== -1 && !player.quality.auto) || player.multipleVideoSources) {
                return;
            }

            player.quality.auto = true;
            player.quality.current = data.level;
            player.quality.update();
        });

        this.hls.on(Hls.Events.LEVEL_SWITCHING, (e, data) => {
            player.debug.log('LEVEL_SWITCHING', data);
        });

        this.hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
            player.debug.log('MANIFEST_PARSED', data);

            if (data.levels.length === 1 && !player.multipleVideoSources) {
                player.menu.remove('qualityLevels');
                return;
            }

            if (player.multipleVideoSources) {
                return;
            }

            player.quality.add(data.levels);
            player.quality.set(data.levels);
        });

        this.hls.on(Hls.Events.ERROR, (e, data) => {
            if (player.isCurrentlyPlayingAd) {
                return;
            }

            if (!data.fatal) {
                return;
            }

            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    // try to recover network error
                    player.debug.log('fatal network error encountered, try to recover');
                    this.hls.startLoad();
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    player.debug.log('fatal media error encountered, try to recover');
                    this.hls.recoverMediaError();
                    break;
                default:
                    // cannot recover
                    this.hls.destroy();
                    break;
            }
        });
    };
}

export default Hlsjs;
