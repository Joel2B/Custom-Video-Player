import Hlsjs from './hls';
import Dash from './dash';
import Live from './live';
import { MimetypesKind } from '../utils/mimetypes';

class Streaming {
  constructor(player) {
    this.player = player;

    this.hls = null;
    this.dash = null;
    this.hlsController = null;
    this.dashController = null;
    this.generation = 0;

    this.live = new Live(player);
  }

  init = () => {
    const { player } = this;
    const generation = ++this.generation;

    const initController = (controller, type) => {
      controller
        .load()
        .then(() => {
          if (generation !== this.generation) {
            return;
          }

          const instance = controller.init() || null;

          if (generation === this.generation) {
            this[type] = instance;
          } else {
            controller.detach();
          }
        })
        .catch((error) => {
          player.debug.error(error);

          if (generation === this.generation && player.ready) {
            controller.detach();
            player.nextSource();
          }
        });
    };

    switch (player.currentSource.type) {
      case MimetypesKind.mpd:
        this.dashController = new Dash(player);
        initController(this.dashController, 'dash');

        break;
      case MimetypesKind.m3u8:
      case MimetypesKind.m3u8_2:
        this.hlsController = new Hlsjs(player);
        initController(this.hlsController, 'hls');

        break;
    }
  };

  detach = () => {
    this.generation++;

    this.dashController?.detach();
    this.hlsController?.detach();

    this.dashController = null;
    this.hlsController = null;
    this.dash = null;
    this.hls = null;

    this.live.destroy();
  };
}

export default Streaming;
