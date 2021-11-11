import { createElement, toggleClass } from '../utils/dom';
import { on } from '../utils/events';

class Download {
    constructor(player) {
        this.player = player;
        this.create();
    }

    create = () => {
        const { player } = this;

        if (!player.config.layoutControls.allowDownload) {
            return;
        }

        this.el = createElement('div', {
            class: 'fluid_button fluid_button_download',
        });

        toggleClass(this.el, 'show', true);

        this.link = createElement('a');
        this.el.appendChild(this.link);

        this.listeners();

        player.controls.rightContainer.appendChild(this.el);
    }

    listeners = () => {
        const { player } = this;

        on.call(player, this.link, 'click', (event) => {
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }

            setInterval(() => {
                this.link.download = '';
                this.link.href = '';
            }, 100);
        });

        on.call(player, this.el, 'click', (event) => {
            this.link.download = player.originalSrc;
            this.link.href = player.originalSrc;
            this.link.click();
        });
    }
}

export default Download;
