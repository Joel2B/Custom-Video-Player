
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

    load = () => {
        const { player } = this;

        return new Promise((resolve) => {
            switch (player.currentSource.type) {
                case 'application/dash+xml': // MPEG-DASH
                    this.dash = new Dash(player).load().then(() => {
                        this.dash = null;
                        resolve();
                    });
                    break;
                case 'application/x-mpegURL': // HLS
                    this.hls = new Hlsjs(player).load().then(() => {
                        this.hls = null;
                        resolve();
                    });
                    break;
            }
        });
    }

    init = () => {
        const { player } = this;

        switch (player.currentSource.type) {
            case 'application/dash+xml': // MPEG-DASH
                this.dash = new Dash(player).init();
                break;
            case 'application/x-mpegURL': // HLS
                this.hls = new Hlsjs(player).init();
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
