export default function(self, options) {
    self.onKeyboardSeekPosition = (keyCode) => {
        if (self.isCurrentlyPlayingAd) {
            return;
        }

        self.domRef.player.currentTime = self.getNewCurrentTimeValueByKeyCode(
            keyCode,
            self.domRef.player.currentTime,
            self.domRef.player.duration,
        );
    };

    self.getNewCurrentTimeValueByKeyCode = (keyCode, currentTime, duration) => {
        let fps = self.fps.current;
        fps = fps !== 0 ? fps : 29.97;
        let newCurrentTime = currentTime;
        const frame = currentTime * fps + 0.00001;

        switch (keyCode) {
            case 37:// left arrow
                newCurrentTime -= 5;
                newCurrentTime = (newCurrentTime > 0) ? newCurrentTime : 0;
                break;
            case 39:// right arrow
                newCurrentTime += 5;
                newCurrentTime = (newCurrentTime < duration) ? newCurrentTime : duration;
                break;
            case 35:// End
                newCurrentTime = duration;
                break;
            case 36:// Home
                newCurrentTime = 0;
                break;
            case 48:// 0
            case 49:// 1
            case 50:// 2
            case 51:// 3
            case 52:// 4
            case 53:// 5
            case 54:// 6
            case 55:// 7
            case 56:// 8
            case 57:// 9
                if (keyCode < 58 && keyCode > 47) {
                    const percent = (keyCode - 48) * 10;
                    newCurrentTime = duration * percent / 100;
                }
                break;
            case 188: // ,
                newCurrentTime = (frame - 1) / fps;
                newCurrentTime = newCurrentTime > 0 ? newCurrentTime : 0;
                break;
            case 190:// .
                newCurrentTime = (frame + 1) / fps;
                newCurrentTime = newCurrentTime < duration ? newCurrentTime : duration;
                break;
        }

        if (process.env.NODE_ENV === 'development' && (keyCode === 188 || keyCode === 190)) {
            console.log(`
                key: ( ${keyCode === 188 ? ',' : '.'} ),
                current frame: ${frame + (keyCode === 188 ? -1 : 1)},
                currentFrameRate: ${fps},
                applied currentTime: ${newCurrentTime}
                previous currentTime: ${currentTime}
            `);
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
