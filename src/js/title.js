import { createElement } from './utils/dom';
import is from './utils/is';

class Title {
  constructor(player) {
    this.player = player;
    this.title = this.player.config.layoutControls.title;
    this.init();
  }

  init = () => {
    if (is.empty(this.title)) {
      return;
    }
    this.el = createElement(
      'div',
      {
        class: 'fp_title',
      },
      this.title,
    );

    this.player.wrapper.appendChild(this.el);
  };
}

export default Title;
