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

        // Progress container -> Progress wrapper -> Hover progress
        controls.hoverProgress = self.createElement({
            tag: 'div',
            className: 'fluid_controls_hover_progress',
            parent: controls.progressWrapper,
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
            style: {
                backgroundColor: options.primaryColor
            }
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
