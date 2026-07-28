import { createElement, insertAfter, toggleClass } from './utils/dom';
import { on } from './utils/events';

class Shortcuts {
  constructor(player) {
    this.player = player;

    this.setShortcuts();
    this.create();
  }

  create = () => {
    const shortcuts = this.player.config.captions.shortcuts;
    this.content = createElement('div', {
      class: 'cvp_keyboard_shortcuts',
      role: 'dialog',
      'aria-modal': true,
      'aria-label': shortcuts.title,
      'aria-hidden': true,
    });

    this.closeButton = createElement('button', {
      type: 'button',
      class: 'cvp_hide_shortcuts',
      'aria-label': shortcuts.close,
    });
    on.call(this.player, this.closeButton, 'click', () => this.close(true));

    this.closeButton.appendChild(createElement('span', null, '×'));
    this.content.appendChild(this.closeButton);

    const container = createElement('div', {
      class: 'cvp_shortcut_info',
    });

    for (const shortcut of this.shortcuts) {
      const wrapper = createElement();
      const len = shortcut.length;
      for (let i = 0; i < len; i++) {
        const element = shortcut[i];
        if (i === len - 1) {
          wrapper.appendChild(createElement('span', null, element.text));
        } else {
          wrapper.appendChild(
            createElement(
              'div',
              {
                class: element.class,
              },
              element.text,
            ),
          );
        }
      }
      container.appendChild(wrapper);
    }
    this.content.appendChild(container);

    on.call(
      this.player,
      this.content,
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.close(true);
          return;
        }

        if (event.key !== 'Tab') {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.closeButton.focus();
      },
      false,
    );

    insertAfter(this.content, this.player.media);
  };

  open = (invoker) => {
    this.invoker = invoker || document.activeElement;
    this.setBackgroundInteractive(false);
    toggleClass(this.content, 'cvp_active', true);
    this.content.setAttribute('aria-hidden', 'false');
    this.closeButton.focus();
  };

  close = (restoreFocus = false) => {
    if (!this.content.classList.contains('cvp_active')) {
      return;
    }

    toggleClass(this.content, 'cvp_active', false);
    this.content.setAttribute('aria-hidden', 'true');
    this.setBackgroundInteractive(true);

    if (restoreFocus) {
      const invoker =
        this.invoker?.isConnected && this.invoker.offsetParent !== null ? this.invoker : this.player.controls.playPause;
      invoker.focus();
    }

    this.invoker = null;
  };

  setBackgroundInteractive = (interactive) => {
    for (const element of this.player.wrapper.children) {
      if (element === this.content) {
        continue;
      }

      if (interactive) {
        if (element.dataset.shortcutsInert !== 'true') {
          element.removeAttribute('inert');
        }
        delete element.dataset.shortcutsInert;
      } else {
        element.dataset.shortcutsInert = String(element.hasAttribute('inert'));
        element.setAttribute('inert', '');
      }
    }
  };

  setShortcuts = () => {
    const shortcuts = this.player.config.captions.shortcuts;
    this.shortcuts = [
      [
        {
          class: 'cvp_long_btn',
          text: shortcuts.space,
        },
        {
          text: shortcuts.playPause,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: '←',
        },
        {
          class: 'cvp_short_btn',
          text: '→',
        },
        {
          text: shortcuts.skip,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: shortcuts.home,
        },
        {
          text: shortcuts.start,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: '0',
        },
        {
          class: 'cvp_short_btn',
          text: '9',
        },
        {
          text: shortcuts.percent,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: shortcuts.end,
        },
        {
          text: shortcuts.finish,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: 'F',
        },
        {
          text: shortcuts.fullscreen,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: ',',
        },
        {
          class: 'cvp_short_btn',
          text: '.',
        },
        {
          text: shortcuts.frame,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: 'M',
        },
        {
          text: shortcuts.mute,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: '↑',
        },
        {
          class: 'cvp_short_btn',
          text: '↓',
        },
        {
          text: shortcuts.volume,
        },
      ],
      [
        {
          class: 'cvp_short_btn',
          text: 'T',
        },
        {
          text: shortcuts.theatre,
        },
      ],
    ];
  };
}

export default Shortcuts;
