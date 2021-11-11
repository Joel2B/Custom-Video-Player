import { createElement, insertAfter, toggleClass } from './utils/dom';
import { on } from './utils/events';

class Shortcuts {
    constructor(player) {
        this.player = player;

        this.setShortcuts();
        this.create();
    }

    create = () => {
        this.content = createElement('div', {
            class: 'cvp_keyboard_shortcuts',
        });

        const close = createElement('div', {
            class: 'cvp_hide_shortcuts',
        });
        on.call(this.player, close, 'click', () => this.close());

        close.appendChild(createElement('span', null, 'x'));
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
        this.shortcuts = [
            [
                {
                    class: 'cvp_long_btn',
                    text: 'Space',
                },
                {
                    text: 'Reproducir / Pausa',
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
                    text: 'Salto 5 segundos',
                },
            ],
            [
                {
                    class: 'cvp_short_btn',
                    text: 'Inicio',
                },
                {
                    text: 'Ir al comienzo del video',
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
                    text: 'Ir del 0% al 90% de la duración del video',
                },
            ],
            [
                {
                    class: 'cvp_short_btn',
                    text: 'Fin',
                },
                {
                    text: 'Ir al final del video',
                },
            ],
            [
                {
                    class: 'cvp_short_btn',
                    text: 'F',
                },
                {
                    text: 'Alternar pantalla completa',
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
                    text: '-1 / +1 fotograma',
                },
            ],
            [
                {
                    class: 'cvp_short_btn',
                    text: 'M',
                },
                {
                    text: 'Silencio / Desactivar Silencio',
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
                    text: 'Volumen arriba / abajo',
                },
            ],
            [
                {
                    class: 'cvp_short_btn',
                    text: 'T',
                },
                {
                    text: 'Alternar modo teatro',
                },
            ],
        ];
    };
}

export default Shortcuts;
