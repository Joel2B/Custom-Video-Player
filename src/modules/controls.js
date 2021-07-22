'use strict';

export default function (playerInstance, options) {
    playerInstance.generateCustomControlTags = (options) => {
        const controls = {};

        // Loader
        controls.loader = document.createElement('div');
        controls.loader.className = 'vast_video_loading';
        controls.loader.id = 'vast_video_loading_' + playerInstance.videoPlayerId;

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

        svg.setAttribute('viewBox', '25 25 50 50');
        svg.setAttribute('class', 'circular');

        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', '20');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('stroke-miterlimit', '10');
        circle.setAttribute('class', 'path');

        svg.appendChild(circle);
        controls.loader.appendChild(svg);

        // Root element
        controls.root = document.createElement('div');
        controls.root.className = 'fluid_controls_container';
        controls.root.id = playerInstance.videoPlayerId + '_fluid_controls_container';

        if (!options.displayVolumeBar) {
            controls.root.className = controls.root.className + ' no_volume_bar';
        }

        if (options.controlForwardBackward) {
            controls.root.className = controls.root.className + ' skip_controls';
        }

        // Left container
        controls.leftContainer = document.createElement('div');
        controls.leftContainer.className = 'fluid_controls_left';
        controls.root.appendChild(controls.leftContainer);

        // Left container -> Play/Pause
        controls.playPause = document.createElement('div');
        controls.playPause.className = 'fluid_button fluid_button_play fluid_control_playpause';
        controls.playPause.id = playerInstance.videoPlayerId + '_fluid_control_playpause';
        controls.leftContainer.appendChild(controls.playPause);

        if (options.controlForwardBackward) {
            // Left container -> Skip backwards
            controls.skipBack = document.createElement('div');
            controls.skipBack.className = 'fluid_button fluid_button_skip_back';
            controls.skipBack.id = playerInstance.videoPlayerId + '_fluid_control_skip_back';
            controls.leftContainer.appendChild(controls.skipBack);

            // Left container -> Skip forward
            controls.skipForward = document.createElement('div');
            controls.skipForward.className = 'fluid_button fluid_button_skip_forward';
            controls.skipForward.id = playerInstance.videoPlayerId + '_fluid_control_skip_forward';
            controls.leftContainer.appendChild(controls.skipForward);
        }

        // Progress container
        controls.progressContainer = document.createElement('div');
        controls.progressContainer.className = 'fluid_controls_progress_container fluid_slider';
        controls.progressContainer.id = playerInstance.videoPlayerId + '_fluid_controls_progress_container';
        controls.root.appendChild(controls.progressContainer);

        // Progress container -> Progress wrapper
        controls.progressWrapper = document.createElement('div');
        controls.progressWrapper.className = 'fluid_controls_progress';
        controls.progressContainer.appendChild(controls.progressWrapper);

        // Progress container -> Progress wrapper -> Current progress
        controls.progressCurrent = document.createElement('div');
        controls.progressCurrent.className = 'fluid_controls_currentprogress';
        controls.progressCurrent.id = playerInstance.videoPlayerId + '_vast_control_currentprogress';
        controls.progressCurrent.style.backgroundColor = options.primaryColor;
        controls.progressWrapper.appendChild(controls.progressCurrent);

        // Progress container -> Progress wrapper -> Current progress -> Marker container
        controls.progress_markerContainer = document.createElement('div');
        controls.progress_markerContainer.className = 'fluid_controls_marker_container';
        controls.progress_markerContainer.id = playerInstance.videoPlayerId + '_marker_container';
        controls.progressContainer.appendChild(controls.progress_markerContainer);

        // Progress container -> Progress wrapper -> Current progress -> Marker container -> Marker
        controls.progress_current_marker = document.createElement('div');
        controls.progress_current_marker.className = 'fluid_controls_currentpos';
        controls.progress_current_marker.id = playerInstance.videoPlayerId + '_vast_control_currentpos';
        controls.progress_markerContainer.appendChild(controls.progress_current_marker);

        // Progress container -> Buffered indicator
        controls.bufferedIndicator = document.createElement('div');
        controls.bufferedIndicator.className = 'fluid_controls_buffered';
        controls.bufferedIndicator.id = playerInstance.videoPlayerId + '_buffered_amount';
        controls.progressContainer.appendChild(controls.bufferedIndicator);

        // Progress container -> Ad markers
        controls.adMarkers = document.createElement('div');
        controls.adMarkers.className = 'fluid_controls_ad_markers_holder';
        controls.adMarkers.id = playerInstance.videoPlayerId + '_ad_markers_holder';
        controls.progressContainer.appendChild(controls.adMarkers);

        // Right container
        controls.rightContainer = document.createElement('div');
        controls.rightContainer.className = 'fluid_controls_right';
        controls.root.appendChild(controls.rightContainer);

        // Right container -> Fullscreen
        controls.fullscreen = document.createElement('div');
        controls.fullscreen.id = playerInstance.videoPlayerId + '_fluid_control_fullscreen';
        controls.fullscreen.className = 'fluid_button fluid_control_fullscreen fluid_button_fullscreen';
        controls.rightContainer.appendChild(controls.fullscreen);

        // Right container -> Theatre
        controls.theatre = document.createElement('div');
        controls.theatre.id = playerInstance.videoPlayerId + '_fluid_control_theatre';
        controls.theatre.className = 'fluid_button fluid_control_theatre fluid_button_theatre';
        controls.rightContainer.appendChild(controls.theatre);

        // Right container -> Cardboard
        controls.cardboard = document.createElement('div');
        controls.cardboard.id = playerInstance.videoPlayerId + '_fluid_control_cardboard';
        controls.cardboard.className = 'fluid_button fluid_control_cardboard fluid_button_cardboard';
        controls.rightContainer.appendChild(controls.cardboard);

        // Right container -> Subtitles
        controls.subtitles = document.createElement('div');
        controls.subtitles.id = playerInstance.videoPlayerId + '_fluid_control_subtitles';
        controls.subtitles.className = 'fluid_button fluid_button_subtitles';
        controls.rightContainer.appendChild(controls.subtitles);

        // Right container -> Video source
        controls.videoSource = document.createElement('div');
        controls.videoSource.id = playerInstance.videoPlayerId + '_fluid_control_video_source';
        controls.videoSource.className = 'fluid_button fluid_button_video_source';
        controls.rightContainer.appendChild(controls.videoSource);

        // Right container -> Main menu button
        controls.menuButton = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_menu_btn',
            className: 'fluid_button fluid_button_main_menu',
            parent: controls.rightContainer
        })

        // Right container -> Menu
        controls.optionsMenu = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_cvp_options_menu',
            className: 'cvp_options_menu',
            parent: controls.root,
            domRef: 'optionsMenu'
        })

        // Right container -> Menu -> background
        controls.menuBackground = playerInstance.createElement({
            tag: 'div',
            className: 'cvp_background cvp_animated',
            style: {
                width: `${playerInstance.widthOptionsMenu}px`,
                height: `${playerInstance.hightOptionsMenu}px`,
            },
            parent: controls.optionsMenu
        })

        // Right container -> Menu -> background -> main container
        controls.mainPage = playerInstance.createElement({
            tag: 'div',
            className: 'cvp_main_page cvp_alternative',
            style: {
                width: `${playerInstance.widthOptionsMenu}px`,
                height: `${playerInstance.hightOptionsMenu}px`,
            },
            parent: controls.menuBackground
        })

        // Right container -> Menu -> background -> menu header
        playerInstance.createElement({
            tag: 'div',
            className: 'cvp_header',
            parent: controls.mainPage
        })

        // Right container -> Menu -> background -> icon
        playerInstance.createElement({
            tag: 'div',
            className: 'cvp_icon',
            parent: controls.mainPage
        })

        // Right container -> Menu -> background -> switch container
        controls.switchContainer = playerInstance.createElement({
            tag: 'ul',
            className: 'cvp_switches',
            parent: controls.mainPage
        })

        playerInstance.modules = {
            switches: [
                {
                    name: 'hotspots',
                    enabled: playerInstance.getLocalStorage('hotspots'),
                    domRef: 'hotspots',
                    show: false
                },
                {
                    name: 'autoplay',
                    enabled: playerInstance.getLocalStorage('autoPlay'),
                    domRef: 'autoPlay',
                    show: true
                }
            ],
            selectors: [
                {
                    name: 'speed',
                    defaultValue: (playerInstance.getLocalStorage('fluidSpeed') == 1) ? 'Normal' : playerInstance.getLocalStorage('fluidSpeed'),
                    domRef: 'speedsPage',
                    show: true
                },
                {
                    name: 'quality',
                    defaultValue: 'Auto',
                    domRef: 'levelsPage',
                    show: true
                }
            ]
        }

        // Right container -> Menu -> background -> swtiches
        for (const module of playerInstance.modules.switches) {
            if (!module.show) {
                continue;
            }
            playerInstance.createElement({
                tag: 'div',
                className: `cvp_switch cvp_${module.name} ${module.enabled ? 'cvp_enabled' : ''}`,
                textContent: module.name.charAt(0).toUpperCase() + module.name.slice(1),
                parent: controls.switchContainer,
                domRef: module.domRef,
                childs: [
                    {
                        tag: 'i',
                        className: `cvp_icon cvp_icon_menu_${module.name}`
                    },
                    {
                        tag: 'span',
                        textContent: 'Off ',
                        childs: [
                            {
                                tag: 'div',
                                textContent: 'On'
                            }
                        ]
                    },
                    {
                        tag: 'div',
                        className: 'cvp_icon ' + ((module.name == 'hotspots') ? 'cvp_icon_info' : '')
                    },
                ]
            })
        }

        // Right container -> Menu -> background -> selection options && pages
        let options_list = [];
        for (const module of playerInstance.modules.selectors) {
            if (!module.show) {
                continue;
            }
            playerInstance.createElement({
                tag: 'div',
                className: `cvp_selector cvp_${module.name}`,
                textContent: module.name.charAt(0).toUpperCase() + module.name.slice(1),
                parent: controls.switchContainer,
                domRef: `${module.name}Selector`,
                childs: [
                    {
                        tag: 'i',
                        className: `cvp_icon cvp_icon_menu_${module.name}`
                    },
                    {
                        tag: 'div',
                        className: 'cvp_value',
                        textContent: module.defaultValue
                    },
                ]
            });

            options_list.push({
                tag: 'ul',
                className: `cvp_options_list cvp_${module.name} hide`,
                domRef: module.domRef,
            })
        }

        // Right container -> Menu -> background -> subpages
        playerInstance.createElement({
            tag: 'div',
            className: 'cvp_sub_page',
            parent: controls.menuBackground,
            childs: [
                {
                    tag: 'div',
                    className: 'cvp_header',
                    domRef: 'menuHeader'
                },
                {
                    tag: 'div',
                    className: 'cvp_content',
                    childs: options_list
                }
            ]
        })

        // Right container -> Playback rate
        controls.playbackRate = document.createElement('div');
        controls.playbackRate.id = playerInstance.videoPlayerId + '_fluid_control_playback_rate';
        controls.playbackRate.className = 'fluid_button fluid_button_playback_rate';
        controls.rightContainer.appendChild(controls.playbackRate);

        // Right container -> Download
        controls.download = document.createElement('div');
        controls.download.id = playerInstance.videoPlayerId + '_fluid_control_download';
        controls.download.className = 'fluid_button fluid_button_download';
        controls.rightContainer.appendChild(controls.download);

        // Right container -> Volume container
        controls.volumeContainer = document.createElement('div');
        controls.volumeContainer.id = playerInstance.videoPlayerId + '_fluid_control_volume_container';
        controls.volumeContainer.className = 'fluid_control_volume_container fluid_slider';
        controls.rightContainer.appendChild(controls.volumeContainer);

        // Right container -> Volume container -> Volume
        controls.volume = document.createElement('div');
        controls.volume.id = playerInstance.videoPlayerId + '_fluid_control_volume';
        controls.volume.className = 'fluid_control_volume';
        controls.volumeContainer.appendChild(controls.volume);

        // Right container -> Volume container -> Volume -> Current
        controls.volumeCurrent = document.createElement('div');
        controls.volumeCurrent.id = playerInstance.videoPlayerId + '_fluid_control_currentvolume';
        controls.volumeCurrent.className = 'fluid_control_currentvolume';
        controls.volume.appendChild(controls.volumeCurrent);

        // Right container -> Volume container -> Volume -> Current -> position
        controls.volumeCurrentPos = document.createElement('div');
        controls.volumeCurrentPos.id = playerInstance.videoPlayerId + '_fluid_control_volume_currentpos';
        controls.volumeCurrentPos.className = 'fluid_control_volume_currentpos';
        controls.volumeCurrent.appendChild(controls.volumeCurrentPos);

        // Right container -> Volume container
        controls.mute = document.createElement('div');
        controls.mute.id = playerInstance.videoPlayerId + '_fluid_control_mute';
        controls.mute.className = 'fluid_button fluid_button_volume fluid_control_mute';
        controls.rightContainer.appendChild(controls.mute);

        // Right container -> Volume container
        controls.duration = document.createElement('div');
        controls.duration.id = playerInstance.videoPlayerId + '_fluid_control_duration';
        controls.duration.className = 'fluid_control_duration fluid_fluid_control_duration';
        controls.duration.innerText = '00:00 / 00:00';
        controls.rightContainer.appendChild(controls.duration);

        return controls;
    };
}
