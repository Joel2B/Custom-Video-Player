import { createElement, toggleClass } from './utils/dom';
import { on } from './utils/events';
import is from './utils/is';

class Logo {
  constructor(player) {
    this.player = player;
    this.init();
  }

  init = () => {
    this.config = this.player.config.layoutControls.logo;

    if (!this.config.imageUrl) {
      return;
    }

    this.create();
    this.setup();
  };

  create = () => {
    const { config } = this;

    // Container for the logo
    this.el = createElement('div');

    const className = config.hideWithControls ? 'logo_maintain_display' : 'initial_controls_show';
    toggleClass(this.el, className, true);

    // The logo itself
    this.img = createElement('img', {
      src: config.imageUrl,
    });
  };

  setup = () => {
    const { player, config, img } = this;

    img.style.width = config.width;
    img.style.height = config.height;
    img.style.position = 'absolute';
    img.style.margin = config.imageMargin;

    const position = config.position.toLowerCase();

    if (position.indexOf('bottom') !== -1) {
      img.style.bottom = 0;
    } else {
      img.style.top = 0;
    }

    if (position.indexOf('right') !== -1) {
      img.style.right = 0;
    } else {
      img.style.left = 0;
    }

    if (config.opacity) {
      img.style.opacity = config.opacity;
    }

    if (!is.empty(config.clickUrl)) {
      img.style.cursor = 'pointer';

      on.call(player, img, 'click', () => {
        window.open(config.clickUrl, '_blank').focus();
      });
    }

    // If a mouseOverImage is provided then we must set up the listeners for it
    if (config.mouseOverImageUrl) {
      on.call(player, img, 'mouseover', () => {
        img.src = config.mouseOverImageUrl;
      });
      on.call(player, img, 'mouseout', () => {
        img.src = config.imageUrl;
      });
    }

    this.el.appendChild(img);
    player.wrapper.appendChild(this.el);
  };
}

export default Logo;
