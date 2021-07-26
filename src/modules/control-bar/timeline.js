'use strict';
export default function (self, options) {
    self.drawTimelineBasicPreview = (event) => {
        const progressContainer = self.domRef.controls.progressContainer;
        const totalWidth = progressContainer.clientWidth;
        const hoverQ = self.getEventOffsetX(event, progressContainer);

        if (hoverQ < 0 || hoverQ > totalWidth) {
            return;
        }

        const hoverTimeItem = progressContainer.parentNode.lastChild;
        const hoverSecondQ = self.currentVideoDuration * hoverQ / totalWidth;

        hoverTimeItem.style.width = hoverSecondQ >= 3600 ? '52px' : '';

        const timelinePosition = parseInt(window.getComputedStyle(progressContainer, null).getPropertyValue('left').replace('px', ''));
        const currentPreviewPosition = hoverQ - hoverTimeItem.clientWidth / 2;
        const previewScrollLimitWidth = totalWidth - hoverTimeItem.clientWidth;

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

        hoverTimeItem.innerText = self.formatTime(hoverSecondQ);
        hoverTimeItem.style.left = `${previewPosition}px`;
        hoverTimeItem.style.visibility = 'visible';
    };

    // Create the time position preview only if the vtt previews aren't enabled
    self.createTimePositionPreview = () => {
        if (!self.showTimeOnHover) {
            return;
        }

        self.domRef.controls.basicPreview = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_timeline_preview',
            className: 'fluid_timeline_preview',
            style: {
                visibility: 'hidden',
                position: 'absolute'
            },
            parent: self.domRef.controls.root
        });

        // Set up hover for time position preview display
        self.trackEvent(self.domRef.player.parentNode, 'mousemove', '.fluid_controls_progress_container', (event) => {
            self.drawTimelineBasicPreview(event);
        });

        // Hide timeline preview on mouseout
        self.trackEvent(self.domRef.player.parentNode, 'mouseout', '.fluid_controls_progress_container', (event) => {
            const progress = self.domRef.controls.progressContainer;
            if (typeof event.clientX !== 'undefined' && progress.contains(document.elementFromPoint(event.clientX, event.clientY))) {
                //False positive (Chrome bug when fast click causes leave event)
                return;
            }
            const hoverTimeItem = progress.parentNode.lastChild;
            hoverTimeItem.style.visibility = 'hidden';
        });
    };

    self.setupThumbnailPreviewVtt = () => {
        self.sendRequest(
            self.displayOptions.layoutControls.timelinePreview.file,
            true,
            self.displayOptions.vastOptions.vastTimeout,
            function () {
                const convertVttRawData = function (vttRawData) {
                    if (!vttRawData.length) {
                        return [];
                    }

                    const result = [];
                    let tempThumbnailData = null;
                    let tempThumbnailCoordinates = null;

                    for (let i = 0; i < vttRawData.length; i++) {
                        tempThumbnailData = vttRawData[i].text.split('#');
                        let xCoords = 0, yCoords = 0, wCoords = 122.5, hCoords = 69;

                        // .vtt file contains sprite corrdinates
                        if (
                            (tempThumbnailData.length === 2) &&
                            (tempThumbnailData[1].indexOf('xywh=') === 0)
                        ) {
                            tempThumbnailCoordinates = tempThumbnailData[1].substring(5);
                            tempThumbnailCoordinates = tempThumbnailCoordinates.split(',');

                            if (tempThumbnailCoordinates.length === 4) {
                                self.displayOptions.layoutControls.timelinePreview.spriteImage = true;
                                xCoords = parseInt(tempThumbnailCoordinates[0]);
                                yCoords = parseInt(tempThumbnailCoordinates[1]);
                                wCoords = parseInt(tempThumbnailCoordinates[2]);
                                hCoords = parseInt(tempThumbnailCoordinates[3]);
                            }
                        }

                        let imageUrl;
                        if (self.displayOptions.layoutControls.timelinePreview.spriteRelativePath
                            && self.displayOptions.layoutControls.timelinePreview.file.indexOf('/') !== -1
                            && (typeof self.displayOptions.layoutControls.timelinePreview.sprite === 'undefined' || self.displayOptions.layoutControls.timelinePreview.sprite === '')
                        ) {
                            imageUrl = self.displayOptions.layoutControls.timelinePreview.file.substring(0, self.displayOptions.layoutControls.timelinePreview.file.lastIndexOf('/'));
                            imageUrl += '/' + tempThumbnailData[0];
                        } else {
                            imageUrl = (self.displayOptions.layoutControls.timelinePreview.sprite ? self.displayOptions.layoutControls.timelinePreview.sprite : tempThumbnailData[0]);
                        }

                        result.push({
                            startTime: vttRawData[i].startTime,
                            endTime: vttRawData[i].endTime,
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
                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const cues = [];

                parser.oncue = (cue) => cues.push(cue);
                parser.parse(textResponse);
                parser.flush();

                self.timelinePreviewData = convertVttRawData(cues);
            }
        );
    };

    self.generateTimelinePreviewTags = () => {
        self.domRef.controls.previewContainer = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_timeline_preview_container',
            className: 'fluid_timeline_preview_container',
            style: {
                display: 'none',
                position: 'absolute',
            },
            parent: self.domRef.controls.root
        })

        self.domRef.controls.tooltipTextContainer = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_timeline_preview_tooltip_text_container',
            className: 'fluid_timeline_preview_tooltip_text_container',
            style: {
                position: 'absolute'
            },
            parent: self.domRef.controls.previewContainer
        })

        self.domRef.controls.previewTooltipText = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_timeline_preview_tooltip_text',
            className: 'fluid_timeline_preview_tooltip_text',
            style: {
                position: 'absolute'
            },
            parent: self.domRef.controls.tooltipTextContainer
        })

        //Shadow is needed to not trigger mouseleave event, that stops showing thumbnails, in case one scrubs a bit too fast and leaves current thumb before new one drawn.
        self.domRef.controls.previewContainerShadow = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_timeline_preview_container_shadow',
            className: 'fluid_timeline_preview_container_shadow',
            style: {
                position: 'absolute',
                display: 'none',
                opacity: 1
            },
            parent: self.domRef.controls.root
        })
    };

    self.getThumbnailCoordinates = (second) => {
        if (self.timelinePreviewData.length) {
            for (let i = 0; i < self.timelinePreviewData.length; i++) {
                if ((second >= self.timelinePreviewData[i].startTime) && (second <= self.timelinePreviewData[i].endTime)) {
                    return self.timelinePreviewData[i];
                }
            }
        }

        return false;
    };

    self.drawTimelinePreview = (event) => {
        const timelinePreviewTag = self.domRef.controls.previewContainer;
        const tooltipTextContainer = self.domRef.controls.tooltipTextContainer;
        const timelinePreviewTooltipText = self.domRef.controls.previewTooltipText;
        const timelinePreviewShadow = self.domRef.controls.previewContainerShadow;
        const progressContainer = self.domRef.controls.progressContainer;
        const totalWidth = progressContainer.clientWidth;

        if (self.isCurrentlyPlayingAd) {
            if (timelinePreviewTag.style.display !== 'none') {
                timelinePreviewTag.style.display = 'none';
            }

            return;
        }

        //get the hover position
        const hoverX = self.getEventOffsetX(event, progressContainer);
        let hoverSecond = null;

        if (totalWidth) {
            hoverSecond = self.currentVideoDuration * hoverX / totalWidth;

            //get the corresponding thumbnail coordinates
            const thumbnailCoordinates = self.getThumbnailCoordinates(hoverSecond);
            timelinePreviewShadow.style.width = totalWidth + 'px';
            timelinePreviewShadow.style.display = 'block';

            if (thumbnailCoordinates !== false) {
                const progressContainer = self.domRef.controls.progressContainer;
                const totalWidth = progressContainer.clientWidth;
                // preview border is set to 2px, a total of 4px on both sides, and they are subtracted from the position of the timeline preview so that it stays within the width of the timeline
                const borderWidthPreview = parseInt(window.getComputedStyle(timelinePreviewTag, null).getPropertyValue('border-left-width').replace('px', '')) * 2;
                // add the top position to the tooltip so it is not along with the preview
                const topTooltipText = 7;
                // get the left position of the timeline
                const timelinePosition = parseInt(window.getComputedStyle(progressContainer, null).getPropertyValue('left').replace('px', ''));
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
                timelinePreviewTooltipText.innerText = self.formatTime(hoverSecond);

                if (!self.displayOptions.layoutControls.timelinePreview.spriteImage) {
                    timelinePreviewTag.style.backgroundSize = 'contain';
                }
            } else {
                timelinePreviewTag.style.display = 'none';
            }
        }
    };

    self.setupThumbnailPreview = () => {
        let timelinePreview = self.displayOptions.layoutControls.timelinePreview;
        if (!timelinePreview || !timelinePreview.type || self.showCardBoardView) {
            return;
        }

        let eventOn = 'mousemove';
        let eventOff = 'mouseleave';
        if (self.mobileInfo.userOs) {
            eventOn = 'touchmove';
            eventOff = 'touchend';
        }
        self.domRef.controls.progressContainer
            .addEventListener(eventOn, self.drawTimelinePreview.bind(self), false);
        self.domRef.controls.progressContainer
            .addEventListener(eventOff, function (event) {
                const progress = self.domRef.controls.progressContainer;
                if (typeof event.clientX !== 'undefined' && progress.contains(document.elementFromPoint(event.clientX, event.clientY))) {
                    //False positive (Chrome bug when fast click causes leave event)
                    return;
                }
                self.domRef.controls.previewContainer.style.display = 'none';
                self.domRef.controls.previewContainerShadow.style.display = 'none';
            }, false);
        self.generateTimelinePreviewTags();

        if ('VTT' === timelinePreview.type && typeof timelinePreview.file === 'string') {
            import(/* webpackChunkName: "webvtt" */ 'videojs-vtt.js').then(() => {
                self.setupThumbnailPreviewVtt();
            });
        } else if ('static' === timelinePreview.type && typeof timelinePreview.frames === 'object') {
            timelinePreview.spriteImage = true;
            self.timelinePreviewData = timelinePreview.frames;
        } else {
            throw 'Invalid thumbnail-preview - type must be VTT or static';
        }

        self.showTimeOnHover = false;
    };
}
