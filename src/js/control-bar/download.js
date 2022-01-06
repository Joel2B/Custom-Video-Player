import { createElement } from '../utils/dom';
import { on } from '../utils/events';

class Download {
    constructor(player) {
        this.player = player;

        this.init();
    }

    init = () => {
        const { player } = this;

        if (!player.config.layoutControls.allowDownload) {
            return;
        }

        player.controls.download.style.display = 'inline-block';

        this.link = createElement('a');
        player.controls.download.appendChild(this.link);

        this.listeners();
    };

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

        on.call(player, player.controls.download, 'click', (event) => {
            this.link.download = player.currentSource.src;
            this.link.href = player.currentSource.src;
            this.link.target = '_blank';

            this.link.click();
        });
    };
}

export default Download;
