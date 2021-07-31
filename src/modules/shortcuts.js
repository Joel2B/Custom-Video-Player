export default function (self) {
    self.insertShortcuts = () => {
        self.domRef.controls.shortcuts = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_keyboard_shortcuts',
            className: 'cvp_keyboardShortcuts',
            childs: [
                {
                    tag: 'div',
                    className: 'cvp_hideShortcuts',
                    childs: [
                        {
                            tag: 'span',
                            textContent: '×'
                        }
                    ]
                },
                {
                    tag: 'div',
                    className: 'cvp_shortcutInfo',
                    childs: [
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_longBtn',
                                    textContent: 'Space'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Reproducir / Pausa'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: '←'
                                },
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: '→'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Salto 5 segundos'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: 'Inicio'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Ir al comienzo del video'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: '0'
                                },
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: '9'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Ir del 0% al 90% de la duración del video'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: 'Fin'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Ir al final del video'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: 'F'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Alternar pantalla completa'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: ','
                                },
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: '.'
                                },
                                {
                                    tag: 'span',
                                    textContent: '-1 / +1 fotograma'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: 'M'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Silencio / Desactivar Silencio'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: '↑'
                                },
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: '↓'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Volumen arriba / abajo'
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            childs: [
                                {
                                    tag: 'div',
                                    className: 'cvp_shortBtn',
                                    textContent: 'T'
                                },
                                {
                                    tag: 'span',
                                    textContent: 'Alternar modo teatro'
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        self.domRef.player.parentNode.insertBefore(self.domRef.controls.shortcuts, null);
    };

    self.openShortcuts = () => {
        self.domRef.controls.shortcuts.classList.add('cvp_active');
    };

    self.closeShortcuts = () => {
        self.domRef.controls.shortcuts.classList.remove('cvp_active');
    };

    self.setupShortcuts = () => {
        self.insertShortcuts();
        const close = self.domRef.controls.shortcuts.querySelector('.cvp_hideShortcuts');
        close.addEventListener('click', () => {
            self.closeShortcuts();
        })
    };
}