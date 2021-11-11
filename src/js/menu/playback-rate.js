import { createElement, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { selector } from './menu-item';

class Speed {
    constructor(player) {
        this.player = player;
        this.id = 'playbackRate';
        this.options = [0.5, 1, 1.5, 2];
        this.width = 110;
        this.height = 67;

        this.init();
    }

    init = () => {
        if (!this.player.menu.isEnabled(this.id)) {
            return;
        }

        if (this.player.storage.get(this.id) === null) {
            this.player.storage.set(this.id, '1');
        }

        this.createItems();
    }

    createItems = () => {
        const { player } = this;

        this.item = selector({
            id: this.id,
            title: 'Speed',
            value: 'Normal',
        });

        const childs = new DocumentFragment();

        for (const value of this.options) {
            const option = createElement(
                'li',
                {
                    ...(value === 1 && { class: 'cvp_active' }),
                },
                value === 1 ? 'Normal' : value.toString(),
            );
            option.setAttribute('data-speed', value);
            childs.appendChild(option);
            this.height += player.menu.item.height;
        }

        this.page = createElement('ul', {
            class: 'cvp_options_list cvp_speed hide',
        });

        this.page.appendChild(childs);

        on.call(player, this.page, 'click', (event) => {
            if (event.target.tagName !== 'LI') {
                return;
            }

            player.menu.close();

            const previous = this.page.querySelector('.cvp_active');
            const selected = event.target;

            if (previous === selected) {
                return;
            }

            toggleClass(previous, 'cvp_active', false);
            toggleClass(selected, 'cvp_active', true);

            this.item.lastChild.textContent = selected.firstChild.textContent;
            this.set(selected.dataset.speed);
        });

        on.call(player, this.item, 'click', () => {
            player.menu.openSubMenu(this.item, this.page, this.width, this.height);
        });

        player.menu.add({
            id: this.id,
            field: 'selector',
            content: this.page,
            item: this.item,
        });
    }

    set = (input) => {
        if (this.player.isCurrentlyPlayingAd) {
            return;
        }

        this.player.speed = input;
        this.player.storage.set(this.id, input);
    }

    apply = () => {
        if (!this.player.menu.isEnabled(this.id)) {
            return;
        }

        const current = this.player.storage.get(this.id);
        if (current === '1') {
            return;
        }

        const previous = this.page.querySelector('.cvp_active');
        const selected = this.page.querySelector(`[data-speed='${current}']`);

        toggleClass(previous, 'cvp_active', false);
        toggleClass(selected, 'cvp_active', true);

        this.item.lastChild.textContent = selected.firstChild.textContent;

        this.set(current);
    }
}

export default Speed;
