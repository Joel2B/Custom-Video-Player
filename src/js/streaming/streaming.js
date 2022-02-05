import Hlsjs from './hls';
import Dash from './dash';
import Live from './live';

class Streaming {
    constructor(player) {
        this.player = player;

        this.hls = null;
        this.dash = null;

        this.live = new Live(player);
    }

    init = () => {
        const { player } = this;

        switch (player.currentSource.type) {
            case 'application/dash+xml':
                this.dash = new Dash(player);

                this.dash.load().then(() => {
                    this.dash = this.dash.init();
                });

                break;
            case 'application/x-mpegURL':
                this.hls = new Hlsjs(player);

                this.hls.load().then(() => {
                    this.hls = this.hls.init();
                });

                break;
        }
    };

    detach = () => {
        if (this.dash) {
            this.dash.reset();

            this.dash = null;
        } else if (this.hls) {
            this.hls.stopLoad();
            this.hls.detachMedia();
            this.hls.destroy();

            this.hls = null;
        }

        this.live.destroy();
    };
}

export default Streaming;
