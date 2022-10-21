import { hasClass, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { switcher } from './menu-item';

class Loop {
  constructor(player) {
    this.player = player;
    this.id = 'loop';

    this.config = this.player.config.layoutControls[this.id];

    this.current = false;

    this.init();
  }

  init = () => {
    const { player } = this;

    if (!player.menu.isEnabled(this.id)) {
      return;
    }

    if (player.storage.get(this.id) === null) {
      player.storage.set(this.id, this.config);
    }

    this.setupMenu();
  };

  setupMenu = () => {
    const { player } = this;

    const item = switcher({
      id: this.id,
      title: 'Loop',
      enabled: player.storage.get(this.id),
      instance: player,
    });

    player.menu.add({
      id: this.id,
      field: 'switcher',
      item,
    });

    on.call(player, item, 'click', () => {
      let active = false;

      if (!hasClass(item, 'cvp_enabled')) {
        active = true;
      }

      toggleClass(item, 'cvp_enabled', active);

      this.set(active);

      if (player.mobile) {
        player.menu.close();
      }
    });

    this.set(player.storage.get(this.id));
  };

  set = (input) => {
    const { player } = this;

    this.current = input;

    player.loop = input;

    player.storage.set(this.id, input);
  };
}

export default Loop;
