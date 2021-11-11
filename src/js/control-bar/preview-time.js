import { createElement, getEventOffsetX } from '../utils/dom';
import { on } from '../utils/events';
import computedStyle from '../utils/computed-style';
import { formatTime } from '../utils/time';

class PreviewTime {
    constructor(player) {
        this.player = player;
        this.render();
    }

    move = (event) => {
        const progress = this.player.controls.progressContainer;
        const width = progress.clientWidth;
        let offsetX = getEventOffsetX(progress, event);

        if (offsetX < 0 || offsetX > width) {
            return;
        }
        const preview = this.preview;
        const seconds = (this.player.duration * offsetX) / width;

        preview.style.width = seconds >= 3600 ? '52px' : '';

        const left = parseInt(computedStyle(progress, 'left').replace('px', ''));
        const scrollLimit = width - preview.clientWidth;
        offsetX = offsetX - preview.clientWidth / 2;

        let positionX = left;

        if (offsetX >= 0) {
            if (offsetX <= scrollLimit) {
                positionX = offsetX + left;
            } else {
                positionX = scrollLimit + left;
            }
        }

        preview.innerText = formatTime(seconds);
        preview.style.left = `${positionX}px`;
        preview.style.visibility = 'visible';
    };

    hide = (event) => {
        this.preview.style.visibility = 'hidden';
    };

    render = () => {
        if (!this.player.config.layoutControls.showTimeOnHover) {
            return;
        }

        this.preview = createElement('div', {
            class: 'fluid_timeline_preview_time',
        });
        this.player.controls.container.appendChild(this.preview);
        this.listeners();
    };

    listeners = () => {
        const { player } = this;

        // show thumbnails
        on.call(player, player.controls.progressContainer, 'mousemove touchmove', this.move);

        // hide thumbnails
        on.call(player, player.controls.progressContainer, 'mouseleave touchend', this.hide);
    };
}

export default PreviewTime;
