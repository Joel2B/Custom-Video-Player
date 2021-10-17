import { switcher } from './menu-item';

class Autoplay {
    constructor(player) {
        this.player = player;
        this.id = 'autoPlay';
        if (this.player.getLocalStorage(this.id) === null) {
            const value = this.player.displayOptions.layoutControls[this.id];
            this.player.setLocalStorage(this.id, value);
        }

        if (!this.player.menu.isEnabled(this.id)) {
            return;
        }

        this.createItems();
        this.apply();
    }

    createItems() {
        const item = switcher({
            id: this.id,
            title: 'Autoplay',
            enabled: this.player.getLocalStorage(this.id),
        });
        item.addEventListener('click', () => {
            let value = false;
            if (item.className.indexOf('cvp_enabled') !== -1) {
                item.classList.remove('cvp_enabled');
                if (this.player.getLocalStorage('volume') === 1 && this.player.getLocalStorage('mute')) {
                    this.player.muteToggle();
                } else {
                    this.player.applyVolume();
                }
            } else {
                item.classList.add('cvp_enabled');
                value = true;
            }
            this.player.setLocalStorage(this.id, value);
        });

        this.player.menu.add({
            id: this.id,
            field: 'switcher',
            item: item,
        });
    }

    apply() {
        if (!this.player.menu.isEnabled(this.id) || !this.player.getLocalStorage(this.id)) {
            return;
        }

        this.player.setMute();

        return true;
    }
}

export default Autoplay;
