import { hasClass, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { switcher } from './menu-item';

class Autoplay {
    constructor(player) {
        this.player = player;
        this.id = 'autoPlay';
        this.applied = false;

        this.init();
    }

    init = () => {
        if (this.player.storage.get(this.id) === null) {
            const value = this.player.config.layoutControls[this.id];
            this.player.storage.set(this.id, value);
        }

        this.createItems();
    }

    createItems = () => {
        const { player } = this;

        const item = switcher({
            id: this.id,
            title: 'Autoplay',
            enabled: player.storage.get(this.id),
        });

        on.call(player, item, 'click', () => {
            let value = false;
            if (hasClass(item, 'cvp_enabled')) {
                toggleClass(item, 'cvp_enabled', false);
                if (player.storage.get('volume') === 1 && player.storage.get('mute')) {
                    player.toggleMute();
                } else {
                    player.volumeControl.apply();
                }
            } else {
                toggleClass(item, 'cvp_enabled', true);
                value = true;
            }
            player.storage.set(this.id, value);
        });

        player.menu.add({
            id: this.id,
            field: 'switcher',
            item: item,
        });
    }

    apply = (force = true) => {
        const { player } = this;

        if (
            !player.menu.isEnabled(this.id) ||
            !player.storage.get(this.id) ||
            this.applied
        ) {
            return false;
        }

        player.muted = true;
        player.volume = 0;

        if (force) {
            this.applied = true;
            player.playPause.toggle();
        }

        return true;
    }
}

export default Autoplay;
