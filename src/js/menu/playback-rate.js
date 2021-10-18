import { selector } from './menu-item';

class Speed {
    constructor(player) {
        this.player = player;
        this.id = 'playbackRate';
        if (!this.player.menu.isEnabled(this.id)) {
            return;
        }

        if (this.player.getLocalStorage(this.id) === null) {
            this.player.setLocalStorage(this.id, '1');
        }

        this.options = [0.5, 1, 1.5, 2];

        this.width = 110;
        this.height = 67;

        this.createItems();
    }

    createItems() {
        this.item = selector({
            id: this.id,
            title: 'Speed',
            value: 'Normal',
        });

        const childs = new DocumentFragment();

        for (const value of this.options) {
            const option = this.player.createElement({
                tag: 'li',
                textContent: value === 1 ? 'Normal' : value,
                dataset: {
                    speed: value,
                },
                ...(value === 1 && { className: 'cvp_active' }),
            });
            childs.appendChild(option);
            this.height += this.player.menu.item.height;
        }

        this.page = this.player.createElement({
            tag: 'ul',
            className: 'cvp_options_list cvp_speed hide',
        });

        this.page.appendChild(childs);
        this.page.addEventListener('click', (e) => {
            if (e.target.tagName !== 'LI') {
                return;
            }

            this.player.menu.close();

            const previous = this.page.querySelector('.cvp_active');
            const selected = e.target;
            if (previous === selected) {
                return;
            }
            previous.classList.remove('cvp_active');
            selected.classList.add('cvp_active');

            this.item.lastChild.textContent = selected.firstChild.textContent;
            this.set(selected.dataset.speed);
        });

        this.item.addEventListener('click', () => {
            this.player.menu.openSubMenu(this.item, this.page, this.width, this.height);
        });

        this.player.menu.add({
            id: this.id,
            field: 'selector',
            content: this.page,
            item: this.item,
        });
    }

    set(speed) {
        if (this.player.isCurrentlyPlayingAd) {
            return;
        }
        this.player.setPlaybackSpeed(speed);
        this.player.setLocalStorage(this.id, speed);
    }

    apply() {
        if (!this.player.menu.isEnabled(this.id)) {
            return;
        }

        const current = this.player.getLocalStorage(this.id);
        if (current === '1') {
            return;
        }

        const previous = this.page.querySelector('.cvp_active');
        const selected = this.page.querySelector(`[data-speed='${current}']`);
        previous.classList.remove('cvp_active');
        selected.classList.add('cvp_active');
        this.item.lastChild.textContent = selected.firstChild.textContent;

        setTimeout(() => {
            this.set(current);
        }, 500);
    }
}

export default Speed;
