import { createElement, hasClass, insertAfter, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import is from '../utils/is';

class Menu {
    constructor(player) {
        this.player = player;
        this.inSubpage = false;
        this.modules = [];

        this.defaultSize = {
            width: 185,
            height: 28,
        };

        this.width = this.defaultSize.width;
        this.height = this.defaultSize.height;

        this.item = {
            height: 26,
            width: 0,
        };

        this.option = {
            height: 27,
            width: 0,
        };

        this.ready = false;
    }

    init = () => {
        if (this.modules.length === 0) {
            return;
        }

        this.height += this.option.height * this.modules.length;

        this.createMenu();
        this.listeners();

        this.ready = true;
    };

    createMenu = () => {
        // Right container -> Menu
        this.menu = createElement('div', {
            class: 'cvp_options_menu',
        });

        // Right container -> Menu -> background
        this.background = createElement('div', {
            class: 'cvp_background cvp_animated',
            style: `width: ${this.width}px; height: ${this.height}px;`,
        });
        this.menu.appendChild(this.background);

        // Right container -> Menu -> background -> page
        this.page = createElement('div', {
            class: 'cvp_main_page',
            style: `width: ${this.width}px; height: ${this.height}px;`,
        });

        this.background.appendChild(this.page);

        // Right container -> Menu -> background -> page -> header
        this.page.appendChild(
            createElement('div', {
                class: 'cvp_header',
            }),
        );

        // Right container -> Menu -> background -> page -> icon
        this.page.appendChild(
            createElement('div', {
                class: 'cvp_icon',
            }),
        );

        // Right container -> Menu -> background -> page -> container
        this.container = createElement('ul', {
            class: 'cvp_switches',
        });
        this.page.appendChild(this.container);

        // Right container -> Menu -> background -> subpages
        this.subPage = createElement('div', {
            class: 'cvp_sub_page',
        });

        this.background.appendChild(this.subPage);

        // Right container -> Menu -> background -> subpages -> header
        this.header = createElement('div', {
            class: 'cvp_header',
        });

        // Right container -> Menu -> background -> subpages -> content
        this.content = createElement('div', {
            class: 'cvp_content',
        });

        this.subPage.appendChild(this.header);
        this.subPage.appendChild(this.content);

        for (const module of this.modules) {
            this.render(module);
        }

        // Right container -> Main menu button
        this.btn = createElement('div', {
            class: 'fluid_button fluid_button_main_menu',
        });

        this.player.controls.rightContainer.insertBefore(this.btn, this.player.controls.rightContainer.firstChild);
        this.player.wrapper.appendChild(this.menu);
    };

    add = (module) => {
        this.modules.push(module);

        // render modules after menu rendering
        if (this.ready) {
            this.render(module);
        }
    };

    render = (module) => {
        // indicate the position of the module in the menu
        if (this.ready && is.string(module.position)) {
            const data = module.position.split('#');
            const position = data[0];
            let index = Number(data[1]);
            const len = this.container.childNodes.length;

            if (len === 0) {
                this.container.appendChild(module.item);
            } else {
                if (position === 'last') {
                    index = len - 1 - index;
                }

                if (index < 0) {
                    // insert up to the top
                    this.container.insertBefore(module.item, this.container.firstChild);
                } else {
                    insertAfter(module.item, this.container.childNodes[index]);
                }
            }

            this.height += this.option.height;

            this.restart();
        } else {
            this.container.appendChild(module.item);
        }

        if (module.field === 'selector') {
            this.content.appendChild(module.content);
        }
    };

    remove = (module) => {
        if (!this.isEnabled(module)) {
            return;
        }

        const index = this.modules.findIndex((item) => item.id === module);

        if (index === -1) {
            return;
        }

        this.modules[index].item.remove();

        this.modules.splice(index, 1);

        this.height -= this.option.height;

        this.restart();
    };

    isEnabled = (module) => {
        return this.player.config.layoutControls.menu[module];
    };

    openSubMenu = (option, subPage, width, height) => {
        toggleClass(subPage, 'hide', false);
        toggleClass(this.menu, 'cvp_level2');

        this.background.style.width = `${width}px`;
        this.background.style.height = `${height}px`;

        this.header.textContent = option.firstChild.textContent;

        this.inSubpage = true;
    };

    restart = () => {
        this.background.style.width = `${this.width}px`;
        this.background.style.height = `${this.height}px`;

        this.page.style.width = `${this.width}px`;
        this.page.style.height = `${this.height}px`;

        toggleClass(this.menu, 'cvp_level2', false);

        for (const module of this.modules) {
            if (module.field !== 'selector') {
                continue;
            }

            toggleClass(module.content, 'hide', true);
        }
    };

    restartLater = () => {
        setTimeout(() => {
            this.restart();
        }, 250);
    };

    isClosed = () => {
        return !hasClass(this.menu, 'cvp_visible');
    };

    close = () => {
        if (!this.menu || this.isClosed()) {
            return;
        }

        toggleClass(this.menu, 'cvp_visible', false);
        toggleClass(this.btn, 'cvp_rotate', false);

        this.inSubpage = false;

        this.restartLater();
    };

    listeners = () => {
        on.call(this.player, this.btn, 'click', () => {
            if (this.player.isCurrentlyPlayingAd) {
                return;
            }

            if (this.isClosed()) {
                toggleClass(this.menu, 'cvp_visible', true);
                toggleClass(this.btn, 'cvp_rotate', true);
            } else {
                this.close();
            }
        });

        on.call(this.player, this.header, 'click', () => {
            this.inSubpage = false;

            this.restart();
        });
    };
}

export default Menu;
