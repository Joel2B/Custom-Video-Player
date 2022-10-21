import { off, on } from '../utils/events';
import is from '../utils/is';

class Keyboard {
  constructor(player) {
    this.player = player;
  }

  onKeyboardSeekPosition = (keyCode) => {
    const { player } = this;
    if (player.isCurrentlyPlayingAd) {
      return;
    }

    player.currentTime = this.getNewCurrentTimeValueByKeyCode(keyCode, player.currentTime, player.duration);
  };

  getNewCurrentTimeValueByKeyCode = (keyCode, currentTime, duration) => {
    const { player } = this;

    let fps = player.fps.current;
    fps = fps !== 0 ? fps : 29.97;
    const frame = currentTime * fps + 0.00001;

    let newCurrentTime = currentTime;

    switch (keyCode) {
      case 37: // left arrow
        newCurrentTime -= 5;
        newCurrentTime = newCurrentTime > 0 ? newCurrentTime : 0;
        break;
      case 39: // right arrow
        newCurrentTime += 5;
        newCurrentTime = newCurrentTime < duration ? newCurrentTime : duration;
        break;
      case 35: // End
        newCurrentTime = duration;
        break;
      case 36: // Home
        newCurrentTime = 0;
        break;
      case 48: // 0
      case 49: // 1
      case 50: // 2
      case 51: // 3
      case 52: // 4
      case 53: // 5
      case 54: // 6
      case 55: // 7
      case 56: // 8
      case 57: // 9
        if (keyCode < 58 && keyCode > 47) {
          const percent = (keyCode - 48) * 10;
          newCurrentTime = (duration * percent) / 100;
        }
        break;
      case 188: // ,
        newCurrentTime = (frame - 1) / fps;
        newCurrentTime = newCurrentTime > 0 ? newCurrentTime : 0;
        break;
      case 190: // .
        newCurrentTime = (frame + 1) / fps;
        newCurrentTime = newCurrentTime < duration ? newCurrentTime : duration;
        break;
    }

    if (keyCode === 188 || keyCode === 190) {
      player.debug.log(`
                key: ( ${keyCode === 188 ? ',' : '.'} ),
                current frame: ${frame + (keyCode === 188 ? -1 : 1)},
                currentFrameRate: ${fps},
                applied currentTime: ${newCurrentTime}
                previous currentTime: ${currentTime}
            `);
    }

    return newCurrentTime;
  };

  onKeyboardVolumeChange = (direction) => {
    const { player } = this;

    let volume = player.volume;
    if (direction === 'asc') {
      volume += 0.05;
    } else if (direction === 'desc') {
      volume -= 0.05;
    }

    if (volume < 0.05) {
      volume = 0;
      player.muted = true;
    } else if (volume > 0.95) {
      volume = 1;
    }

    if (player.muted && volume > 0) {
      player.muted = false;
    }

    player.volumeControl.setVolume(volume);
  };

  captureKey = (event) => {
    const { player } = this;

    player.shortcuts.close();

    const code = event.keyCode ? event.keyCode : event.which;

    // Bail if a modifier key is set
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    // If the event is bubbled from the media element
    // Firefox doesn't get the keycode for whatever reason
    if (!is.number(code)) {
      return;
    }

    // Which keycodes should we prevent default
    const preventDefault = [
      70, 84, 13, 32, 75, 77, 38, 40, 37, 39, 35, 36, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 188, 190,
    ];

    // If the code is found prevent default (e.g. prevent scrolling for arrows)
    if (preventDefault.includes(code)) {
      event.preventDefault();
      event.stopPropagation();
    }

    switch (code) {
      case 70: // f
        player.fullscreen.toggle();
        break;
      case 84: // t
        player.theatre.toggle();
        break;
      case 13: // Enter
      case 32: // Space
      case 75: // k
        player.playPause.toggle();
        break;
      case 77: // m
        player.toggleMute();
        break;
      case 38: // up arrow
        this.onKeyboardVolumeChange('asc');
        break;
      case 40: // down arrow
        this.onKeyboardVolumeChange('desc');
        break;
      case 37: // left arrow
      case 39: // right arrow
      case 35: // End
      case 36: // Home
      case 48: // 0
      case 49: // 1
      case 50: // 2
      case 51: // 3
      case 52: // 4
      case 53: // 5
      case 54: // 6
      case 55: // 7
      case 56: // 8
      case 57: // 9
      case 188: // ,
      case 190: // .
        this.onKeyboardSeekPosition(code);
        break;
    }

    // Escape is handle natively when in full screen
    // So we only need to worry about non native
    if (code === 27 && !player.fullscreen.usingNative && player.fullscreen.active) {
      player.fullscreen.toggle();
    }
  };

  handleWindowClick = (event) => {
    const { player } = this;

    if (!player.wrapper) {
      return;
    }

    const inScopeClick = player.wrapper.contains(event.target) || event.target.id === 'skipHref_' + player.media.id;

    if (inScopeClick) {
      return;
    }

    off.call(player, document, 'keydown', this.captureKey);

    if (player.theatre.active) {
      player.theatre.toggle();
    }
  };

  handleMouseenterForKeyboard = (e) => {
    const { player } = this;

    let clickedMenuButton = false;
    let menu = player.menu.btn;

    if (player.mobile) {
      menu = player.menu.optionsBtn;
    }

    if (menu === e.target) {
      clickedMenuButton = true;
    }

    if (!clickedMenuButton && player.menu.menu && !player.menu.menu.contains(e.target)) {
      player.menu.close();
    }

    if (
      e.target !== player.controls.shortcuts &&
      !player.shortcuts.content.contains(e.target) &&
      !player.contextMenu.menu.contains(e.target)
    ) {
      player.shortcuts.close();
    }

    on.call(player, document, 'keydown', this.captureKey, false);
  };

  listeners = () => {
    const { player } = this;

    const event = player.mobile ? 'touchend' : 'click';

    on.call(player, player.wrapper, event, this.handleMouseenterForKeyboard, false);

    // When we click outside player, we stop registering keyboard events
    on.call(player, window, event, this.handleWindowClick, false);
  };
}

export default Keyboard;
