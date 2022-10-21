import { createElement, getEventOffsetX, getEventOffsetY, insertAfter } from './utils/dom';
import { on } from './utils/events';
import is from './utils/is';

class ContextMenu {
  constructor(player) {
    this.player = player;

    this.init();
  }

  init = () => {
    const { player } = this;
    const { config } = player;
    const wrapper = player.wrapper;
    const links = config.layoutControls.contextMenu.links;

    // Create own context menu
    this.menu = createElement('div', {
      class: 'fluid_context_menu',
    });

    this.list = createElement('ul');

    if (!is.empty(links)) {
      for (const link of links) {
        const li = createElement('li', null, link.label);
        on.call(player, li, 'click', () => window.open(link.href, '_blank'));
        this.list.appendChild(li);
      }
    }

    this.defaultOptions();

    this.version = createElement('li', null, 'CVP ' + player.version);
    on.call(player, this.version, 'click', () => window.open(player.homepage, '_blank'));
    this.list.appendChild(this.version);

    this.menu.appendChild(this.list);

    insertAfter(this.menu, player.media);

    // Disable the default context menu
    on.call(
      player,
      wrapper,
      'contextmenu',
      (event) => {
        event.preventDefault();

        if (player.mobile) {
          return;
        }

        this.menu.style.left = getEventOffsetX(player.media, event) + 'px';
        this.menu.style.top = getEventOffsetY(player.media, event) + 'px';
        this.menu.style.display = 'block';
      },
      false,
    );

    // Hide the context menu on clicking elsewhere
    on.call(player, document, 'click', (event) => {
      if (event.target !== player.media || event.button !== 2) {
        this.menu.style.display = 'none';
      }
    });
  };

  defaultOptions = () => {
    const { player } = this;
    const { config } = player;

    if (!config.layoutControls.contextMenu.controls) {
      return;
    }

    this.play = createElement('li', null, config.captions.play);
    on.call(player, this.play, 'click', player.playPause.toggle);
    this.list.appendChild(this.play);

    this.mute = createElement('li', null, config.captions.mute);
    on.call(player, this.mute, 'click', player.toggleMute);
    this.list.appendChild(this.mute);

    this.shortcuts = createElement('li', null, config.captions.shortcutsInfo);
    on.call(player, this.shortcuts, 'click', player.shortcuts.open);
    this.list.appendChild(this.shortcuts);

    this.fs = createElement('li', null, config.captions.fullscreen);
    on.call(player, this.fs, 'click', player.fullscreen.toggle);
    this.list.appendChild(this.fs);
  };
}

export default ContextMenu;
