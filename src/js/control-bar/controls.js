import { IS_IOS } from '../utils/browser';
import { createElement, createElementNS, toggleClass } from '../utils/dom';

class Controls {
    constructor(player) {
        this.player = player;
        this.create();
    }

    create = () => {
        const layout = this.player.config.layoutControls;
        const primaryColor = layout.primaryColor || '#f00';
        const controlForwardBackward = layout.controlForwardBackward.show;
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

        // controls
        this.container = createElement('div', {
            class: 'fluid_controls_container',
        });

        // Left container
        this.leftContainer = createElement('div', {
            class: 'fluid_controls_left',
        });

        // Left container -> Play/Pause
        this.playPause = createElement('div', {
            class: 'fluid_button fluid_button_play fluid_control_playpause',
        });
        this.leftContainer.appendChild(this.playPause);

        if (controlForwardBackward) {
            this.container.className += ' skip_controls';
            // Left container -> Skip backwards
            this.skipBack = createElement('div', {
                class: 'fluid_button fluid_button_skip_back',
            });
            this.leftContainer.appendChild(this.skipBack);

            // Left container -> Skip forward
            this.skipForward = createElement('div', {
                class: 'fluid_button fluid_button_skip_forward',
            });
            this.leftContainer.appendChild(this.skipForward);
        }
        this.container.appendChild(this.leftContainer);

        // Progress container
        this.progressContainer = createElement('div', {
            class: 'fluid_controls_progress_container fluid_slider',
        });
        this.container.appendChild(this.progressContainer);

        // Progress container -> Progress
        this.progress = createElement('div', {
            class: 'fluid_controls_progress',
        });

        // Progress container -> Progress -> Play progress
        this.playProgress = createElement('div', {
            class: 'fluid_controls_play_progress',
            style: `background-color: ${primaryColor}`,
        });

        this.progress.appendChild(this.playProgress);

        // Progress container -> Progress -> Hover progress
        this.hoverProgress = createElement('div', {
            class: 'fluid_controls_hover_progress',
        });
        this.progress.appendChild(this.hoverProgress);
        this.progressContainer.appendChild(this.progress);

        // Progress container -> Scrubber container
        this.scrubberProgressContainer = createElement('div', {
            class: 'fluid_controls_scrubber_progress_container',
        });

        // Progress container -> Scrubber container -> Scrubber
        this.scrubberProgress = createElement('div', {
            class: 'fluid_controls_scrubber_progress',
            style: `background-color: ${primaryColor}`,
        });
        this.scrubberProgressContainer.appendChild(this.scrubberProgress);
        this.progressContainer.appendChild(this.scrubberProgressContainer);

        // Progress container -> Load progress
        this.loadProgress = createElement('div', {
            class: 'fluid_controls_load_progress',
        });
        this.progressContainer.appendChild(this.loadProgress);

        // Progress container -> Ad progress
        this.adProgress = createElement('div', {
            class: 'fluid_controls_ad_progress',
        });
        this.progressContainer.appendChild(this.adProgress);

        // Right container
        this.rightContainer = createElement('div', {
            class: 'fluid_controls_right',
        });
        this.container.appendChild(this.rightContainer);

        // Right container -> Fullscreen
        this.fullscreen = createElement('div', {
            class: 'fluid_button fluid_control_fullscreen fluid_button_fullscreen',
        });
        this.rightContainer.appendChild(this.fullscreen);

        // Right container -> Theatre
        this.theatre = createElement('div', {
            class: 'fluid_button fluid_control_theatre fluid_button_theatre',
        });
        this.rightContainer.appendChild(this.theatre);

        // Right container -> Subtitles
        this.subtitles = createElement('div', {
            class: 'fluid_button fluid_button_subtitles',
        });
        this.rightContainer.appendChild(this.subtitles);

        toggleClass(this.container, 'no_volume_bar', IS_IOS);

        // Right container -> Volume container
        this.volumeContainer = createElement('div', {
            class: 'fluid_control_volume_container fluid_slider',
        });

        // Right container -> Volume container -> Volume
        this.volume = createElement('div', {
            class: 'fluid_control_volume',
        });
        this.volumeContainer.appendChild(this.volume);

        // Right container -> Volume container -> Volume -> Scrubber container
        this.scrubberVolumeContainer = createElement('div', {
            class: 'fluid_control_scrubber_volume_container',
        });
        this.volume.appendChild(this.scrubberVolumeContainer);

        // Right container -> Volume container -> Volume -> Scrubber container -> Scrubber
        this.scrubberVolume = createElement('div', {
            class: 'fluid_control_scrubber_volume',
        });
        this.scrubberVolumeContainer.appendChild(this.scrubberVolume);
        this.rightContainer.appendChild(this.volumeContainer);

        // Right container -> mute
        this.mute = createElement('div', {
            class: 'fluid_button fluid_button_volume fluid_control_mute',
        });
        this.rightContainer.appendChild(this.mute);

        // Right container -> time display
        const timeDisplay = createElement('div', {
            class: 'fluid_control_duration fluid_fluid_control_time_display',
        });

        this.currentTime = createElement('span', null, '00:00');
        this.separator = createElement('span', null, ' / ');
        this.duration = createElement('span', null, '00:00');

        timeDisplay.appendChild(this.currentTime);
        timeDisplay.appendChild(this.separator);
        timeDisplay.appendChild(this.duration);

        this.rightContainer.appendChild(timeDisplay);
    };
}

export default Controls;
