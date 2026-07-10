import { on } from '../utils/events';

class Skip {
  constructor(player) {
    this.player = player;
    this.listeners();
  }

  skip = (period) => {
    const { player } = this;
    let skipTo = player.currentTime + period;
    if (skipTo < 0) {
      skipTo = 0;
    }
    player.currentTime = skipTo;
  };

  listeners = () => {
    const { player } = this;

    const config = player.config.layoutControls.controlForwardRewind;
    on.call(player, player.controls.skipBack, 'click', () => this.skip(-config.rewind));
    on.call(player, player.controls.skipForward, 'click', () => this.skip(config.forward));
  };
}

export default Skip;
