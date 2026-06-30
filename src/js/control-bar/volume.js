import { getEventOffsetX, toggleClass } from '../utils/dom';
import { off, on } from '../utils/events';
import { innerWidth } from '../utils/window';
import is from '../utils/is';

class Volume {
  constructor(player) {
    this.player = player;

    this.id = 'volume';
    this.muteId = 'mute';

    this.persistent = player.config.layoutControls.persistentSettings[this.id];

    this.defaultValue = 1;
    this.latestVolume = 1;
    this.applyTimer = null;
    this.renderTimer = null;
  }

  init = () => {
    const { player } = this;

    if (player.storage.get(this.id) === null || !this.persistent) {
      player.storage.set(this.id, this.defaultValue);
    }

    this.apply();
  };

  apply = () => {
    const { player } = this;

    this.setVolume(player.storage.get(this.id));

    if (player.storage.get(this.muteId)) {
      player.toggleMute();
    }

    this.applyTimer = setTimeout(() => {
      this.update();
    }, 0);
  };

  update = () => {
    const { player } = this;
    const { controls } = player;
    const { scrubberVolumeContainer, scrubberVolume, volume, mute } = controls;
    const cmMute = player.contextMenu.mute;
    const width = volume.clientWidth;

    if (!player.mobile && !width && innerWidth() >= 375) {
      this.waitRendering();
      return;
    }

    if (player.volume !== 0) {
      this.latestVolume = player.volume;
      player.storage.set(this.muteId, false);
    } else {
      player.storage.set(this.muteId, true);
    }

    const notMuted = player.volume && !player.muted;

    toggleClass(mute, 'fluid_button_mute', !notMuted);
    toggleClass(mute, 'fluid_button_volume', notMuted);

    cmMute.innerHTML = player.config.captions[notMuted ? 'mute' : 'unmute'];
    if (controls.muteTooltip) {
      controls.muteTooltip.textContent = player.config.captions[notMuted ? 'mute' : 'unmute'];
    }

    scrubberVolumeContainer.style.width = player.volume * width + 'px';
    scrubberVolume.style.left = player.volume * width - scrubberVolume.clientWidth / 2 + 'px';

    this.updateTooltip(player.volume);
  };

  waitRendering = () => {
    const { player } = this;

    if (!is.nullOrUndefined(player.controls) && player.controls.volume.clientWidth) {
      this.update();
    } else {
      this.renderTimer = setTimeout(this.waitRendering, 100);
    }
  };

  updateVolume = (positionX) => {
    const { player } = this;
    const width = player.controls.volumeContainer.clientWidth;

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

  updateTooltip = (volume, positionX) => {
    const { controls } = this.player;
    if (!controls || !controls.volumeTooltip) {
      return;
    }

    const width = controls.volume.clientWidth || controls.volumeContainer.clientWidth;
    if (!width) {
      return;
    }
    const percent = Math.round(volume * 100);
    const clampedLeft = Math.min(Math.max(is.number(positionX) ? positionX : volume * width, 0), width);

    controls.volumeTooltip.textContent = percent.toString();
    controls.volumeTooltip.style.left = `${clampedLeft}px`;
  };

  showTooltip = (positionX) => {
    const { controls } = this.player;
    if (!controls || !controls.volumeTooltip) {
      return;
    }

    this.updateTooltip(this.player.volume, positionX);
    toggleClass(controls.volumeTooltip, 'fluid_volume_tooltip_visible', true);
  };

  hideTooltip = () => {
    const { controls } = this.player;
    if (!controls || !controls.volumeTooltip) {
      return;
    }

    toggleClass(controls.volumeTooltip, 'fluid_volume_tooltip_visible', false);
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

    this.player.storage.set(this.id, latestVolume);
  };

  move = (event) => {
    const positionX = getEventOffsetX(this.player.controls.volumeContainer, event);

    this.updateVolume(positionX);
    this.showTooltip(positionX);
  };

  end = (event) => {
    const { player } = this;
    const positionX = getEventOffsetX(player.controls.volumeContainer, event);

    if (is.number(positionX)) {
      this.updateVolume(positionX);
    }

    this.hideTooltip();

    off.call(player, document, 'mousemove touchmove', this.move);
    off.call(player, document, 'mouseup touchend mouseleave', this.end);
  };

  start = (event) => {
    const positionX = getEventOffsetX(this.player.controls.volumeContainer, event);
    if (is.number(positionX)) {
      this.updateVolume(positionX);
      this.showTooltip(positionX);
    }

    on.call(this.player, document, 'mousemove touchmove', this.move);
    on.call(this.player, document, 'mouseup touchend mouseleave', this.end);
  };

  destroy = () => {
    clearTimeout(this.applyTimer);
    clearTimeout(this.renderTimer);

    off.call(this.player, document, 'mousemove touchmove', this.move);
    off.call(this.player, document, 'mouseup touchend mouseleave', this.end);
  };
}

export default Volume;
