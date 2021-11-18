import { getEventOffsetX } from '../utils/dom';
import { off, on } from '../utils/events';
import { TOUCH_ENABLED } from '../utils/browser';
import is from '../utils/is';

class ProgressBar {
    constructor(player) {
        this.player = player;
        this.positionX = 0;
        this.timer = null;
        this.initiallyPaused = false;
        this.playPauseAnimation = false;

        this.listeners();
    }

    update = (seeking = false) => {
        const { player } = this;
        const { progressContainer, playProgress, scrubberProgressContainer } = player.controls;
        const width = progressContainer.clientWidth;

        if (seeking) {
            this.positionX = Math.max(Math.min(this.positionX, width), 0);
            player.currentTime = (player.duration * this.positionX) / width;
        }

        const scaleX = player.currentTime / player.duration;
        const translateX = scaleX * width;

        playProgress.style.transform = `scaleX(${scaleX})`;
        scrubberProgressContainer.style.transform = `translateX(${translateX}px)`;
    };

    start = (event) => {
        const { player } = this;

        if (player.isCurrentlyPlayingAd) {
            return;
        }

        // hide animations
        this.playPauseAnimation = player.config.layoutControls.playPauseAnimation;
        player.config.layoutControls.playPauseAnimation = false;

        this.positionX = getEventOffsetX(player.controls.progressContainer, event);

        this.initiallyPaused = player.paused;
        if (!this.initiallyPaused) {
            this.timer = setTimeout(() => {
                player.pause();
            }, 300);
        }

        on.call(player, document, 'mousemove touchmove', this.move);
        on.call(player, document, 'mouseup touchend mouseleave', this.end);
    };

    move = (event) => {
        const { player } = this;
        const { progressContainer, scrubberProgress } = player.controls;

        player.preview.current.move(event);

        this.positionX = getEventOffsetX(progressContainer, event);

        this.update(true);

        // resize
        scrubberProgress.style.setProperty('transform', 'none', 'important');

        if (TOUCH_ENABLED) {
            return;
        }

        for (const node of progressContainer.childNodes) {
            if (node.className.includes('scrubber')) {
                continue;
            }
            node.style.transform = 'none';
        }
    };

    end = (event) => {
        const { player } = this;
        const { progressContainer, scrubberProgress } = player.controls;

        player.preview.current.hide(event);

        // back to normal size
        for (const node of progressContainer.childNodes) {
            node.style.removeProperty('transform');
        }

        scrubberProgress.style.removeProperty('transform');

        const positionX = getEventOffsetX(progressContainer, event);
        if (is.number(positionX)) {
            this.positionX = positionX;
        }

        this.update(true);

        if (!this.initiallyPaused) {
            clearTimeout(this.timer);
            player.play();
        }

        // restore animations
        setTimeout(() => {
            player.config.layoutControls.playPauseAnimation = this.playPauseAnimation;
        }, 200);

        off.call(player, document, 'mousemove touchmove', this.move);
        off.call(player, document, 'mouseup touchend mouseleave', this.end);
    };

    hover = (event) => {
        const { progressContainer, hoverProgress } = this.player.controls;
        const width = progressContainer.clientWidth;
        const positionX = getEventOffsetX(progressContainer, event);
        const scaleX = positionX / width;

        hoverProgress.style.transform = `scaleX(${scaleX})`;
    };

    listeners = () => {
        const { player } = this;
        const { progressContainer } = player.controls;

        on.call(player, progressContainer, 'mousedown touchstart', this.start);
        on.call(player, progressContainer, 'mousemove', this.hover);
    };

    resize = () => {
        setTimeout(() => {
            this.update();
        }, 100);
    };
}

export default ProgressBar;
