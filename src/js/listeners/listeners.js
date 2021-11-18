import Update from '../control-bar/update';
import { IS_ANDROID, IS_IOS, IS_IPHONE, TOUCH_ENABLED } from '../utils/browser';
import { on } from '../utils/events';

class Listeners extends Update {
    constructor(player) {
        super(player);
        this.player = player;

        this.media();
        this.controls();
        this.wrapper();
    }

    media = () => {
        const { player } = this;

        // Play/pause toggle
        on.call(player, player.media, IS_IOS ? 'touchend' : 'click', () => {
            // Not pause if the user is idle on mobile and the video is playing
            if (TOUCH_ENABLED && !player.userActivity.active && !player.paused) {
                return;
            }

            player.playPause.toggle();
        });

        // Display time, duration and video progress
        on.call(player, player.media, 'timeupdate seeking seeked', () => {
            player.toggleLoader(false);
            this.time();
            this.duration();
            this.progress();
        });

        // Display buffer
        on.call(player, player.media, 'progress', () => {
            this.buffer();
        });

        // Display duration
        on.call(player, player.media, 'durationchange loadeddata loadedmetadata', () => {
            this.duration();

            // Make progress smoother in videos with short duration
            if (player.duration <= 60) {
                this.updateRefreshInterval = 30;
            }

            // TODO: remove after tweaking adsupport, vast and vpaid
            player.prepareVastAds();
        });

        // Handle the media finishing
        on.call(player, player.media, 'ended', player.onMainVideoEnded);

        // Update play/pause in dom
        on.call(player, player.media, 'play pause ended', (event) => {
            if (event.type === 'play') {
                player.fps.check();
            }

            player.playPause.toggleControls();
        });

        // Show loader on waiting
        on.call(player, player.media, 'waiting', () => {
            player.toggleLoader(true);
        });

        // Update the volume control in the control bar
        on.call(player, player.media, 'volumechange', player.volumeControl.update);

        // TODO: restore speed after ad
        on.call(player, player.media, 'ratechange', () => {
            if (player.isCurrentlyPlayingAd) {
                player.speed = 1;
            }
        });

        on.call(player, player.media, 'error', player.onErrorDetection);
    };

    wrapper = () => {
        const { player } = this;

        // Toggle control bar on mouse events and touch end events
        if (!IS_ANDROID && !IS_IPHONE) {
            on.call(player, player.wrapper, 'mouseleave', () => {
                player.controlBar.toggle(false);
            });

            on.call(player, player.wrapper, 'mouseenter', () => {
                player.controlBar.toggle(true);
            });
        } else {
            player.controlBar.toggle(false);
            on.call(player, player.wrapper, 'touchstart', () => {
                player.controlBar.toggle(true);
            });
        }

        // Resize elements
        on.call(player, window, 'resize', player.resize);

        // Resize elements
        on.call(player, player.media, 'enterfullscreen exitfullscreen theatreModeOn theatreModeOff', player.resize);

        // Listener of user activity
        on.call(
            player,
            player.wrapper,
            'mousemove mousedown mouseup touchstart touchmove touchend',
            player.userActivity.activity,
        );
    };

    controls = () => {
        const { player } = this;

        // Play/pause toggle
        on.call(player, player.controls.playPause, 'click', player.playPause.toggle);

        // Toggle mute
        on.call(player, player.controls.mute, 'click', player.toggleMute);

        // Toggle fullscreen
        on.call(player, player.controls.fullscreen, 'click', player.fullscreen.toggle);

        // Volume control
        on.call(player, player.controls.volumeContainer, 'mousedown touchstart', player.volumeControl.start);
    };
}

export default Listeners;
