import { IS_ANDROID, IS_FIREFOX, IS_IOS, IS_SAFARI } from './utils/browser';
import is from './utils/is';

class Fps {
    constructor(player) {
        this.player = player;
        this.interval = null;
        this.update = 0.3;
        this.current = 0;
        this.count = 0;
        this.total = 0;
        this.attempt = 0;
        this.regularAttempt = 0;
        this.stop = false;
    }

    calc = (totalVideoFrames) => {
        const { player } = this;
        const previous = this.current;

        this.current = (totalVideoFrames - this.count) / this.update;
        this.current /= player.speed;
        this.count = totalVideoFrames;
        if (this.current === 0) {
            return;
        }
        this.total += this.current;
        this.attempt++;

        if (previous === this.current) {
            this.regularAttempt++;
        } else {
            this.regularAttempt = 0;
        }

        if (player.debug) {
            player.debug.log(`
                averageFPS: ${Math.round(this.total / this.attempt)},
                currentFrameRate: ${this.current},
                previousFrameRate: ${previous},
                currentFrameCount: ${this.count},
                countCheckFPS: ${this.attempt},
            `);
        }

        if (this.regularAttempt === 3) {
            clearInterval(this.interval);
            this.stop = true;
        } else if (this.attempt === 15) {
            this.current = this.total / this.attempt;
            clearInterval(this.interval);
            this.stop = true;
        }

        if (player.paused) {
            this.current = this.total / this.attempt;
            clearInterval(this.interval);
        }
    };

    check = () => {
        const { player } = this;

        if (player.isCurrentlyPlayingAd) {
            return;
        }

        clearInterval(this.interval);

        if (this.stop || (IS_ANDROID && IS_FIREFOX) || (IS_IOS && IS_SAFARI)) {
            return;
        }

        this.interval = setInterval(() => {
            const video = player.media;

            if (
                is.function(video.getVideoPlaybackQuality) &&
                is.number(video.getVideoPlaybackQuality().totalVideoFrames)
            ) {
                this.calc(video.getVideoPlaybackQuality().totalVideoFrames);
            } else if (is.number(video.webkitDecodedFrameCount)) {
                this.calc(video.webkitDecodedFrameCount);
            } else {
                this.stop = true;
                clearInterval(this.interval);
                player.debug.log('The browser does not support webkitDecodedFrameCount.');
            }
        }, this.update * 1000);
    };
}

export default Fps;
