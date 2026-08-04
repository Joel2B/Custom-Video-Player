import { createElement, insertAfter } from './utils/dom';
import { on } from './utils/events';
import is from './utils/is';
import { getHttpsUrl } from './utils/url';

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

    this.list = createElement('ul', { role: 'menu' });

    if (!is.empty(links)) {
      for (const link of links) {
        const url = getHttpsUrl(link.href);

        if (!url) {
          continue;
        }

        const li = this.createItem(link.label, 'link');
        on.call(player, li, 'click', () => this.openExternal(url));
        this.list.appendChild(li);
      }
    }

    this.defaultOptions();

    this.version = this.createItem('CVP ' + player.version, 'info');
    on.call(player, this.version, 'click', () => this.openExternal(player.homepage));
    this.list.appendChild(this.version);

    this.menu.appendChild(this.list);

    on.call(
      player,
      this.list,
      'keydown',
      (event) => {
        const item = event.target;
        if (item.getAttribute('role') !== 'menuitem') {
          return;
        }

        const items = Array.from(this.list.querySelectorAll('[role="menuitem"]'));
        let index = items.indexOf(item);

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          if (item === this.shortcuts) {
            this.openShortcuts();
          } else {
            item.click();
          }
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.close(true);
          return;
        }

        if (event.key === 'Home') {
          index = 0;
        } else if (event.key === 'End') {
          index = items.length - 1;
        } else if (event.key === 'ArrowDown') {
          index = (index + 1) % items.length;
        } else if (event.key === 'ArrowUp') {
          index = (index - 1 + items.length) % items.length;
        } else {
          return;
        }

        event.preventDefault();
        this.focusItem(items[index]);
      },
      false,
    );

    on.call(player, this.list, 'click', (event) => {
      event.stopPropagation();
      this.close(true);
    });

    insertAfter(this.menu, player.media);

    on.call(player, wrapper, 'mousedown', (event) => {
      if (event.button === 2) {
        this.contextInvoker = document.activeElement;
      }
    });

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

        const invoker = this.contextInvoker || document.activeElement;
        this.contextInvoker = null;
        this.previousFocus =
          invoker === document.body || invoker === player.media ? player.controls.playPause : invoker;
        this.menu.style.display = 'block';
        const wrapperRect = wrapper.getBoundingClientRect();
        const menuRect = this.menu.getBoundingClientRect();
        const left = Math.min(
          Math.max(event.clientX - wrapperRect.left, 0),
          Math.max(wrapperRect.width - menuRect.width, 0),
        );
        const top = Math.min(
          Math.max(event.clientY - wrapperRect.top, 0),
          Math.max(wrapperRect.height - menuRect.height, 0),
        );

        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
        this.focusItem(this.list.querySelector('[role="menuitem"]'));
      },
      false,
    );

    // Hide the context menu on clicking elsewhere
    on.call(player, document, 'click', (event) => {
      if (event.target !== player.media || event.button !== 2) {
        this.close();
      }
    });
  };

  createItem = (label, icon) =>
    createElement('li', {
      role: 'menuitem',
      tabindex: -1,
      class: `fluid_context_menu_item fluid_context_menu_${icon}`,
    }, label);

  focusItem = (item) => {
    if (!item) {
      return;
    }

    for (const menuItem of this.list.querySelectorAll('[role="menuitem"]')) {
      menuItem.setAttribute('tabindex', menuItem === item ? '0' : '-1');
    }

    item.focus();
  };

  close = (restoreFocus = false) => {
    if (this.menu.style.display !== 'block') {
      return;
    }

    this.menu.style.display = 'none';

    if (restoreFocus && this.previousFocus?.isConnected) {
      this.previousFocus.focus();
    }

    this.previousFocus = null;
  };

  openExternal = (url) => {
    const safeUrl = getHttpsUrl(url);

    if (!safeUrl) {
      return;
    }

    const opened = window.open(safeUrl, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
    }
  };

  openShortcuts = () => {
    const invoker = this.previousFocus;
    this.close();
    this.player.shortcuts.open(invoker);
  };

  defaultOptions = () => {
    const { player } = this;
    const { config } = player;

    if (!config.layoutControls.contextMenu.controls) {
      return;
    }

    this.play = this.createItem(config.captions.play, 'play');
    on.call(player, this.play, 'click', player.playPause.toggle);
    this.list.appendChild(this.play);

    this.mute = this.createItem(config.captions.mute, 'volume');
    on.call(player, this.mute, 'click', player.toggleMute);
    this.list.appendChild(this.mute);

    this.shortcuts = this.createItem(config.captions.shortcuts.title, 'shortcuts');
    on.call(player, this.shortcuts, 'click', (event) => {
      event.stopPropagation();
      this.openShortcuts();
    });
    this.list.appendChild(this.shortcuts);

    this.fs = this.createItem(config.captions.fullscreen, 'fullscreen');
    on.call(player, this.fs, 'click', player.fullscreen.toggle);
    this.list.appendChild(this.fs);
  };
}

export default ContextMenu;
