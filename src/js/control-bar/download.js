import { createElement } from '../utils/dom';
import { on } from '../utils/events';

class Download {
  constructor(player) {
    this.player = player;

    this.init();
  }

  init = () => {
    const { player } = this;

    if (!player.config.layoutControls.allowDownload) {
      return;
    }

    player.controls.download.style.display = 'inline-block';

    this.listeners();
  };

  listeners = () => {
    const { player } = this;

    on.call(player, player.controls.download, 'click', () => {
      const link = createElement('a');
      link.download = player.currentSource.src;
      link.href = player.currentSource.src;
      link.target = '_blank';
      link.click();
    });
  };
}

export default Download;
