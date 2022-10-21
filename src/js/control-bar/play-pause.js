import { on } from '../utils/events';
import { createElement, hasClass, toggleClass } from '../utils/dom';
import { isHLS } from '../utils/media';
import is from '../utils/is';

class PlayPause {
  constructor(player) {
    this.player = player;
    this.playButtonTimer = null;

    this.init();
  }

  /**
     * Play button in the middle when the video loads
     */
  init = () => {
    const { player } = this;
    const { title, logo } = player;
    const primaryColor = player.config.layoutControls.primaryColor;
    const backgroundColor = primaryColor || '#333333';

    // Create the html for the play button
    const container = createElement('div', {
      class: 'fluid_initial_play_container',
    });

    this.initialPlay = createElement('div', {
      class: `fluid_initial_play ${!primaryColor && !player.mobile ? 'fluid_initial_play_color' : ''}`,
      style: `background-color: ${backgroundColor}`,
    });

    this.playButton = createElement('div', {
      class: 'fluid_initial_play_button',
    });

    this.initialPlay.appendChild(this.playButton);
    container.appendChild(this.initialPlay);

    if (this.player.mobile) {
      this.initialPlay.style.background = 'none';

      toggleClass(player.wrapper, 'fluid_show_controls', true);
      toggleClass(player.wrapper, 'fluid_paused', true);
    }

    on.call(player, container, player.mobile ? 'touchend' : 'click', () => {
      if (player.mobile && hasClass(player.wrapper, 'fluid_hide_controls')) {
        player.controlBar.toggleMobile();
        return;
      } else if (player.touch && !player.userActivity.active && !player.paused) {
        return;
      }

      this.toggle();
    });

    // If the user has chosen to not show the play button we'll make it invisible
    // We don't hide altogether because animations might still be used
    if (!player.config.layoutControls.playButtonShowing) {
      toggleClass(player.controls.container, 'initial_controls_show', true);
      toggleClass(title.el, 'initial_controls_show', true);
      toggleClass(logo.el, 'initial_controls_show', true);

      this.hideInitPlayButton();
    }

    player.wrapper.appendChild(container);
  };

  hideInitPlayButton = () => {
    if (this.player.mobile) {
      return;
    }

    this.initialPlay.style.opacity = '0';
    this.initialPlay.style.cursor = 'default';
  };

  toggleInitPlayButton = () => {
    const { player } = this;
    const { initialPlay, playButton } = this;

    if (
      (player.isCurrentlyPlayingAd && !player.mobile) ||
            !player.config.layoutControls.playPauseAnimation ||
            player.isSwitchingSource
    ) {
      this.hideInitPlayButton();
      player.isSwitchingSource = false;
      return;
    }

    let paused = player.paused;

    if (player.mobile) {
      if (hasClass(player.wrapper, 'fluid_show_controls') && !paused) {
        player.controlBar.toggleMobile();
      }

      paused = !paused;

      if (player.isCurrentlyPlayingAd && player.ended) {
        paused = !paused;
      }
    }

    toggleClass(playButton, 'fluid_initial_play_button', !paused);
    toggleClass(playButton, 'fluid_initial_pause_button', paused);

    if (player.ended) {
      return;
    }

    toggleClass(initialPlay, 'transform-active', false);
    setTimeout(() => {
      toggleClass(initialPlay, 'transform-active', true);
    }, 50);

    clearTimeout(this.playButtonTimer);
    this.playButtonTimer = setTimeout(() => {
      toggleClass(initialPlay, 'transform-active', false);
      this.hideInitPlayButton();
    }, 500);
  };

  toggleControls = () => {
    this.toggleInitPlayButton();

    const { player } = this;
    const { controls, title, logo, contextMenu } = player;

    const playPauseButton = controls.playPause;
    const controlsDisplay = controls.container;

    const paused = !player.paused;

    toggleClass(playPauseButton, 'fluid_button_play', !paused);
    toggleClass(playPauseButton, 'fluid_button_pause', paused);

    toggleClass(controlsDisplay, 'initial_controls_show', !paused);

    toggleClass(title.el, 'initial_controls_show', !paused);
    toggleClass(logo.el, 'initial_controls_show', !paused);

    contextMenu.play.textContent = player.config.captions[paused ? 'pause' : 'play'];
  };

  toggle = () => {
    const { player } = this;
    const isFirstStart = !player.firstPlayLaunched;
    const preRolls = player.findRoll('preRoll');

    if (!player.ready) {
      return;
    }

    if (!player.allowPlayStream) {
      if (isHLS(player.currentSource.src)) {
        player.playStream = true;
        return;
      }
    }

    if (isFirstStart) {
      player.firstPlayLaunched = true;

      toggleClass(this.initialPlay, 'fluid_initial_play_color', false);

      if (preRolls.length === 0) {
        player.config.vastOptions.vastAdvanced.noVastVideoCallback();
      } else {
        player.isCurrentlyPlayingAd = true;

        // trigger the loading of the VAST Tag
        player.prepareVast('preRoll');
        player.preRollAdPodsLength = preRolls.length;
      }

      // Remove the div that was placed as a fix for poster image and DASH streaming, if it exists
      const poster = player.controls.poster;
      if (poster) {
        poster.parentNode.removeChild(poster);
      }
    }

    if (!isFirstStart || !player.isCurrentlyPlayingAd) {
      const ads =
                player.isCurrentlyPlayingAd && !is.nullOrUndefined(player.vastOptions) && player.vastOptions.vpaid;

      if (player.paused) {
        if (ads) {
          // resume the vpaid linear ad
          player.resumeVpaidAd();
        } else {
          // resume the regular linear vast or content video player
          if (player.streaming.dash && is.function(player.streaming.dash.play)) {
            player.streaming.dash.play();
          } else {
            if (player.streaming.hls && !player.streaming.hls.userConfig.autoStartLoad) {
              player.streaming.hls.startLoad();
            }

            player.play();
          }

          player.HtmlOnPause.toggle(false);
        }
      } else {
        if (ads) {
          // pause the vpaid linear ad
          player.pauseVpaidAd();
        } else {
          // pause the regular linear vast or content video player
          player.pause();
          player.HtmlOnPause.toggle(true);
        }
      }

      player.toggleOnPauseAd();
    }

    player.adTimer();
  };
}
export default PlayPause;
