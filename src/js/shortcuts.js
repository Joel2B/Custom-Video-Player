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
    });

    const close = createElement('button', {
      type: 'button',
      class: 'cvp_hide_shortcuts',
      'aria-label': shortcuts.close,
    });
    on.call(this.player, close, 'click', () => this.close());

    close.appendChild(createElement('span', null, '×'));
    this.content.appendChild(close);

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

    insertAfter(this.content, this.player.media);
  };

  open = () => {
    toggleClass(this.content, 'cvp_active', true);
  };

  close = () => {
    toggleClass(this.content, 'cvp_active', false);
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
