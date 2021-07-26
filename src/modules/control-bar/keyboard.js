export default function (self, options) {
    self.onKeyboardSeekPosition = (keyCode) => {
        if (self.isCurrentlyPlayingAd) {
            return;
        }

        self.domRef.player.currentTime = self.getNewCurrentTimeValueByKeyCode(
            keyCode,
            self.domRef.player.currentTime,
            self.domRef.player.duration
        );
    };

    self.getNewCurrentTimeValueByKeyCode = (keyCode, currentTime, duration) => {
        self.currentFrameRate = Math.round(self.currentFrameRate != 0 ? self.currentFrameRate : 24);
        let newCurrentTime = currentTime;
        let frameTime = 1 / self.currentFrameRate;
        let frame = Math.floor(Number(newCurrentTime.toFixed(5)) * self.currentFrameRate);

        switch (keyCode) {
            case 37://left arrow
                newCurrentTime -= 5;
                newCurrentTime = (newCurrentTime < 5) ? 0 : newCurrentTime;
                break;
            case 39://right arrow
                newCurrentTime += 5;
                newCurrentTime = (newCurrentTime > duration - 5) ? duration : newCurrentTime;
                break;
            case 35://End
                newCurrentTime = duration;
                break;
            case 36://Home
                newCurrentTime = 0;
                break;
            case 48://0
            case 49://1
            case 50://2
            case 51://3
            case 52://4
            case 53://5
            case 54://6
            case 55://7
            case 56://8
            case 57://9
                if (keyCode < 58 && keyCode > 47) {
                    const percent = (keyCode - 48) * 10;
                    newCurrentTime = duration * percent / 100;
                }
                break;
            case 188: // ,
                newCurrentTime -= frameTime;
                newCurrentTime = newCurrentTime < frameTime ? 0 : newCurrentTime;
                break;
            case 190:// .
                newCurrentTime += frameTime;
                newCurrentTime = newCurrentTime > duration - frameTime ? duration : newCurrentTime;
                break;
        }

        if (options.development && (keyCode == 188 || keyCode == 190)) {
            console.log(`
            key: ( ${keyCode == 188 ? ',' : '.'} ),
            current frame: ${frame},
            currentFrameRate: ${self.currentFrameRate},
            currentTime: ${currentTime}, 
            seekBackward: ${((frame - 1) / self.currentFrameRate) + 0.00001}, 
            seekForward: ${((frame + 1) / self.currentFrameRate) + 0.00001},
            applied currentTime: ${newCurrentTime}`);
        }

        return newCurrentTime;
    };

    self.keyboardControl = () => {
        self.domRef.wrapper.addEventListener('click', self.handleMouseenterForKeyboard, false);

        // When we click outside player, we stop registering keyboard events
        const clickHandler = self.handleWindowClick.bind(self);

        self.destructors.push(() => {
            window.removeEventListener('click', clickHandler);
        });

        window.addEventListener('click', clickHandler);
    };
}