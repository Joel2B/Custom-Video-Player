import Update from '../control-bar/update';
import { on } from '../utils/events';
import { toggleClass } from '../utils/dom';

class Listeners extends Update {
  constructor(player) {
    super(player);

    this.player = player;

    // TODO: improve
    // for HLS
    this.waiting = false;

    this.media();
    this.controls();
    this.wrapper();
  }

  media = () => {
    const { player } = this;

    // Play/pause toggle
    on.call(player, player.media, player.touch ? 'touchend' : 'click', () => {
      if (player.mobile) {
        return;
      }

      // Not pause if the user is idle on touch device and the video is playing
      if (player.touch && !player.userActivity.active && !player.paused) {
        return;
      }

      player.playPause.toggle();
    });

    // Display time, duration and video progress
    on.call(player, player.media, 'timeupdate seeking seeked', (event) => {
      if (player.playing) {
        this.waiting = false;
      }

      if (event.type === 'timeupdate' && !this.waiting) {
        player.toggleLoader(false);
      }

      this.time();
      this.duration();
      this.progress();
    });

    // Display buffer
    on.call(player, player.media, 'progress', () => {
      this.buffer();
    });

    // Display duration
    on.call(player, player.media, 'durationchange loadeddata loadedmetadata', (event) => {
      this.duration();

      // Make progress smoother in videos with short duration
      if (player.duration <= 60) {
        this.updateRefreshInterval = 30;
      }

      if (event.type === 'loadeddata') {
        player.speedMenu.set(player.storage.get(player.speedMenu.id), true);
      }
    });

    // Update play/pause in dom
    on.call(player, player.media, 'play pause ended emptied', (event) => {
      if (event.type === 'play') {
        player.fps.check();

        toggleClass(player.wrapper, 'fluid_playing', true);
        toggleClass(player.wrapper, 'fluid_paused', false);

        if (!player.firstPlayLaunched) {
          player.playPause.toggleControls();
        }
      }

      if (event.type === 'pause') {
        toggleClass(player.wrapper, 'fluid_playing', false);
        toggleClass(player.wrapper, 'fluid_paused', true);
      }

      if (player.firstPlayLaunched) {
        player.playPause.toggleControls();
      }
    });

    // Show loader on waiting
    on.call(player, player.media, 'waiting', () => {
      player.toggleLoader(true);
    });

    // Update the volume control in the control bar
    on.call(player, player.media, 'volumechange', player.volumeControl.update);

    on.call(player, player.media, 'ratechange', () => {
      if (!player.speedMenu.lock) {
        player.speedMenu.set(player.speed);
      }
    });

    on.call(player, player.media, 'error', () => {
      player.debug.warn(player.media.error);

      // Fallback sources are mixed with the sources of different quality
      if (player.media.error.code === 4) {
        player.nextSource();
      }
    });
  };

  wrapper = () => {
    const { player } = this;

    // Toggle control bar on mouse events and touch end events
    if (!player.mobile) {
      on.call(player, player.wrapper, 'mouseleave', () => {
        player.controlBar.toggle(false);
      });

      on.call(player, player.wrapper, 'mouseenter', () => {
        player.controlBar.toggle(true);
      });

      on.call(player, player.wrapper, 'mousemove', () => {
        player.controlBar.toggle(true);
      });
    } else if (player.touch) {
      player.controlBar.toggle(false);
      on.call(player, player.wrapper, 'touchstart', () => {
        player.controlBar.toggle(true);
      });
    }

    // Resize elements
    on.call(player, window, 'resize', player.resize);
    on.call(player, player.media, 'enterfullscreen exitfullscreen theatreModeOn theatreModeOff', player.resize);

    // Listener of user activity
    on.call(
      player,
      player.wrapper,
      'mousemove mousedown mouseup touchstart touchmove touchend',
      player.userActivity.activity,
    );

    player.mobileControls.listeners();
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
    on.call(player, player.controls.volumeContainer, 'keydown', player.volumeControl.keydown, false);
  };
}

export default Listeners;
