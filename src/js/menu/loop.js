import { hasClass, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { switcher } from './menu-item';

class Loop {
    constructor(player) {
        this.player = player;
        this.id = 'loop';

        this.init();
    }

    init = () => {
        const { player } = this;

        if (player.storage.get(this.id) === null) {
            const value = player.config.layoutControls[this.id];
            player.storage.set(this.id, value);
        }

        if (!player.menu.isEnabled(this.id)) {
            return;
        }

        this.createItems();
        this.apply();
    }

    createItems = () => {
        const { player } = this;
        const item = switcher({
            id: this.id,
            title: 'Loop',
            enabled: player.storage.get(this.id),
        });

        on.call(player, item, 'click', () => {
            let value = false;

            if (hasClass(item, 'cvp_enabled')) {
                toggleClass(item, 'cvp_enabled', false);
            } else {
                toggleClass(item, 'cvp_enabled', true);
                value = true;
            }
            player.storage.set(this.id, value);
            player.loop = value;
        });

        player.menu.add({
            id: this.id,
            field: 'switcher',
            item: item,
        });
    }

    apply = () => {
        if (!this.player.menu.isEnabled(this.id) || !this.player.storage.get(this.id)) {
            return;
        }

        this.player.loop = true;

        return true;
    }
}

export default Loop;
