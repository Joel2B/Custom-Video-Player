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

    calc(totalVideoFrames) {
        const previous = this.current;
        this.current = (totalVideoFrames - this.count) / this.update;
        this.current /= this.player.domRef.player.playbackRate;
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

        if (process.env.NODE_ENV === 'development') {
            console.log(`
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

        if (this.player.domRef.player.paused) {
            this.current = this.total / this.attempt;
            clearInterval(this.interval);
        }
    }

    check() {
        if (this.player.isCurrentlyPlayingAd) {
            return;
        }

        clearInterval(this.interval);
        const browserVersion = this.player.getBrowserVersion();
        const mobile = this.player.mobileInfo.userOs;
        const browser = browserVersion.browserName;
        const isFirefoxAndroid = mobile === 'Android' && browser === 'Mozilla Firefox';
        const isSafariIOS = mobile === 'IOS' && browser === 'Safari';

        if (this.stop || isFirefoxAndroid || isSafariIOS) {
            return;
        }

        this.interval = setInterval(() => {
            const video = this.player.domRef.player;
            if (
                typeof video.getVideoPlaybackQuality === 'function' &&
                typeof video.getVideoPlaybackQuality().totalVideoFrames === 'number'
            ) {
                this.calc(video.getVideoPlaybackQuality().totalVideoFrames);
            } else if (typeof video.webkitDecodedFrameCount === 'number') {
                this.calc(video.webkitDecodedFrameCount);
            } else {
                console.log('[FP_ERROR] The browser does not support webkitDecodedFrameCount.');
            }
        }, this.update * 1000);
    }
}

export default Fps;
