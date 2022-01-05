import $script from 'scriptjs';
import { supportsHLS } from '../utils/media';
import { formatTime } from '../utils/time';
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
                    resolve();
                });
            } else {
                resolve();
            }
        });
    };

    useNative = () => {
        const { player } = this;

        player.allowPlayStream = true;

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
            maxMaxBufferLength: 30,
            maxBufferSize: (player.touch ? 25 : 50) * 1000 * 1000,
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

        return this.hls;
    };

    listeners = () => {
        const { player } = this;

        this.hls.on(Hls.Events.MEDIA_ATTACHED, (e, data) => {
            player.debug.log(e, data);

            this.hls.loadSource(player.currentSource.src);

            player.allowPlayStream = true;

            if (player.playStream) {
                player.playPause.toggle();
            } else {
                player.autoPlay.apply();
            }
        });

        this.hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (e, data) => {
            if (!player.audio.enabled) {
                return;
            }

            player.debug.log(e, data);

            for (const audio of data.audioTracks) {
                player.audio.addTrack(audio);
            }

            player.audio.update();
        });

        this.hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (e, data) => {
            if (!player.audio.enabled) {
                return;
            }

            player.debug.log(e, data);

            player.audio.checkTrack(data.id);
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
            player.debug.log(e, data);

            if (!this.hls.autoLevelEnabled || player.multipleSourceTypes) {
                return;
            }

            player.quality.auto = true;
            player.quality.current = data.level;
            player.quality.update();
        });

        this.hls.on(Hls.Events.LEVEL_SWITCHING, (e, data) => {
            player.debug.log(e, data);
        });

        this.hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
            player.debug.log(e, data);

            if (player.multipleSourceTypes) {
                return;
            }

            player.quality.add(data.levels);
        });

        this.hls.once(Hls.Events.LEVEL_LOADED, (e, data) => {
            player.debug.log(e, data);

            if (data.details.live) {
                this.setupLive();
            }
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

    setupLive = () => {
        const { player } = this;
        const live = player.streaming.live;

        this.hls.on(Hls.Events.LEVEL_LOADED, () => {
            player.listeners.time();
            player.listeners.duration();
            player.listeners.progress();
        });

        live.init().onClick(() => {
            player.currentTime = this.hls.liveSyncPosition;
        });

        live.timeDisplay = () => {
            const liveDelay = player.duration - player.currentTime;

            live.toggleStatus(liveDelay < this.hls.targetLatency);

            return `- ${formatTime(liveDelay)}`;
        };
    };
}

export default Hlsjs;
