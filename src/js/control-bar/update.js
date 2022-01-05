import { createElement, emptyEl, toggleHidden } from '../utils/dom';
import { formatTime } from '../utils/time';
import is from '../utils/is';

class Update {
    constructor(player) {
        this.player = player;

        this.updateInterval = null;
        this.updateRefreshInterval = 60;
    }

    time = () => {
        let currentTime = formatTime(this.player.currentTime);

        if (this.player.streaming.live.active) {
            currentTime = this.player.streaming.live.timeDisplay();
        }

        this.player.controls.currentTime.textContent = currentTime;
    }

    duration = () => {
        const { player } = this;

        if (player.streaming.live.active) {
            toggleHidden(player.controls.separator, true);
            toggleHidden(player.controls.duration, true);
            return;
        }

        const duration = formatTime(player.duration);
        player.controls.duration.textContent = duration;
    };

    progress = () => {
        if (this.updateInterval === null) {
            this.updateInterval = setInterval(() => {
                this.player.progressBar.update();
                if (this.player.paused) {
                    clearInterval(this.updateInterval);
                    this.updateInterval = null;
                }
            }, this.updateRefreshInterval);
        }
    };

    buffer = () => {
        const buffer = this.player.controls.loadProgress;
        const duration = this.player.duration;
        const { buffered } = this.player.media;

        emptyEl(buffer);

        for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);

            const left = (start / duration) * 100;
            const width = ((end - start) / duration) * 100;

            const el = createElement('div', {
                class: 'buffer',
            });

            el.style.left = `${left.toFixed(2)}%`;
            el.style.width = `${width.toFixed(2)}%`;

            buffer.appendChild(el);
        }
    };
}

export default Update;
