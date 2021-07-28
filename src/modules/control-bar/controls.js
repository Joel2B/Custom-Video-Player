'use strict';

export default function (self, options) {
    self.generateCustomControlTags = (options) => {
        const controls = {};

        // Loader
        controls.loader = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_vast_video_loading',
            className: 'vast_video_loading',
        });

        self.createElementNS({
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
        controls.root = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_controls_container',
            className: 'fluid_controls_container',
        });

        if (!options.displayVolumeBar) {
            controls.root.className = controls.root.className + ' no_volume_bar';
        }

        if (options.controlForwardBackward) {
            controls.root.className = controls.root.className + ' skip_controls';
        }

        // Left container
        controls.leftContainer = self.createElement({
            tag: 'div',
            className: 'fluid_controls_left',
            parent: controls.root
        });

        // Left container -> Play/Pause
        controls.playPause = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_playpause',
            className: 'fluid_button fluid_button_play fluid_control_playpause',
            parent: controls.leftContainer
        });

        if (options.controlForwardBackward) {
            // Left container -> Skip backwards
            controls.skipBack = self.createElement({
                tag: 'div',
                id: self.videoPlayerId + '_fluid_control_skip_back',
                className: 'fluid_button fluid_button_skip_back',
                parent: controls.leftContainer
            });

            // Left container -> Skip forward
            controls.skipForward = self.createElement({
                tag: 'div',
                id: self.videoPlayerId + '_fluid_control_skip_forward',
                className: 'fluid_button fluid_button_skip_forward',
                parent: controls.leftContainer
            });
        }

        // Progress container
        controls.progressContainer = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_controls_progress_container',
            className: 'fluid_controls_progress_container fluid_slider',
            parent: controls.root
        });

        // Progress container -> Progress wrapper
        controls.progressWrapper = self.createElement({
            tag: 'div',
            className: 'fluid_controls_progress',
            parent: controls.progressContainer
        });

        // Progress container -> Progress wrapper -> Current progress
        controls.progressCurrent = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_vast_control_currentprogress',
            className: 'fluid_controls_currentprogress',
            parent: controls.progressWrapper,
            style: {
                backgroundColor: options.primaryColor
            }
        });

        // Progress container -> Progress wrapper -> Current progress -> Marker container
        controls.progressMarkerContainer = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_marker_container',
            className: 'fluid_controls_marker_container',
            parent: controls.progressContainer,
        });

        // Progress container -> Progress wrapper -> Current progress -> Marker container -> Marker
        controls.progressCurrentMarker = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_vast_control_currentpos',
            className: 'fluid_controls_currentpos',
            parent: controls.progressMarkerContainer,
        });

        // Progress container -> Buffered indicator
        controls.bufferedIndicator = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_buffered_amount',
            className: 'fluid_controls_buffered',
            parent: controls.progressContainer,
        });

        // Progress container -> Ad markers
        controls.adMarkers = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_ad_markers_holder',
            className: 'fluid_controls_ad_markers_holder',
            parent: controls.progressContainer,
        });

        // Right container
        controls.rightContainer = self.createElement({
            tag: 'div',
            className: 'fluid_controls_right',
            parent: controls.root,
        });

        // Right container -> Fullscreen
        controls.fullscreen = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_fullscreen',
            className: 'fluid_button fluid_control_fullscreen fluid_button_fullscreen',
            parent: controls.rightContainer,
        });

        // Right container -> Theatre
        controls.theatre = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_theatre',
            className: 'fluid_button fluid_control_theatre fluid_button_theatre',
            parent: controls.rightContainer,
        });

        // Right container -> Cardboard
        controls.cardboard = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_cardboard',
            className: 'fluid_button fluid_control_cardboard fluid_button_cardboard',
            parent: controls.rightContainer,
        });

        // Right container -> Subtitles
        controls.subtitles = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_subtitles',
            className: 'fluid_button fluid_button_subtitles',
            parent: controls.rightContainer,
        });

        // Right container -> Video source
        controls.videoSource = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_video_source',
            className: 'fluid_button fluid_button_video_source',
            parent: controls.rightContainer,
        });

        // Right container -> Menu
        controls.optionsMenu = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_cvp_options_menu',
            className: 'cvp_options_menu',
        });

        const modules = {
            switches: [
                {
                    name: 'hotspots',
                    enabled: self.getLocalStorage('hotspots'),
                    domRef: 'hotspots',
                    show: self.isEnabledModule('hotspots')
                },
                {
                    name: 'autoplay',
                    enabled: self.getLocalStorage('autoPlay'),
                    domRef: 'autoPlay',
                    show: self.isEnabledModule('autoPlay')
                }
            ],
            selectors: [
                {
                    name: 'speed',
                    defaultValue: (
                        !self.displayOptions.layoutControls.persistentSettings.speed
                        || self.getLocalStorage('playbackRate') == 1
                        || self.getLocalStorage('playbackRate') === false
                    ) ? 'Normal' : self.getLocalStorage('playbackRate'),
                    domRef: 'speedsPage',
                    show: self.isEnabledModule('playbackRate')
                },
                {
                    name: 'quality',
                    defaultValue: 'Auto',
                    domRef: 'levelsPage',
                    show: self.isEnabledModule('qualityLevels')
                }
            ]
        };

        // Right container -> Menu -> background -> swtiches
        const menu_options = [];
        for (const module of modules.switches) {
            if (!module.show) {
                continue;
            }
            self.menu.height += self.menu.option.height;
            self.menu.enabledModules++;
            const option = {
                tag: 'div',
                className: `cvp_switch cvp_${module.name} ${module.enabled ? 'cvp_enabled' : ''}`,
                textContent: module.name.charAt(0).toUpperCase() + module.name.slice(1),
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
            };
            menu_options.push(option);
        }

        // Right container -> Menu -> background -> selection options && pages
        let options_list = [];
        for (const module of modules.selectors) {
            if (!module.show) {
                continue;
            }
            self.menu.height += self.menu.option.height;
            self.menu.enabledModules++;
            const option = {
                tag: 'div',
                className: `cvp_selector cvp_${module.name}`,
                textContent: module.name.charAt(0).toUpperCase() + module.name.slice(1),
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
            };
            menu_options.push(option);
            options_list.push({
                tag: 'ul',
                className: `cvp_options_list cvp_${module.name} hide`,
                domRef: module.domRef,
            });
        }

        if (self.menu.enabledModules != 0) {
            // Right container -> Menu -> background
            controls.menuBackground = self.createElement({
                tag: 'div',
                className: 'cvp_background cvp_animated',
                style: {
                    width: `${self.menu.width}px`,
                    height: `${self.menu.height}px`,
                },
                parent: controls.optionsMenu
            });

            // Right container -> Menu -> background -> main container
            controls.mainPage = self.createElement({
                tag: 'div',
                className: 'cvp_main_page cvp_alternative',
                style: {
                    width: `${self.menu.width}px`,
                    height: `${self.menu.height}px`,
                },
                parent: controls.menuBackground
            });

            // Right container -> Menu -> background -> menu header
            self.createElement({
                tag: 'div',
                className: 'cvp_header',
                parent: controls.mainPage
            });

            // Right container -> Menu -> background -> icon
            self.createElement({
                tag: 'div',
                className: 'cvp_icon',
                parent: controls.mainPage
            });

            // Right container -> Menu -> background -> switch container
            controls.switchContainer = self.createElement({
                tag: 'ul',
                className: 'cvp_switches',
                parent: controls.mainPage,
                childs: menu_options
            });

            // Right container -> Menu -> background -> subpages
            self.createElement({
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

            // Right container -> Main menu button
            self.createElement({
                tag: 'div',
                id: self.videoPlayerId + '_fluid_control_menu_btn',
                className: 'fluid_button fluid_button_main_menu',
                parent: controls.rightContainer
            });
        }

        // Right container -> Playback rate
        controls.playbackRate = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_playback_rate',
            className: 'fluid_button fluid_button_playback_rate',
            parent: controls.rightContainer,
        });

        // Right container -> Download
        controls.download = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_download',
            className: 'fluid_button fluid_button_download',
            parent: controls.rightContainer,
        });

        // Right container -> Volume container
        controls.volumeContainer = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_volume_container',
            className: 'fluid_control_volume_container fluid_slider',
            parent: controls.rightContainer,
        });

        // Right container -> Volume container -> Volume
        controls.volume = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_volume',
            className: 'fluid_control_volume',
            parent: controls.volumeContainer,
        });

        // Right container -> Volume container -> Volume -> Current
        controls.currentVolume = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_currentvolume',
            className: 'fluid_control_currentvolume',
            parent: controls.volume,
        });

        // Right container -> Volume container -> Volume -> Current -> position
        controls.volumeCurrentPos = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_volume_currentpos',
            className: 'fluid_control_volume_currentpos',
            parent: controls.currentVolume,
        });

        // Right container -> Volume container
        controls.mute = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_mute',
            className: 'fluid_button fluid_button_volume fluid_control_mute',
            parent: controls.rightContainer,
        });

        // Right container -> Volume container
        controls.duration = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_control_duration',
            className: 'fluid_control_duration fluid_fluid_control_duration',
            innerText: '00:00 / 00:00',
            parent: controls.rightContainer,
        });

        return controls;
    };
}
