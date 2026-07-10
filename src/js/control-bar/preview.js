import PreviewThumbnails from './preview-thumbnails';
import PreviewTime from './preview-time';

class Preview {
  constructor(player) {
    this.player = player;
    this.init();
  }

  init = () => {
    const { player } = this;

    this.current = new PreviewThumbnails(player);
    this.current
      .init()
      .catch((error) => player.debug.error(error))
      .finally(() => {
        if (!this.current.loaded) {
          this.current = new PreviewTime(player);
        }
      });
  };
}

export default Preview;
