export default function (self, options) {
    self.subtitleFetchParse = (subtitleItem) => {
        self.sendRequest(
            subtitleItem.url,
            false,
            self.displayOptions.vastOptions.vastTimeout,
            function () {
                const convertVttRawData = function (vttRawData) {
                    if (!(
                        (typeof vttRawData.cues !== 'undefined') &&
                        (vttRawData.cues.length)
                    )) {
                        return [];
                    }

                    const result = [];

                    for (let i = 0; i < vttRawData.cues.length; i++) {
                        let tempThumbnailData = vttRawData.cues[i].text.split('#');

                        result.push({
                            startTime: vttRawData.cues[i].startTime,
                            endTime: vttRawData.cues[i].endTime,
                            text: vttRawData.cues[i].text,
                            cue: vttRawData.cues[i]
                        })
                    }

                    return result;
                };

                const xmlHttpReq = this;

                if ((xmlHttpReq.readyState === 4) && (xmlHttpReq.status !== 200)) {
                    //The response returned an error.
                    return;
                }

                if (!((xmlHttpReq.readyState === 4) && (xmlHttpReq.status === 200))) {
                    return;
                }

                const textResponse = xmlHttpReq.responseText;

                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const cues = [];
                const regions = []; // TODO: unused?
                parser.oncue = function (cue) {
                    cues.push(cue);
                };
                parser.onregion = function (region) {
                    regions.push(region);
                };
                parser.parse(textResponse);
                parser.flush();
                self.subtitlesData = cues;

            }
        );
    };

    self.createSubtitlesSwitch = () => {
        const subtitlesOff = 'OFF';
        self.subtitlesData = [];

        if (!self.menu.isEnabled('subtitles')) {
            // No other video subtitles
            document.getElementById(self.videoPlayerId + '_fluid_control_subtitles').style.display = 'none';
            return;
        }

        const tracks = [];
        tracks.push({ 'label': subtitlesOff, 'url': 'na', 'lang': subtitlesOff });

        const tracksList = self.domRef.player.querySelectorAll('track');

        [].forEach.call(tracksList, function (track) {
            if (track.kind === 'metadata' && track.src) {
                tracks.push({ 'label': track.label, 'url': track.src, 'lang': track.srclang });
            }
        });

        self.subtitlesTracks = tracks;
        const subtitlesChangeButton = document.getElementById(self.videoPlayerId + '_fluid_control_subtitles');
        subtitlesChangeButton.style.display = 'inline-block';
        let appendSubtitleChange = false;

        const subtitlesChangeList = document.createElement('div');
        subtitlesChangeList.id = self.videoPlayerId + '_fluid_control_subtitles_list';
        subtitlesChangeList.className = 'fluid_subtitles_list';
        subtitlesChangeList.style.display = 'none';

        let firstSubtitle = true;
        self.subtitlesTracks.forEach(function (subtitle) {

            const subtitleSelected = (firstSubtitle) ? "subtitle_selected" : "";
            firstSubtitle = false;
            const subtitlesChangeDiv = document.createElement('div');
            subtitlesChangeDiv.id = 'subtitle_' + self.videoPlayerId + '_' + subtitle.label;
            subtitlesChangeDiv.className = 'fluid_subtitle_list_item';
            subtitlesChangeDiv.innerHTML = '<span class="subtitle_button_icon ' + subtitleSelected + '"></span>' + subtitle.label;

            subtitlesChangeDiv.addEventListener('click', function (event) {
                event.stopPropagation();
                const subtitleChangedTo = this;
                const subtitleIcons = document.getElementsByClassName('subtitle_button_icon');

                for (let i = 0; i < subtitleIcons.length; i++) {
                    subtitleIcons[i].className = subtitleIcons[i].className.replace("subtitle_selected", "");
                }

                subtitleChangedTo.firstChild.className += ' subtitle_selected';

                self.subtitlesTracks.forEach(function (subtitle) {
                    if (subtitle.label === subtitleChangedTo.innerText.replace(/(\r\n\t|\n|\r\t)/gm, "")) {
                        if (subtitle.label === subtitlesOff) {
                            self.subtitlesData = [];
                        } else {
                            self.subtitleFetchParse(subtitle);
                        }
                    }
                });
                self.openCloseSubtitlesSwitch();

            });

            subtitlesChangeList.appendChild(subtitlesChangeDiv);
            appendSubtitleChange = true;

        });

        if (appendSubtitleChange) {
            subtitlesChangeButton.appendChild(subtitlesChangeList);
            subtitlesChangeButton.addEventListener('click', function () {
                self.openCloseSubtitlesSwitch();
            });
        } else {
            // Didn't give any subtitle options
            document.getElementById(self.videoPlayerId + '_fluid_control_subtitles').style.display = 'none';
        }

        //attach subtitles to show based on time
        //this function is for rendering of subtitles when content is playing
        const videoPlayerSubtitlesUpdate = function () {
            self.renderSubtitles();
        };

        self.domRef.player.addEventListener('timeupdate', videoPlayerSubtitlesUpdate);
    };

    self.renderSubtitles = () => {
        const videoPlayer = self.domRef.player;

        //if content is playing then no subtitles
        let currentTime = Math.floor(videoPlayer.currentTime);
        let subtitlesAvailable = false;
        let subtitlesContainer = document.getElementById(self.videoPlayerId + '_fluid_subtitles_container');

        if (self.isCurrentlyPlayingAd) {
            subtitlesContainer.innerHTML = '';
            return;
        }

        for (let i = 0; i < self.subtitlesData.length; i++) {
            if (currentTime >= (self.subtitlesData[i].startTime) && currentTime <= (self.subtitlesData[i].endTime)) {
                subtitlesContainer.innerHTML = '';
                subtitlesContainer.appendChild(WebVTT.convertCueToDOMTree(window, self.subtitlesData[i].text));
                subtitlesAvailable = true;
            }
        }

        if (!subtitlesAvailable) {
            subtitlesContainer.innerHTML = '';
        }
    };

    self.openCloseSubtitlesSwitch = () => {
        const subtitleChangeList = document.getElementById(self.videoPlayerId + '_fluid_control_subtitles_list');

        if (self.isCurrentlyPlayingAd) {
            subtitleChangeList.style.display = 'none';
            return;
        }

        if (subtitleChangeList.style.display === 'none') {
            subtitleChangeList.style.display = 'block';
            const mouseOut = function (event) {
                subtitleChangeList.removeEventListener('mouseleave', mouseOut);
                subtitleChangeList.style.display = 'none';
            };
            subtitleChangeList.addEventListener('mouseleave', mouseOut);
        } else {
            subtitleChangeList.style.display = 'none';
        }
    };

    self.createSubtitles = () => {
        const divSubtitlesContainer = document.createElement('div');
        divSubtitlesContainer.id = self.videoPlayerId + '_fluid_subtitles_container';
        divSubtitlesContainer.className = 'fluid_subtitles_container';
        self.domRef.player.parentNode.insertBefore(divSubtitlesContainer, self.domRef.player.nextSibling);

        if (!self.menu.isEnabled('subtitles')) {
            return;
        }

        import(/* webpackChunkName: "vttjs" */ 'videojs-vtt.js').then((it) => {
            window.WebVTT = it.WebVTT;
            self.createSubtitlesSwitch();
        });
    };
}
