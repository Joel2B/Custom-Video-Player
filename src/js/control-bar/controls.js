import { IS_IOS } from '../utils/browser';
import { createElement, createElementNS, insertAfter, toggleClass } from '../utils/dom';

class Controls {
    constructor(player) {
        this.player = player;

        this.init();
    }

    setup = () => {
        insertAfter(this.loader, this.player.media);

        if (!this.player.mobile) {
            insertAfter(this.container, this.player.media);
        }
    }

    init = () => {
        const layout = this.player.config.layoutControls;
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

        // Container of the controls
        this.container = createElement('div', {
            class: 'fluid_controls_container',
        });

        // Progress container
        this.progressContainer = createElement('div', {
            class: 'fluid_controls_progress_container fluid_slider',
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

        // Ad progress
        this.adProgress = createElement('div', {
            class: 'fluid_controls_ad_progress',
        });
        this.progressContainer.appendChild(this.adProgress);

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
        this.playPause = createElement('div', {
            class: 'fluid_button fluid_button_play fluid_control_playpause',
        });
        this.leftContainer.appendChild(this.playPause);

        if (controlForwardRewind) {
            // Skip backwards
            this.skipBack = createElement('div', {
                class: 'fluid_button fluid_button_skip_back',
            });
            this.leftContainer.appendChild(this.skipBack);

            // Skip forward
            this.skipForward = createElement('div', {
                class: 'fluid_button fluid_button_skip_forward',
            });
            this.leftContainer.appendChild(this.skipForward);
        }

        // Mute
        this.mute = createElement('div', {
            class: 'fluid_button fluid_button_volume fluid_control_mute',
        });
        this.leftContainer.appendChild(this.mute);

        toggleClass(this.container, 'no_volume_bar', IS_IOS);

        // Volume container
        this.volumeContainer = createElement('div', {
            class: 'fluid_control_volume_container fluid_slider',
        });

        // Volume
        this.volume = createElement('div', {
            class: 'fluid_control_volume',
        });
        this.volumeContainer.appendChild(this.volume);

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
        });

        this.currentTime = createElement('span', null, '00:00');
        this.separator = createElement('span', null, ' / ');
        this.duration = createElement('span', null, '00:00');

        timeDisplay.appendChild(this.currentTime);
        timeDisplay.appendChild(this.separator);
        timeDisplay.appendChild(this.duration);

        this.leftContainer.appendChild(timeDisplay);

        // Live badge
        this.live = createElement('div', {
            class: 'fluid_live_badge',
        }, 'live');
        this.leftContainer.appendChild(this.live);

        // Right container
        this.rightContainer = createElement('div', {
            class: 'fluid_controls_right',
        });
        controls.appendChild(this.rightContainer);

        // Download
        this.download = createElement('div', {
            class: 'fluid_button fluid_button_download',
        });
        this.rightContainer.appendChild(this.download);

        // Theatre
        this.theatre = createElement('div', {
            class: 'fluid_button fluid_control_theatre fluid_button_theatre',
        });
        this.rightContainer.appendChild(this.theatre);

        // Fullscreen
        this.fullscreen = createElement('div', {
            class: 'fluid_button fluid_control_fullscreen fluid_button_fullscreen',
        });
        this.rightContainer.appendChild(this.fullscreen);
    };
}

export default Controls;
