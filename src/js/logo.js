import { createElement, toggleClass } from './utils/dom';
import { on } from './utils/events';
import is from './utils/is';
import { getHttpsUrl } from './utils/url';

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
      alt: config.alt || (!is.empty(config.clickUrl) ? this.player.config.captions.logo : ''),
    });
  };

  setup = () => {
    const { player, config, img } = this;
    const url = getHttpsUrl(config.clickUrl);

    if (url) {
      this.link = createElement('a', {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
    }

    const positionedElement = this.link || img;

    img.style.width = config.width;
    img.style.height = config.height;
    img.style.display = 'block';
    positionedElement.style.position = 'absolute';
    positionedElement.style.margin = config.imageMargin;

    const position = config.position.toLowerCase();

    if (position.indexOf('bottom') !== -1) {
      positionedElement.style.bottom = 0;
    } else {
      positionedElement.style.top = 0;
    }

    if (position.indexOf('right') !== -1) {
      positionedElement.style.right = 0;
    } else {
      positionedElement.style.left = 0;
    }

    if (config.opacity) {
      img.style.opacity = config.opacity;
    }

    if (this.link) {
      img.style.cursor = 'pointer';
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

    if (this.link) {
      this.link.appendChild(img);
      this.el.appendChild(this.link);
    } else {
      this.el.appendChild(img);
    }
    player.wrapper.appendChild(this.el);
  };
}

export default Logo;
