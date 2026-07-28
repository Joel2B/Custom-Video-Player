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
    this.restartTimer = null;
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
      'aria-hidden': true,
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
      createElement(
        'div',
        {
          class: 'cvp_header',
        },
        this.player.config.captions.settings,
      ),
    );

    // Right container -> Menu -> background -> page -> icon
    this.page.appendChild(
      createElement('div', {
        class: 'fluid_icon fluid_icon_settings',
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
      role: 'button',
      tabindex: 0,
      'aria-label': this.player.config.captions.backToSettings,
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

    if (this.player.mobile) {
      on.call(this.player, this.page, 'touchend', (event) => {
        if (this.container.contains(event.target)) {
          return;
        }

        this.close();
      });

      this.options = createElement('div', {
        class: 'fluid_options',
      });

      this.optionsBtn = createElement('button', {
        type: 'button',
        class: 'fluid_options_btn',
        'aria-label': this.player.config.captions.settings,
        'aria-expanded': false,
      });

      this.openBtn = createElement('div', {
        class: 'fluid_icon fluid_icon_open_settings fluid_mobile_main_menu',
      });

      this.closeBtn = createElement('div', {
        class: 'fluid_icon fluid_icon_close_settings fluid_mobile_close_main_menu',
      });

      this.optionsBtn.appendChild(this.openBtn);
      this.optionsBtn.appendChild(this.closeBtn);
      this.options.appendChild(this.optionsBtn);

      this.btn = this.optionsBtn;

      this.player.wrapper.appendChild(this.options);
    } else {
      // Right container -> Main menu button
      this.btn = createElement('button', {
        type: 'button',
        class: 'fluid_button fluid_button_main_menu',
        'aria-label': this.player.config.captions.settings,
        'aria-expanded': false,
      });

      this.menuTooltip = createElement(
        'div',
        {
          class: 'fluid_button_tooltip',
        },
        this.player.config.captions.settings,
      );

      this.btn.appendChild(this.menuTooltip);
      this.player.controls.rightContainer.insertBefore(this.btn, this.player.controls.rightContainer.firstChild);
    }

    this.player.wrapper.appendChild(this.menu);
    this.setInteractive(false);
  };

  setInteractive = (interactive) => {
    if (interactive) {
      this.menu.removeAttribute('inert');
    } else {
      this.menu.setAttribute('inert', '');
    }

    for (const element of this.menu.querySelectorAll('[tabindex], button, a[href], input, select, textarea')) {
      if (interactive) {
        const tabindex = element.dataset.menuTabindex;
        if (!is.nullOrUndefined(tabindex)) {
          if (element.dataset.menuNativeTabindex === 'true') {
            element.removeAttribute('tabindex');
            delete element.dataset.menuNativeTabindex;
          } else {
            element.setAttribute('tabindex', tabindex);
          }
          delete element.dataset.menuTabindex;
        }
      } else {
        if (is.nullOrUndefined(element.dataset.menuTabindex)) {
          element.dataset.menuTabindex = element.getAttribute('tabindex') || '';
          element.dataset.menuNativeTabindex = String(!element.hasAttribute('tabindex'));
        }
        element.setAttribute('tabindex', '-1');
      }
    }
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

    if (module.item.matches('[role="button"], [role="switch"]')) {
      on.call(this.player, module.item, 'keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        event.preventDefault();
        module.item.click();
      });
    }

    if (this.ready && this.isClosed()) {
      this.setInteractive(false);
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
    toggleClass(this.menu, 'cvp_level2', true);

    this.background.style.width = `${width}px`;
    this.background.style.height = `${height}px`;

    this.header.textContent = option.firstChild.nextSibling.textContent;

    this.inSubpage = true;
    option.setAttribute('aria-expanded', 'true');
    subPage.setAttribute('role', 'listbox');

    for (const item of subPage.querySelectorAll('li')) {
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-selected', String(hasClass(item, 'cvp_active')));
    }
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
      module.item.setAttribute('aria-expanded', 'false');
    }
  };

  restartLater = () => {
    clearTimeout(this.restartTimer);

    this.restartTimer = setTimeout(() => {
      this.restart();
    }, 250);
  };

  destroy = () => {
    clearTimeout(this.restartTimer);
  };

  isClosed = () => {
    return !hasClass(this.menu, 'cvp_visible');
  };

  close = (restoreFocus = false) => {
    if (!this.menu || this.isClosed()) {
      return;
    }

    toggleClass(this.menu, 'cvp_visible', false);
    this.menu.setAttribute('aria-hidden', 'true');
    this.btn.setAttribute('aria-expanded', 'false');
    this.setInteractive(false);

    if (this.player.mobile) {
      this.player.controlBar.toggleMobile(this.player.paused);
      toggleClass(this.player.wrapper, 'fluid_show_options', false);
    } else {
      toggleClass(this.btn, 'cvp_rotate', false);
    }

    this.inSubpage = false;

    this.restartLater();

    if (restoreFocus) {
      this.btn.focus();
    }
  };

  listeners = () => {
    const event = this.player.mobile ? 'touchend' : 'click';

    on.call(this.player, this.btn, event, (inputEvent) => {
      if (this.isClosed()) {
        toggleClass(this.menu, 'cvp_visible', true);
        this.menu.setAttribute('aria-hidden', 'false');
        this.btn.setAttribute('aria-expanded', 'true');
        this.setInteractive(true);

        if (this.player.mobile) {
          this.player.controlBar.toggleMobile();
          toggleClass(this.player.wrapper, 'fluid_show_options', true);
        } else {
          toggleClass(this.btn, 'cvp_rotate', true);
        }

        if (inputEvent.detail === 0) {
          this.container.querySelector('[tabindex="0"]')?.focus();
        }
      } else {
        this.close();
      }
    });

    on.call(this.player, this.header, event, () => {
      this.inSubpage = false;

      this.restart();
    });

    on.call(this.player, this.header, 'keydown', (keyboardEvent) => {
      if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') {
        return;
      }

      keyboardEvent.preventDefault();
      this.header.click();
    });

    on.call(this.player, this.content, 'click', (clickEvent) => {
      if (clickEvent.target.tagName !== 'LI') {
        return;
      }

      for (const item of clickEvent.target.parentNode.querySelectorAll('li')) {
        item.setAttribute('aria-selected', String(hasClass(item, 'cvp_active')));
      }
    });

    on.call(this.player, this.content, 'keydown', (keyboardEvent) => {
      const item = keyboardEvent.target;
      if (item.tagName !== 'LI') {
        return;
      }

      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault();
        item.click();
        return;
      }

      if (keyboardEvent.key !== 'ArrowDown' && keyboardEvent.key !== 'ArrowUp') {
        return;
      }

      keyboardEvent.preventDefault();
      const items = Array.from(item.parentNode.querySelectorAll('li'));
      const offset = keyboardEvent.key === 'ArrowDown' ? 1 : -1;
      items[(items.indexOf(item) + offset + items.length) % items.length].focus();
    });

    on.call(this.player, this.menu, 'keydown', (keyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') {
        return;
      }

      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.close(true);
    });
  };
}

export default Menu;
