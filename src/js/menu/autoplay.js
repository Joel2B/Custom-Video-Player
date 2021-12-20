import { hasClass, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { switcher } from './menu-item';

class Autoplay {
    constructor(player) {
        this.player = player;
        this.id = 'autoPlay';

        this.config = this.player.config.layoutControls[this.id];

        this.applied = false;

        this.init();
    }

    init = () => {
        const { player } = this;

        if (!player.menu.isEnabled(this.id)) {
            return;
        }

        if (this.player.storage.get(this.id) === null) {
            this.player.storage.set(this.id, this.config);
        }

        this.setupMenu();
    };

    setupMenu = () => {
        const { player } = this;

        const item = switcher({
            id: this.id,
            title: 'Autoplay',
            enabled: player.storage.get(this.id),
        });

        player.menu.add({
            id: this.id,
            field: 'switcher',
            item: item,
        });

        on.call(player, item, 'click', () => {
            let active = false;

            if (!hasClass(item, 'cvp_enabled')) {
                active = true;
            } else {
                if (player.storage.get('volume') === 1 && player.storage.get('mute')) {
                    player.toggleMute();
                } else {
                    player.volumeControl.apply();
                }
            }

            toggleClass(item, 'cvp_enabled', active);

            player.storage.set(this.id, active);
        });
    };

    apply = (force = true) => {
        const { player } = this;

        if (!player.menu.isEnabled(this.id) || !player.storage.get(this.id) || this.applied) {
            return false;
        }

        player.muted = true;
        player.volume = 0;

        player.controlBar.toggle(false);

        if (force) {
            this.applied = true;

            if (player.findRoll('preRoll')) {
                setTimeout(() => {
                    player.playPause.toggle();
                }, 500);
            } else {
                player.playPause.toggle();
            }
        }

        return true;
    };
}

export default Autoplay;
