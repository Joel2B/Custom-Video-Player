
import Hlsjs from './hls';
import Dash from './dash';

class Streaming {
    constructor(player) {
        this.player = player;
        this.hls = null;
        this.dash = null;
    }

    init = () => {
        const { player } = this;

        this.detach();
        switch (player.config.layoutControls.mediaType) {
            case 'application/dash+xml': // MPEG-DASH
                this.dash = new Dash(player);
                this.dash.load().then((instance) => {
                    this.dash = instance;
                });
                break;
            case 'application/x-mpegurl': // HLS
                this.hls = new Hlsjs(player);
                this.hls.load().then((instance) => {
                    this.hls = instance;
                });
                break;
        }
    };

    detach = () => {
        if (this.dash) {
            this.dash.reset();
            this.dash = null;
        } else if (this.hls) {
            this.hls.detachMedia();
            this.hls = null;
        }
    };
}

export default Streaming;
