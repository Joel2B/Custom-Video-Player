export default function (self, options) {
    self.checkFPS = (totalVideoFrames) => {
        const previousFrameRate = self.currentFrameRate;
        self.currentFrameRate = (totalVideoFrames - self.currentFrameCount) / self.updateFpsTimer;
        self.currentFrameRate /= self.domRef.player.playbackRate;
        self.currentFrameCount = totalVideoFrames;
        if (self.currentFrameRate == 0) {
            return;
        }
        self.totalFPS += self.currentFrameRate;
        self.countCheckFPS++;

        if (previousFrameRate == self.currentFrameRate) {
            self.countRegularFPS++;
        } else {
            self.countRegularFPS = 0;
        }

        if (process.env.NODE_ENV === 'development') {
            console.log(`
            averageFPS: ${Math.round(self.totalFPS / self.countCheckFPS)},
            currentFrameRate: ${self.currentFrameRate}, 
            previousFrameRate: ${previousFrameRate}, 
            currentFrameCount: ${self.currentFrameCount}, 
            countCheckFPS: ${self.countCheckFPS}, 
            `);
        }

        if (self.countRegularFPS >= 3) {
            clearInterval(self.fpsTimer);
            self.stopCheckFPSInterval = true;
        } else if (self.countCheckFPS >= 15) {
            self.currentFrameRate = self.totalFPS / self.countCheckFPS;
            clearInterval(self.fpsTimer);
            self.stopCheckFPSInterval = true;
        }

        if (self.domRef.player.paused) {
            self.currentFrameRate = self.totalFPS / self.countCheckFPS;
            clearInterval(self.fpsTimer);
        }
    }

    self.checkFPSInterval = () => {
        clearInterval(self.fpsTimer);
        const isFirefoxAndroid = self.mobileInfo.userOs == false
            && self.mobileInfo.userOs === 'Android'
            && browserVersion.browserName === 'Mozilla Firefox';
        const isSafariIOS = self.mobileInfo.userOs !== false
            && self.mobileInfo.userOs === 'IOS'
            && browserVersion.browserName === 'Safari';

        if (self.stopCheckFPSInterval || isFirefoxAndroid || isSafariIOS) {
            return;
        }

        self.fpsTimer = setInterval(() => {
            const video = self.domRef.player;
            if (typeof video.getVideoPlaybackQuality === 'function' &&
                typeof video.getVideoPlaybackQuality().totalVideoFrames === 'number') {
                const videoPlaybackQuality = video.getVideoPlaybackQuality();
                self.checkFPS(videoPlaybackQuality.totalVideoFrames);
            } else if (typeof video.webkitDecodedFrameCount === 'number') {
                self.checkFPS(video.webkitDecodedFrameCount);
            } else {
                console.log('[FP_ERROR] The browser does not support webkitDecodedFrameCount.');
            }
        }, self.updateFpsTimer * 1000);
    };
}