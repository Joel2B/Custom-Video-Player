import { IS_IOS } from '../utils/browser';
import { createElement, createElementNS, insertAfter, toggleClass, findPosition } from '../utils/dom';
import computedStyle from '../utils/computed-style';
import { on } from '../utils/events';

class Controls {
  constructor(player) {
    this.player = player;

    this.init();
  }

  setup = () => {
    insertAfter(this.loader, this.player.media);
    insertAfter(this.error, this.loader);

    if (!this.player.mobile) {
      insertAfter(this.container, this.player.media);
    }
  };

  init = () => {
    const layout = this.player.config.layoutControls;
    const captions = this.player.config.captions;
    const primaryColor = layout.primaryColor || '#f00';
    const controlForwardRewind = layout.controlForwardRewind.show;

    // loading animation
    this.loader = createElement('div', {
      class: 'fluid_video_loading',
    });

    const loaderSvg = createElementNS('svg', {
      viewBox: '25 25 50 50',
      class: 'circular',
    });

    loaderSvg.appendChild(
      createElementNS('circle', {
        cx: 50,
        cy: 50,
        r: 20,
        fill: 'none',
        'stroke-width': 2,
        'stroke-miterlimit': 10,
        class: 'path',
      }),
    );
    this.loader.appendChild(loaderSvg);

    this.error = createElement('div', {
      class: 'fluid_video_error',
      role: 'alert',
      'aria-live': 'assertive',
      hidden: '',
    });

    // Container of the controls
    this.container = createElement('div', {
      class: 'fluid_controls_container',
    });

    // Progress container
    this.progressContainer = createElement('div', {
      class: 'fluid_controls_progress_container fluid_slider',
      role: 'slider',
      tabindex: 0,
      'aria-label': captions.seek,
      'aria-valuemin': 0,
      'aria-valuemax': 0,
      'aria-valuenow': 0,
      'aria-valuetext': '00:00',
    });
    this.container.appendChild(this.progressContainer);

    // Progress
    this.progress = createElement('div', {
      class: 'fluid_controls_progress',
    });

    // Play progress
    this.playProgress = createElement('div', {
      class: 'fluid_controls_play_progress',
      style: `background-color: ${primaryColor}`,
    });
    this.progress.appendChild(this.playProgress);

    // Hover progress
    this.hoverProgress = createElement('div', {
      class: 'fluid_controls_hover_progress',
    });
    this.progress.appendChild(this.hoverProgress);
    this.progressContainer.appendChild(this.progress);

    // Scrubber container
    this.scrubberProgressContainer = createElement('div', {
      class: 'fluid_controls_scrubber_progress_container',
    });

    // Scrubber
    this.scrubberProgress = createElement('div', {
      class: 'fluid_controls_scrubber_progress',
      style: `background-color: ${primaryColor}`,
    });
    this.scrubberProgressContainer.appendChild(this.scrubberProgress);
    this.progressContainer.appendChild(this.scrubberProgressContainer);

    // Load progress
    this.loadProgress = createElement('div', {
      class: 'fluid_controls_load_progress',
    });
    this.progressContainer.appendChild(this.loadProgress);

    // Controls
    const controls = createElement('div', {
      class: 'fluid_controls',
    });
    this.container.appendChild(controls);

    // Left container
    this.leftContainer = createElement('div', {
      class: 'fluid_controls_left',
    });
    controls.appendChild(this.leftContainer);

    // Play/Pause
    this.playPause = createElement('button', {
      type: 'button',
      class: 'fluid_button fluid_button_play fluid_control_playpause',
      'aria-label': this.player.config.captions.play,
    });

    this.playPauseTooltip = createElement(
      'div',
      {
        class: 'fluid_button_tooltip',
      },
      this.player.config.captions.play,
    );

    this.playPause.appendChild(this.playPauseTooltip);
    this.leftContainer.appendChild(this.playPause);

    if (controlForwardRewind) {
      // Skip backwards
      this.skipBack = createElement('button', {
        type: 'button',
        class: 'fluid_button fluid_button_skip_back',
        'aria-label': captions.rewindSeconds(layout.controlForwardRewind.rewind),
      });
      this.leftContainer.appendChild(this.skipBack);

      // Skip forward
      this.skipForward = createElement('button', {
        type: 'button',
        class: 'fluid_button fluid_button_skip_forward',
        'aria-label': captions.forwardSeconds(layout.controlForwardRewind.forward),
      });
      this.leftContainer.appendChild(this.skipForward);
    }

    // Mute
    this.mute = createElement('button', {
      type: 'button',
      class: 'fluid_button fluid_button_volume fluid_control_mute',
      'aria-label': this.player.config.captions.mute,
      'aria-pressed': false,
    });
    this.muteTooltip = createElement(
      'div',
      {
        class: 'fluid_button_tooltip',
      },
      this.player.config.captions.mute,
    );
    this.mute.appendChild(this.muteTooltip);
    this.leftContainer.appendChild(this.mute);

    toggleClass(this.container, 'no_volume_bar', IS_IOS);

    // Volume container
    this.volumeContainer = createElement('div', {
      class: 'fluid_control_volume_container fluid_slider',
      role: 'slider',
      tabindex: 0,
      'aria-label': captions.volume,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': 100,
      'aria-valuetext': '100%',
    });

    // Volume
    this.volume = createElement('div', {
      class: 'fluid_control_volume',
    });
    this.volumeContainer.appendChild(this.volume);

    this.volumeTooltip = createElement(
      'div',
      {
        class: 'fluid_volume_tooltip',
      },
      '100',
    );
    this.volumeContainer.appendChild(this.volumeTooltip);

    // Scrubber container
    this.scrubberVolumeContainer = createElement('div', {
      class: 'fluid_control_scrubber_volume_container',
    });
    this.volume.appendChild(this.scrubberVolumeContainer);

    // Scrubber
    this.scrubberVolume = createElement('div', {
      class: 'fluid_control_scrubber_volume',
    });
    this.scrubberVolumeContainer.appendChild(this.scrubberVolume);
    this.leftContainer.appendChild(this.volumeContainer);

    // Time display
    const timeDisplay = createElement('div', {
      class: 'fluid_control_duration fluid_fluid_control_time_display',
      'aria-live': 'off',
    });

    this.currentTime = createElement('span', null, '00:00');
    this.separator = createElement('span', null, ' / ');
    this.duration = createElement('span', null, '00:00');

    timeDisplay.appendChild(this.currentTime);
    timeDisplay.appendChild(this.separator);
    timeDisplay.appendChild(this.duration);

    this.leftContainer.appendChild(timeDisplay);

    // Live badge
    this.live = createElement(
      'div',
      {
        class: 'fluid_live_badge',
      },
      captions.live,
    );
    this.leftContainer.appendChild(this.live);

    // Right container
    this.rightContainer = createElement('div', {
      class: 'fluid_controls_right',
    });
    controls.appendChild(this.rightContainer);

    // Download
    this.download = createElement('button', {
      type: 'button',
      class: 'fluid_button fluid_button_download',
      'aria-label': captions.downloadVideo,
    });
    this.rightContainer.appendChild(this.download);

    // Theatre
    this.theatre = createElement('button', {
      type: 'button',
      class: 'fluid_button fluid_control_theatre fluid_button_theatre',
      'aria-label': this.player.config.captions.theatre,
      'aria-pressed': false,
    });
    this.theatreTooltip = createElement(
      'div',
      {
        class: 'fluid_button_tooltip',
      },
      this.player.config.captions.theatre,
    );
    this.theatre.appendChild(this.theatreTooltip);
    this.rightContainer.appendChild(this.theatre);

    // Fullscreen
    this.fullscreen = createElement('button', {
      type: 'button',
      class: 'fluid_button fluid_control_fullscreen fluid_button_fullscreen',
      'aria-label': this.player.config.captions.fullscreen,
      'aria-pressed': false,
    });
    this.fullscreenTooltip = createElement(
      'div',
      {
        class: 'fluid_button_tooltip',
      },
      this.player.config.captions.fullscreen,
    );
    this.fullscreen.appendChild(this.fullscreenTooltip);
    this.rightContainer.appendChild(this.fullscreen);
    this.setupTooltip(this.fullscreen, this.fullscreenTooltip);
  };

  setupTooltip = (button, tooltip) => {
    if (!button || !tooltip) {
      return;
    }

    const measure = () => {
      const left = findPosition(tooltip, this.player.wrapper).left;
      const width = this.player.wrapper.clientWidth;
      const right = parseInt(computedStyle(this.player.controls.progressContainer, 'right').replace('px', ''));
      const shift = width - (left + tooltip.clientWidth / 2) - right;

      tooltip.style.setProperty('--tooltip-shift', `${shift}px`);
    };

    setTimeout(() => {
      measure();
    });

    on.call(this.player, button, 'mouseenter mousemove', measure);
    on.call(this.player, window, 'resize', measure);
    on.call(this.player, this.player.media, 'enterfullscreen exitfullscreen', measure);
  };
}

export default Controls;
