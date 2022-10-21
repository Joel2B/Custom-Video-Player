import { createElement, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { selector } from './menu-item';

class Speed {
  constructor(player) {
    this.player = player;
    this.id = 'playbackRate';

    this.config = this.player.config.layoutControls[this.id];
    this.persistent = this.player.config.layoutControls.persistentSettings[this.id];

    this.options = this.config.options;

    this.width = 110;
    this.height = 67;

    this.current = 1;
    this.lock = false;

    this.init();
  }

  init = () => {
    if (!this.player.menu.isEnabled(this.id)) {
      return;
    }

    if (this.player.storage.get(this.id) === null || !this.persistent) {
      this.player.storage.set(this.id, this.config.default);

      this.current = this.config.default;
    }

    this.setupMenu();
  };

  setupMenu = () => {
    const { player } = this;

    this.item = selector({
      id: this.id,
      title: 'Speed',
      value: 'n/a',
    });

    this.page = createElement('ul', {
      class: 'cvp_options_list cvp_speed hide',
    });

    player.menu.add({
      id: this.id,
      field: 'selector',
      content: this.page,
      item: this.item,
    });

    const items = new DocumentFragment();

    for (const value of this.options) {
      const option = createElement(
        'li',
        {
          'data-speed': value,
        },
        value === 1 ? 'Normal' : value.toString(),
      );

      items.appendChild(option);

      this.height += player.menu.item.height;
    }

    this.page.appendChild(items);

    on.call(player, this.page, 'click', (event) => {
      if (event.target.tagName !== 'LI') {
        return;
      }

      this.set(Number(event.target.dataset.speed));
    });

    on.call(player, this.item, 'click', () => {
      player.menu.openSubMenu(this.item, this.page, this.width, this.height);
    });

    this.set(player.storage.get(this.id));
  };

  set = (index, force = false) => {
    const { player } = this;

    if (!player.menu.isEnabled(this.id) || player.isCurrentlyPlayingAd) {
      this.current = index;
      return;
    }

    const previous = this.page.querySelector('.cvp_active');
    const current = this.page.querySelector(`[data-speed="${index}"]`);

    if (!current) {
      return;
    }

    toggleClass(previous, 'cvp_active', false);
    toggleClass(current, 'cvp_active', true);

    this.item.lastChild.textContent = current.firstChild.textContent;

    if (this.current === index && !force) {
      return;
    }

    this.current = index;

    player.speed = index;

    player.storage.set(this.id, index);

    player.menu.close();
  };
}

export default Speed;
