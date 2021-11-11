import { getEventOffsetX, toggleClass } from '../utils/dom';
import { off, on } from '../utils/events';
import is from '../utils/is';

class Volume {
    constructor(player) {
        this.player = player;
        this.latestVolume = 1;
    }

    apply = () => {
        const { player } = this;

        if (player.storage.get('volume') === null) {
            player.storage.set('volume', 1);
        }

        player.volumeControl.setVolume(player.storage.get('volume'));

        if (player.storage.get('mute')) {
            player.toggleMute();
        }
    };

    update = () => {
        const { player } = this;
        const { controls } = player;
        const { scrubberVolumeContainer, scrubberVolume, volume, mute } = controls;
        const cmMute = player.contextMenu.mute;
        const width = volume.clientWidth;

        if (!width) {
            this.waitRendering();
            return;
        }

        if (player.volume !== 0) {
            this.latestVolume = player.volume;
            player.storage.set('mute', false);
        } else {
            player.storage.set('mute', true);
        }

        const notMuted = player.volume && !player.muted;

        toggleClass(mute, 'fluid_button_mute', !notMuted);
        toggleClass(mute, 'fluid_button_volume', notMuted);

        cmMute.innerHTML = player.config.captions[notMuted ? 'mute' : 'unmute'];

        scrubberVolumeContainer.style.width = player.volume * width + 'px';
        scrubberVolume.style.left = player.volume * width - scrubberVolume.clientWidth / 2 + 'px';
    };

    waitRendering = () => {
        const volume = this.player.controls.volume;

        if (is.element(volume) && volume.clientWidth) {
            this.update();
        } else {
            setTimeout(this.waitRendering, 100);
        }
    }

    updateVolume = (positionX) => {
        const { player } = this;
        const width = player.controls.volumeContainer.clientWidth;

        // if (!width) {
        //     return;
        // }

        let newVolume = positionX / width;

        if (newVolume < 0.05) {
            newVolume = 0;
            player.muted = true;
        } else if (newVolume > 0.95) {
            newVolume = 1;
        }

        if (player.muted && newVolume > 0) {
            player.muted = false;
        }

        this.setVolume(newVolume);
    };

    setVolume = (volume) => {
        this.player.volume = volume;

        // If user scrolls to volume 0, we should not store 0 as
        // latest volume - there is a property called "muted" already
        // and storing 0 will break the toggle.
        // In case user scrolls to 0 we assume last volume to be 1
        // for toggle.
        const latestVolume = volume === 0 ? 1 : volume;

        this.latestVolume = latestVolume;
        this.player.storage.set('volume', latestVolume);
    };

    move = (event) => {
        const positionX = getEventOffsetX(this.player.controls.volumeContainer, event);
        this.updateVolume(positionX);
    };

    end = (event) => {
        const { player } = this;
        const positionX = getEventOffsetX(player.controls.volumeContainer, event);

        if (is.number(positionX)) {
            this.updateVolume(positionX);
        }

        off.call(player, document, 'mouseup touchend mouseleave', this.end);
        off.call(player, document, 'mousemove touchmove', this.move);
    };

    start = () => {
        on.call(this.player, document, 'mouseup touchend mouseleave', this.end);
        on.call(this.player, document, 'mousemove touchmove', this.move);
    };
}

export default Volume;
