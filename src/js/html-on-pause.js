import { createElement, toggleClass } from './utils/dom';
import { on } from './utils/events';

class HtmlOnPause {
  constructor(player) {
    this.player = player;
    this.loaded = false;
    this.init();
  }

  init = () => {
    this.options = this.player.config.layoutControls.htmlOnPauseBlock;
    if (!this.options.html) {
      return;
    }

    this.createHtmlBlock();
  };

  setHtmlOnPauseBlock = (passedHtml) => {
    if (!passedHtml || typeof passedHtml !== 'object' || typeof passedHtml.html === 'undefined') {
      return false;
    }

    this.options = { ...this.options, ...passedHtml };

    // We create the HTML block from scratch if it doesn't already exist
    if (!this.htmlBlock) {
      this.createHtmlBlock();
      return true;
    }

    this.htmlBlock.innerHTML = passedHtml.html;

    if (passedHtml.width) {
      this.htmlBlock.style.width = passedHtml.width + 'px';
    }

    if (passedHtml.height) {
      this.htmlBlock.style.height = passedHtml.height + 'px';
    }

    this.loaded = true;
    return true;
  };

  createHtmlBlock = () => {
    this.htmlBlock = createElement('div', {
      class: 'fluid_html_on_pause hide',
    });
    this.htmlBlock.innerHTML = this.options.html;

    on.call(this.player, this.htmlBlock, 'click', this.player.playPause.toggle);

    if (this.options.width) {
      this.htmlBlock.style.width = this.options.width + 'px';
    }

    if (this.options.height) {
      this.htmlBlock.style.height = this.options.height + 'px';
    }

    this.player.wrapper.appendChild(this.htmlBlock);
    this.loaded = true;
  };

  toggle = (show) => {
    if (!this.loaded) {
      return;
    }

    toggleClass(this.htmlBlock, 'hide', !show);
  };
}

export default HtmlOnPause;
