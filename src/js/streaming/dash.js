import $script from 'scriptjs';
import { formatTime } from '../utils/time';
import is from '../utils/is';

class Dash {
    constructor(player) {
        this.player = player;

        this.liveThresholdSecs = 12;
    }

    load = () => {
        return new Promise((resolve) => {
            if (!window.dashjs || !is.function(window.dashjs.MediaPlayer)) {
                window.dashjs = {
                    skipAutoCreate: true,
                    isDefaultSubject: true,
                };

                $script(this.player.config.dash.url, () => {
                    resolve();
                });
            } else {
                resolve();
            }
        });
    };

    init = () => {
        const { player } = this;
        const { config } = player;

        if (!dashjs.supportsMediaSource()) {
            player.debug.warn('Media type not supported by this browser using DASH.js. (application/dash+xml)');
            player.nextSource();
            return;
        }

        // TODO: ads don't work in autoplay until you do a play/pause
        // If false we want to override the autoPlay, as it comes from postRoll
        const autoPlay = !player.autoplayAfterAd ? player.autoplayAfterAd : player.autoPlay.apply(false);

        let settings = {
            debug: {
                logLevel: FP_DEBUG || config.dash.debug ? dashjs.Debug.LOG_LEVEL_DEBUG : dashjs.Debug.LOG_LEVEL_FATAL,
            },
        };

        settings = config.dash.config(settings);

        this.dash = dashjs.MediaPlayer().create();

        this.dash.updateSettings(settings);

        config.dash.onBeforeInit(this.dash);

        this.dash.initialize(player.media, player.currentSource.src, autoPlay);

        this.listeners();

        config.dash.onAfterInit(this.dash);

        return this.dash;
    };

    listeners = () => {
        const { player } = this;

        this.dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZING, () => {
            player.toggleLoader(true);
        });

        this.dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
            if (this.dash.isDynamic()) {
                this.setupLive();
            }
        });

        this.dash.on(dashjs.MediaPlayer.events.CAN_PLAY, () => {
            player.toggleLoader(false);
        });

        this.dash.on(dashjs.MediaPlayer.events.PLAYBACK_PLAYING, () => {
            player.toggleLoader(false);
        });

        this.dash.on(dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED, () => {
            player.listeners.time();
            player.listeners.duration();
            player.listeners.progress();
        });
    };

    setupLive = () => {
        const { player } = this;
        const live = player.streaming.live;

        live.init().onClick(() => {
            this.dash.seek(this.dash.duration());
        });

        live.setCurrentTime = (input) => this.dash.seek(input);

        live.getCurrentTime = () => this.dash.time();

        live.duration = () => this.dash.duration();

        live.timeDisplay = () => {
            const liveDelay = player.duration - player.currentTime;

            live.toggleStatus(liveDelay < this.liveThresholdSecs);

            return `- ${formatTime(liveDelay)}`;
        };
    };
}

export default Dash;
