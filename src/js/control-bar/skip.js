import { on } from '../utils/events';

class Skip {
    constructor(player) {
        this.player = player;
        this.listeners();
    }

    skip = (period) => {
        const { player } = this;
        if (player.isCurrentlyPlayingAd) {
            return;
        }

        let skipTo = player.currentTime + period;
        if (skipTo < 0) {
            skipTo = 0;
        }
        player.currentTime = skipTo;
    };

    listeners = () => {
        const { player } = this;

        on.call(player, player.controls.skipBack, 'click', () => this.skip(-10));
        on.call(player, player.controls.skipForward, 'click', () => this.skip(10));
    };
}

export default Skip;
