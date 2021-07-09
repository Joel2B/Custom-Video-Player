'use strict';
export default function (playerInstance, options) {
    playerInstance.setupThumbnailPreviewVtt = () => {
        playerInstance.sendRequest(
            playerInstance.displayOptions.layoutControls.timelinePreview.file,
            true,
            playerInstance.displayOptions.vastOptions.vastTimeout,
            function () {
                const convertVttRawData = function (vttRawData) {
                    if (!(
                        (typeof vttRawData.cues !== 'undefined') &&
                        (vttRawData.cues.length)
                    )) {
                        return [];
                    }

                    const result = [];
                    let tempThumbnailData = null;
                    let tempThumbnailCoordinates = null;

                    for (let i = 0; i < vttRawData.cues.length; i++) {
                        tempThumbnailData = vttRawData.cues[i].text.split('#');
                        let xCoords = 0, yCoords = 0, wCoords = 122.5, hCoords = 69;

                        // .vtt file contains sprite corrdinates
                        if (
                            (tempThumbnailData.length === 2) &&
                            (tempThumbnailData[1].indexOf('xywh=') === 0)
                        ) {
                            tempThumbnailCoordinates = tempThumbnailData[1].substring(5);
                            tempThumbnailCoordinates = tempThumbnailCoordinates.split(',');

                            if (tempThumbnailCoordinates.length === 4) {
                                playerInstance.displayOptions.layoutControls.timelinePreview.spriteImage = true;
                                xCoords = parseInt(tempThumbnailCoordinates[0]);
                                yCoords = parseInt(tempThumbnailCoordinates[1]);
                                wCoords = parseInt(tempThumbnailCoordinates[2]);
                                hCoords = parseInt(tempThumbnailCoordinates[3]);
                            }
                        }

                        let imageUrl;
                        if (playerInstance.displayOptions.layoutControls.timelinePreview.spriteRelativePath
                            && playerInstance.displayOptions.layoutControls.timelinePreview.file.indexOf('/') !== -1
                            && (typeof playerInstance.displayOptions.layoutControls.timelinePreview.sprite === 'undefined' || playerInstance.displayOptions.layoutControls.timelinePreview.sprite === '')
                        ) {
                            imageUrl = playerInstance.displayOptions.layoutControls.timelinePreview.file.substring(0, playerInstance.displayOptions.layoutControls.timelinePreview.file.lastIndexOf('/'));
                            imageUrl += '/' + tempThumbnailData[0];
                        } else {
                            imageUrl = (playerInstance.displayOptions.layoutControls.timelinePreview.sprite ? playerInstance.displayOptions.layoutControls.timelinePreview.sprite : tempThumbnailData[0]);
                        }

                        result.push({
                            startTime: vttRawData.cues[i].startTime,
                            endTime: vttRawData.cues[i].endTime,
                            image: imageUrl,
                            x: xCoords,
                            y: yCoords,
                            w: wCoords,
                            h: hCoords
                        });
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

                const webVttParser = new window.WebVTTParser();
                const vttRawData = webVttParser.parse(textResponse);

                playerInstance.timelinePreviewData = convertVttRawData(vttRawData);
            }
        );
    };

    playerInstance.generateTimelinePreviewTags = () => {
        const controlsContainer = document.getElementById(playerInstance.videoPlayerId + '_fluid_controls_container');

        const previewContainer = document.createElement('div');
        previewContainer.id = playerInstance.videoPlayerId + '_fluid_timeline_preview_container';
        previewContainer.className = 'fluid_timeline_preview_container';
        previewContainer.style.display = 'none';
        previewContainer.style.position = 'absolute';
        controlsContainer.appendChild(previewContainer);

        const tooltipTextContainer = document.createElement('div');
        tooltipTextContainer.id = playerInstance.videoPlayerId + '_fluid_timeline_preview_tooltip_text_container';
        tooltipTextContainer.className = 'fluid_timeline_preview_tooltip_text_container';
        tooltipTextContainer.style.position = 'absolute';
        previewContainer.appendChild(tooltipTextContainer);

        const previewTooltipText = document.createElement('div');
        previewTooltipText.id = playerInstance.videoPlayerId + '_fluid_timeline_preview_tooltip_text';
        previewTooltipText.className = 'fluid_timeline_preview_tooltip_text';
        previewTooltipText.style.position = 'absolute';
        tooltipTextContainer.appendChild(previewTooltipText);

        //Shadow is needed to not trigger mouseleave event, that stops showing thumbnails, in case one scrubs a bit too fast and leaves current thumb before new one drawn.
        const previewContainerShadow = document.createElement('div');
        previewContainerShadow.id = playerInstance.videoPlayerId + '_fluid_timeline_preview_container_shadow';
        previewContainerShadow.className = 'fluid_timeline_preview_container_shadow';
        previewContainerShadow.style.position = 'absolute';
        previewContainerShadow.style.display = 'none';
        previewContainerShadow.style.opacity = 1;
        controlsContainer.appendChild(previewContainerShadow);
    };

    playerInstance.getThumbnailCoordinates = (second) => {
        if (playerInstance.timelinePreviewData.length) {
            for (let i = 0; i < playerInstance.timelinePreviewData.length; i++) {
                if ((second >= playerInstance.timelinePreviewData[i].startTime) && (second <= playerInstance.timelinePreviewData[i].endTime)) {
                    return playerInstance.timelinePreviewData[i];
                }
            }
        }

        return false;
    };

    playerInstance.drawTimelinePreview = (event) => {
        const timelinePreviewTag = document.getElementById(playerInstance.videoPlayerId + '_fluid_timeline_preview_container');
        const tooltipTextContainer = document.getElementById(playerInstance.videoPlayerId + '_fluid_timeline_preview_tooltip_text_container');
        const timelinePreviewTooltipText = document.getElementById(playerInstance.videoPlayerId + '_fluid_timeline_preview_tooltip_text');
        const timelinePreviewShadow = document.getElementById(playerInstance.videoPlayerId + '_fluid_timeline_preview_container_shadow');
        const progressContainer = document.getElementById(playerInstance.videoPlayerId + '_fluid_controls_progress_container');
        const totalWidth = progressContainer.clientWidth;

        if (playerInstance.isCurrentlyPlayingAd) {
            if (timelinePreviewTag.style.display !== 'none') {
                timelinePreviewTag.style.display = 'none';
            }

            return;
        }

        //get the hover position
        const hoverX = playerInstance.getEventOffsetX(event, progressContainer);
        let hoverSecond = null;

        if (totalWidth) {
            hoverSecond = playerInstance.currentVideoDuration * hoverX / totalWidth;

            //get the corresponding thumbnail coordinates
            const thumbnailCoordinates = playerInstance.getThumbnailCoordinates(hoverSecond);
            timelinePreviewShadow.style.width = totalWidth + 'px';
            timelinePreviewShadow.style.display = 'block';

            if (thumbnailCoordinates !== false) {
                const progressContainer = document.getElementById(playerInstance.videoPlayerId + '_fluid_controls_progress_container');
                const totalWidth = progressContainer.clientWidth;
                const hoverQ = playerInstance.getEventOffsetX(event, progressContainer);
                const hoverSecondQ = playerInstance.currentVideoDuration * hoverQ / totalWidth;
                // preview border is set to 2px, a total of 4px on both sides, and they are subtracted from the position of the timeline preview so that it stays within the width of the timeline
                const borderWidthPreview = parseInt(getComputedStyle(timelinePreviewTag).borderWidth.replace('px', '')) * 2;
                // add the top position to the tooltip so it is not along with the preview
                const topTooltipText = 7;
                // get the left position of the timeline
                const timelinePosition = parseInt(getComputedStyle(progressContainer).left.replace('px', ''));
                const currentPreviewPosition = hoverX - (thumbnailCoordinates.w / 2);
                const previewScrollLimitWidth = totalWidth - thumbnailCoordinates.w - borderWidthPreview;
                let previewPosition;
                if (currentPreviewPosition >= 0) {
                    if (currentPreviewPosition <= previewScrollLimitWidth) {
                        previewPosition = currentPreviewPosition + timelinePosition;
                    } else {
                        previewPosition = previewScrollLimitWidth + timelinePosition;
                    }
                } else {
                    previewPosition = timelinePosition;
                }
                
                timelinePreviewTag.style.width = thumbnailCoordinates.w + 'px';
                timelinePreviewTag.style.height = thumbnailCoordinates.h + 'px';
                timelinePreviewShadow.style.height = thumbnailCoordinates.h + 'px';
                timelinePreviewTag.style.background =
                    'url(' + thumbnailCoordinates.image + ') no-repeat scroll -' + thumbnailCoordinates.x + 'px -' + thumbnailCoordinates.y + 'px';
                timelinePreviewTag.style.left = previewPosition + 'px';
                timelinePreviewTag.style.display = 'block';
                tooltipTextContainer.style.top = (thumbnailCoordinates.h + topTooltipText) + 'px';
                timelinePreviewTooltipText.innerText = playerInstance.formatTime(hoverSecondQ);
                if (!playerInstance.displayOptions.layoutControls.timelinePreview.spriteImage) {
                    timelinePreviewTag.style.backgroundSize = 'contain';
                }

            } else {
                timelinePreviewTag.style.display = 'none';
            }
        }
    };

    playerInstance.setupThumbnailPreview = () => {
        let timelinePreview = playerInstance.displayOptions.layoutControls.timelinePreview;
        if (!timelinePreview || !timelinePreview.type) {
            return;
        }

        let eventOn = 'mousemove';
        let eventOff = 'mouseleave';
        if (playerInstance.mobileInfo.userOs) {
            eventOn = 'touchmove';
            eventOff = 'touchend';
        }
        document.getElementById(playerInstance.videoPlayerId + '_fluid_controls_progress_container')
            .addEventListener(eventOn, playerInstance.drawTimelinePreview.bind(playerInstance), false);
        document.getElementById(playerInstance.videoPlayerId + '_fluid_controls_progress_container')
            .addEventListener(eventOff, function (event) {
                const progress = document.getElementById(playerInstance.videoPlayerId + '_fluid_controls_progress_container');
                if (typeof event.clientX !== 'undefined' && progress.contains(document.elementFromPoint(event.clientX, event.clientY))) {
                    //False positive (Chrome bug when fast click causes leave event)
                    return;
                }
                document.getElementById(playerInstance.videoPlayerId + '_fluid_timeline_preview_container').style.display = 'none';
                document.getElementById(playerInstance.videoPlayerId + '_fluid_timeline_preview_container_shadow').style.display = 'none';
            }, false);
        playerInstance.generateTimelinePreviewTags();

        if ('VTT' === timelinePreview.type && typeof timelinePreview.file === 'string') {
            import(/* webpackChunkName: "webvtt" */ '../../vendor/webvtt').then((it) => {
                window.WebVTTParser = it.default;
                playerInstance.setupThumbnailPreviewVtt();
            });
        } else if ('static' === timelinePreview.type && typeof timelinePreview.frames === 'object') {
            timelinePreview.spriteImage = true;
            playerInstance.timelinePreviewData = timelinePreview.frames;
        } else {
            throw 'Invalid thumbnail-preview - type must be VTT or static';
        }

        playerInstance.showTimeOnHover = false;
    };
}
