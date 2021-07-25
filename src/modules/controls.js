'use strict';

export default function (playerInstance, options) {
    playerInstance.generateCustomControlTags = (options) => {
        const controls = {};

        // Loader
        controls.loader = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_vast_video_loading',
            className: 'vast_video_loading',
        });

        playerInstance.createElementNS({
            name: 'svg',
            attr: {
                viewBox: '25 25 50 50',
                class: 'circular'
            },
            childs: [
                {
                    name: 'circle',
                    attr: {
                        cx: 50,
                        cy: 50,
                        r: 20,
                        fill: 'none',
                        'stroke-width': 2,
                        'stroke-miterlimit': 10,
                        class: 'path'
                    }
                }
            ],
            parent: controls.loader
        });

        // Root element
        controls.root = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_controls_container',
            className: 'fluid_controls_container',
        });

        if (!options.displayVolumeBar) {
            controls.root.className = controls.root.className + ' no_volume_bar';
        }

        if (options.controlForwardBackward) {
            controls.root.className = controls.root.className + ' skip_controls';
        }

        // Left container
        controls.leftContainer = playerInstance.createElement({
            tag: 'div',
            className: 'fluid_controls_left',
            parent: controls.root
        });

        // Left container -> Play/Pause
        controls.playPause = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_playpause',
            className: 'fluid_button fluid_button_play fluid_control_playpause',
            parent: controls.leftContainer
        });

        if (options.controlForwardBackward) {
            // Left container -> Skip backwards
            controls.skipBack = playerInstance.createElement({
                tag: 'div',
                id: playerInstance.videoPlayerId + '_fluid_control_skip_back',
                className: 'fluid_button fluid_button_skip_back',
                parent: controls.leftContainer
            });

            // Left container -> Skip forward
            controls.skipForward = playerInstance.createElement({
                tag: 'div',
                id: playerInstance.videoPlayerId + '_fluid_control_skip_forward',
                className: 'fluid_button fluid_button_skip_forward',
                parent: controls.leftContainer
            });
        }

        // Progress container
        controls.progressContainer = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_controls_progress_container',
            className: 'fluid_controls_progress_container fluid_slider',
            parent: controls.root
        });

        // Progress container -> Progress wrapper
        controls.progressWrapper = playerInstance.createElement({
            tag: 'div',
            className: 'fluid_controls_progress',
            parent: controls.progressContainer
        });

        // Progress container -> Progress wrapper -> Current progress
        controls.progressCurrent = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_vast_control_currentprogress',
            className: 'fluid_controls_currentprogress',
            parent: controls.progressWrapper,
            style: {
                backgroundColor: options.primaryColor
            }
        });

        // Progress container -> Progress wrapper -> Current progress -> Marker container
        controls.progressMarkerContainer = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_marker_container',
            className: 'fluid_controls_marker_container',
            parent: controls.progressContainer,
        });

        // Progress container -> Progress wrapper -> Current progress -> Marker container -> Marker
        controls.progressCurrentMarker = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_vast_control_currentpos',
            className: 'fluid_controls_currentpos',
            parent: controls.progressMarkerContainer,
        });

        // Progress container -> Buffered indicator
        controls.bufferedIndicator = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_buffered_amount',
            className: 'fluid_controls_buffered',
            parent: controls.progressContainer,
        });

        // Progress container -> Ad markers
        controls.adMarkers = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_ad_markers_holder',
            className: 'fluid_controls_ad_markers_holder',
            parent: controls.progressContainer,
        });

        // Right container
        controls.rightContainer = playerInstance.createElement({
            tag: 'div',
            className: 'fluid_controls_right',
            parent: controls.root,
        });

        // Right container -> Fullscreen
        controls.fullscreen = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_fullscreen',
            className: 'fluid_button fluid_control_fullscreen fluid_button_fullscreen',
            parent: controls.rightContainer,
        });

        // Right container -> Theatre
        controls.theatre = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_theatre',
            className: 'fluid_button fluid_control_theatre fluid_button_theatre',
            parent: controls.rightContainer,
        });

        // Right container -> Cardboard
        controls.cardboard = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_cardboard',
            className: 'fluid_button fluid_control_cardboard fluid_button_cardboard',
            parent: controls.rightContainer,
        });

        // Right container -> Subtitles
        controls.subtitles = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_subtitles',
            className: 'fluid_button fluid_button_subtitles',
            parent: controls.rightContainer,
        });

        // Right container -> Video source
        controls.videoSource = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_video_source',
            className: 'fluid_button fluid_button_video_source',
            parent: controls.rightContainer,
        });

        // Right container -> Main menu button
        playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_menu_btn',
            className: 'fluid_button fluid_button_main_menu',
            parent: controls.rightContainer
        });

        // Right container -> Menu
        controls.optionsMenu = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_cvp_options_menu',
            className: 'cvp_options_menu',
        });

        // Right container -> Menu -> background
        controls.menuBackground = playerInstance.createElement({
            tag: 'div',
            className: 'cvp_background cvp_animated',
            style: {
                width: `${playerInstance.widthOptionsMenu}px`,
                height: `${playerInstance.hightOptionsMenu}px`,
            },
            parent: controls.optionsMenu
        });

        // Right container -> Menu -> background -> main container
        controls.mainPage = playerInstance.createElement({
            tag: 'div',
            className: 'cvp_main_page cvp_alternative',
            style: {
                width: `${playerInstance.widthOptionsMenu}px`,
                height: `${playerInstance.hightOptionsMenu}px`,
            },
            parent: controls.menuBackground
        });

        // Right container -> Menu -> background -> menu header
        playerInstance.createElement({
            tag: 'div',
            className: 'cvp_header',
            parent: controls.mainPage
        });

        // Right container -> Menu -> background -> icon
        playerInstance.createElement({
            tag: 'div',
            className: 'cvp_icon',
            parent: controls.mainPage
        });

        // Right container -> Menu -> background -> switch container
        controls.switchContainer = playerInstance.createElement({
            tag: 'ul',
            className: 'cvp_switches',
            parent: controls.mainPage
        });

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
                    defaultValue: (playerInstance.getLocalStorage('fluidSpeed') == 1 || playerInstance.getLocalStorage('fluidSpeed') === false) ? 'Normal' : playerInstance.getLocalStorage('fluidSpeed'),
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
            });
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
            });
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
        });

        // Right container -> Playback rate
        controls.playbackRate = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_playback_rate',
            className: 'fluid_button fluid_button_playback_rate',
            parent: controls.rightContainer,
        });

        // Right container -> Download
        controls.download = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_download',
            className: 'fluid_button fluid_button_download',
            parent: controls.rightContainer,
        });

        // Right container -> Volume container
        controls.volumeContainer = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_volume_container',
            className: 'fluid_control_volume_container fluid_slider',
            parent: controls.rightContainer,
        });

        // Right container -> Volume container -> Volume
        controls.volume = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_volume',
            className: 'fluid_control_volume',
            parent: controls.volumeContainer,
        });

        // Right container -> Volume container -> Volume -> Current
        controls.currentVolume = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_currentvolume',
            className: 'fluid_control_currentvolume',
            parent: controls.volume,
        });

        // Right container -> Volume container -> Volume -> Current -> position
        controls.volumeCurrentPos = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_volume_currentpos',
            className: 'fluid_control_volume_currentpos',
            parent: controls.currentVolume,
        });

        // Right container -> Volume container
        controls.mute = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_mute',
            className: 'fluid_button fluid_button_volume fluid_control_mute',
            parent: controls.rightContainer,
        });

        // Right container -> Volume container
        controls.duration = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_control_duration',
            className: 'fluid_control_duration fluid_fluid_control_duration',
            innerText: '00:00 / 00:00',
            parent: controls.rightContainer,
        });

        return controls;
    };
}
