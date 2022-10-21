import { removeTransition } from '../utils/css';
import { hasClass, toggleClass } from '../utils/dom';
import is from '../utils/is';

class ControlBar {
  constructor(player) {
    this.player = player;
  }

  toggle = (input) => {
    // true: show
    // false: hide
    const { player } = this;

    if (player.isCurrentlyPlayingAd && !player.paused) {
      player.toggleAdCountdown(input);
    }

    const controls = player.controls.container;
    const title = player.title.el;
    const logo = player.logo.el;

    toggleClass(controls, 'fade_out', !input);
    toggleClass(controls, 'fade_in', input);

    toggleClass(title, 'fade_out', !input);
    toggleClass(title, 'fade_in', input);

    if (player.isCurrentlyPlayingAd && player.config.layoutControls.logo.showOverAds) {
      toggleClass(logo, 'fade_out', true);
    } else {
      if (player.config.layoutControls.logo.hideWithControls) {
        toggleClass(logo, 'fade_out', !input);
        toggleClass(logo, 'fade_in', input);
      }
    }

    let cursor = 'default';
    if (!input) {
      cursor = 'none';
      player.menu.close();
    }

    player.wrapper.style.cursor = cursor;
    player.playPause.initialPlay.style.cursor =
      player.firstPlayLaunched || !player.config.layoutControls.playButtonShowing ? cursor : 'pointer';

    if (!player.config.layoutControls.controlBar.animated) {
      removeTransition(controls);
      removeTransition(logo);
      removeTransition(title);
    }
  };

  toggleMobile = (input) => {
    const { player } = this;

    if (!player.mobile) {
      return;
    }

    let showControls = !hasClass(player.wrapper, 'fluid_show_controls');

    if (!is.nullOrUndefined(input)) {
      showControls = input;
    }

    toggleClass(player.wrapper, 'fluid_show_controls', showControls);
    toggleClass(player.wrapper, 'fluid_hide_controls', !showControls);
  };

  linkControlBarUserActivity = () => {
    const { player } = this;

    player.on('userInactive', () => {
      if (!player.paused) {
        this.toggle(false);
        this.toggleMobile(false);
      }
    });

    player.on('userActive', () => {
      this.toggle(true);
    });
  };

  toggleControlBar = (input) => {
    toggleClass(this.player.controls.container, 'initial_controls_show', input);
  };
}

export default ControlBar;
