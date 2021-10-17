class Menu {
    constructor(player) {
        this.player = player;
        this.enabledModules = 0;
        this.inSubpage = false;
        this.modules = [];
        this.item = {
            height: 26,
            width: 0,
        };
        this.option = {
            height: 27,
            width: 0,
        };
        this.width = 185;
        this.height = 28;
    }

    init() {
        if (this.totalModules() === 0) {
            return;
        }
        this.height += this.option.height * this.totalModules();
        this.createMenu();
        this.clickMenu();
        this.clickHeader();
    }

    createMenu() {
        // Right container -> Menu
        this.menu = this.player.createElement({
            tag: 'div',
            className: 'cvp_options_menu',
        });

        // Right container -> Menu -> background
        this.background = this.player.createElement({
            tag: 'div',
            className: 'cvp_background cvp_animated',
            style: {
                width: `${this.width}px`,
                height: `${this.height}px`,
            },
            parent: this.menu,
        });

        // Right container -> Menu -> background -> page
        this.page = this.player.createElement({
            tag: 'div',
            className: 'cvp_main_page cvp_alternative',
            style: {
                width: `${this.width}px`,
                height: `${this.height}px`,
            },
            parent: this.background,
        });

        // Right container -> Menu -> background -> header
        this.player.createElement({
            tag: 'div',
            className: 'cvp_header',
            parent: this.page,
        });

        // Right container -> Menu -> background -> icon
        this.player.createElement({
            tag: 'div',
            className: 'cvp_icon',
            parent: this.page,
        });

        // Right container -> Menu -> background -> container
        this.container = this.player.createElement({
            tag: 'ul',
            className: 'cvp_switches',
            parent: this.page,
        });

        // Right container -> Menu -> background -> subpages
        this.subPage = this.player.createElement({
            tag: 'div',
            className: 'cvp_sub_page',
            parent: this.background,
        });

        this.header = this.player.createElement({
            tag: 'div',
            className: 'cvp_header',
        });

        this.content = this.player.createElement({
            tag: 'div',
            className: 'cvp_content',
        });
        this.subPage.appendChild(this.header);
        this.subPage.appendChild(this.content);

        for (const module of this.modules) {
            this.container.appendChild(module.item);
            if (module.field === 'selector') {
                this.content.appendChild(module.content);
            }
        }

        // Right container -> Main menu button
        this.player.createElement({
            tag: 'div',
            className: 'fluid_button fluid_button_main_menu',
            parent: this.player.domRef.controls.rightContainer,
        });

        this.player.domRef.player.parentNode.insertBefore(this.menu, null);
    }

    add(module) {
        this.modules.push(module);
    }

    remove(module) {
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
    }

    isEnabled(module) {
        return this.player.displayOptions.layoutControls.menu[module];
    }

    totalModules() {
        return this.modules.length;
    }

    openSubMenu(option, subPage, width, height) {
        subPage.classList.remove('hide');
        this.menu.classList.toggle('cvp_level2');
        this.background.style.width = `${width}px`;
        this.background.style.height = `${height}px`;
        this.header.textContent = option.firstChild.textContent;
        this.inSubpage = true;
    }

    restart() {
        this.background.style.width = `${this.width}px`;
        this.background.style.height = `${this.height}px`;
        this.page.style.width = `${this.width}px`;
        this.page.style.height = `${this.height}px`;
        this.menu.classList.remove('cvp_level2');

        for (const module of this.modules) {
            if (module.field !== 'selector') {
                continue;
            }
            module.content.classList.add('hide');
        }
    }

    restartLater() {
        setTimeout(() => {
            this.restart();
        }, 250);
    }

    isClosed() {
        return this.menu.className.indexOf('cvp_visible') === -1;
    }

    close() {
        if (!this.menu || this.isClosed()) {
            return;
        }
        this.menu.classList.remove('cvp_visible');
        const settings = this.player.domRef.wrapper.getElementsByClassName('fluid_button_main_menu');
        for (const setting of settings) {
            setting.classList.remove('cvp_rotate');
        }
        this.inSubpage = false;
        this.restartLater();
    }

    clickHeader() {
        this.header.addEventListener('click', () => {
            this.inSubpage = false;
            this.restart();
        });
    }

    clickMenu() {
        this.player.trackEvent(this.player.domRef.player.parentNode, 'click', '.fluid_button_main_menu', () => {
            if (this.player.isCurrentlyPlayingAd) {
                return;
            }
            if (this.isClosed()) {
                const settings = this.player.domRef.wrapper.getElementsByClassName('fluid_button_main_menu');
                for (const setting of settings) {
                    setting.classList.add('cvp_rotate');
                }
                this.menu.classList.add('cvp_visible');
            } else {
                this.close();
            }
        });
    }
}

export default Menu;
