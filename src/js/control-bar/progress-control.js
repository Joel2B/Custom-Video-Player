export default function(self) {
    self.contolProgressbarUpdate = () => {
        const progressContainer = self.domRef.wrapper.getElementsByClassName('fluid_controls_progress_container');

        for (let i = 0; i < progressContainer.length; i++) {
            const totalWidth = progressContainer[i].clientWidth;
            const currentProgressTag = progressContainer[i].firstChild.firstChild;
            const markerContainer = progressContainer[i].firstChild.nextSibling;
            const scaleX = self.domRef.player.currentTime / self.currentVideoDuration;
            const translateX = scaleX * totalWidth;

            currentProgressTag.style.transform = `scaleX(${scaleX})`;
            currentProgressTag.style.transformOrigin = '0 0';

            markerContainer.style.transform = `translateX(${translateX}px)`;
        }
    };

    self.controlDurationUpdate = () => {
        const currentPlayTime = self.formatTime(self.domRef.player.currentTime);

        let isLiveHls = false;
        if (self.hlsPlayer) {
            isLiveHls = self.hlsPlayer.levels &&
                self.hlsPlayer.levels[self.hlsPlayer.currentLevel] &&
                self.hlsPlayer.levels[self.hlsPlayer.currentLevel].details.live;
        }

        let durationText;
        if (isNaN(self.currentVideoDuration) || !isFinite(self.currentVideoDuration) || isLiveHls) {
            durationText = currentPlayTime;
        } else {
            const totalTime = self.formatTime(self.currentVideoDuration);
            durationText = currentPlayTime + ' / ' + totalTime;
        }

        const timePlaceholder = self.domRef.controls.duration;
        timePlaceholder.innerHTML = durationText;
    };

    self.onProgressbarMouseDown = event => {
        self.displayOptions.layoutControls.playPauseAnimation = false;
        // we need an initial position for touchstart events, as mouse up has no offset x for iOS
        const progressContainer = self.domRef.controls.progressContainer;
        let initialPosition = self.getEventOffsetX(event, progressContainer);

        if (self.isCurrentlyPlayingAd) {
            return;
        }

        self.fluidPseudoPause = true;

        const initiallyPaused = self.domRef.player.paused;
        if (!initiallyPaused) {
            self.domRef.player.pause();
        }

        const shiftTime = timeBarX => {
            const totalWidth = progressContainer.clientWidth;
            if (totalWidth) {
                self.domRef.player.currentTime = self.currentVideoDuration * timeBarX / totalWidth;
                self.contolProgressbarUpdate();
            }
        };

        const onProgressbarMouseMove = event => {
            // while holding down on the progress bar and exiting the bar, it shows wrong position of the progress bar
            const currentX = self.getEventOffsetX(event, progressContainer);
            initialPosition = NaN; // mouse up will fire after the move, we don't want to trigger the initial position in the event of iOS
            shiftTime(currentX);
            self.controlDurationUpdate();

            if (!self.showTimeOnHover) {
                self.drawTimelinePreview(event);
            } else {
                self.drawTimelineBasicPreview(event);
            }

            const nodes = progressContainer.childNodes;
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].className.indexOf('marker_container') === -1) {
                    nodes[i].style.transform = 'none';
                }
            }

            progressContainer.firstChild.nextSibling.firstChild.style.setProperty('transform', 'none', 'important');
        };

        const onProgressbarMouseUp = event => {
            const nodes = progressContainer.childNodes;
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].className.indexOf('marker_container') === -1) {
                    nodes[i].style.removeProperty('transform');
                }
            }

            progressContainer.firstChild.nextSibling.firstChild.style.removeProperty('transform');

            if (!self.showTimeOnHover) {
                self.domRef.controls.previewContainer.style.display = 'none';
                self.domRef.controls.previewContainerShadow.style.display = 'none';
            } else {
                progressContainer.parentNode.lastChild.style.visibility = 'hidden';
            }

            document.removeEventListener('mousemove', onProgressbarMouseMove);
            document.removeEventListener('touchmove', onProgressbarMouseMove);
            document.removeEventListener('mouseup', onProgressbarMouseUp);
            document.removeEventListener('mouseleave', onProgressbarMouseUp);
            document.removeEventListener('touchend', onProgressbarMouseUp);

            // when you hold down and exit, and stop pressing while outside the progress bar item, the position of the progress bar returns to the beginning of the item where you stopped pressing
            let clickedX = self.getEventOffsetX(event, progressContainer);

            if (isNaN(clickedX) && !isNaN(initialPosition)) {
                clickedX = initialPosition;
            }

            if (!isNaN(clickedX)) {
                shiftTime(clickedX);
            }

            if (!initiallyPaused) {
                self.play();
            }

            // Wait till video played then re-enable the animations
            if (self.initialAnimationSet) {
                setTimeout(() => {
                    self.displayOptions.layoutControls.playPauseAnimation = self.initialAnimationSet;
                }, 200);
            }
            self.fluidPseudoPause = false;
        };

        document.addEventListener('mouseup', onProgressbarMouseUp);
        document.addEventListener('mouseleave', onProgressbarMouseUp);
        document.addEventListener('touchend', onProgressbarMouseUp);
        document.addEventListener('mousemove', onProgressbarMouseMove);
        document.addEventListener('touchmove', onProgressbarMouseMove);

        event.preventDefault();
    };

    self.resizeMarkerContainer = () => {
        setTimeout(() => {
            const progressContainer = self.domRef.wrapper.getElementsByClassName('fluid_controls_progress_container');

            for (let i = 0; i < progressContainer.length; i++) {
                const totalWidth = progressContainer[i].clientWidth;
                const markerContainer = progressContainer[i].firstChild.nextSibling;
                const scaleX = self.domRef.player.currentTime / self.currentVideoDuration;
                const translateX = scaleX * totalWidth;

                markerContainer.style.transform = `translateX(${translateX}px)`;
            }
        }, 125);
    };
}
