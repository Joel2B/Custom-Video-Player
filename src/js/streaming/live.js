import { toggleClass } from '../utils/dom';
import { on } from '../utils/events';

class Live {
    constructor(player) {
        this.player = player;

        this.active = false;

        this.setCurrentTime = null;
        this.getCurrentTime = null;
        this.duration = null;
        this.timeDisplay = null;
    }

    init = () => {
        const { player } = this;

        this.active = true;

        player.controls.live.style.display = 'inline-block';

        if (player.mobile) {
            toggleClass(player.controls.duration, 'hide', true);

            player.controls.live.style.display = 'flex';
        }

        return this;
    };

    onClick = (callback) => {
        const { player } = this;
        const event = player.mobile ? 'touchend' : 'click';

        on.call(player, player.controls.live, event, () => {
            callback();

            if (player.paused) {
                player.play();
            }

            player.controlBar.toggleMobile(false);
        });
    };

    toggleStatus = (input) => {
        const { player } = this;

        toggleClass(player.controls.live, 'sync', input);
    };

    destroy = () => {
        const { player } = this;

        player.controls.live.style.removeProperty('display');

        toggleClass(player.controls.duration, 'hide', false);

        this.active = false;
    };
}

export default Live;
