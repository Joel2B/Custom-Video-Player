import { IS_FIREFOX, IS_IOS, IS_SAFARI } from '../utils/browser';
import { hasClass, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { switcher } from './menu-item';

class Autoplay {
  constructor(player) {
    this.player = player;
    this.id = 'autoPlay';

    this.config = this.player.config.layoutControls[this.id];

    this.applied = false;
    this.destroyed = false;

    this.tmpVideo = null;
    this.waitInteractionTimer = null;
    this.waitInteractionGeneration = 0;

    this.init();
  }

  init = () => {
    const { player } = this;

    if (!player.menu.isEnabled(this.id)) {
      return;
    }

    if (this.player.storage.get(this.id) === null) {
      this.player.storage.set(this.id, this.config.active);
    }

    this.setupMenu();
  };

  setupMenu = () => {
    const { player } = this;

    const item = switcher({
      id: this.id,
      title: player.config.captions.autoplay,
      enabled: player.storage.get(this.id),
      instance: player,
    });

    player.menu.add({
      id: this.id,
      field: 'switcher',
      item,
    });

    on.call(player, item, 'click', () => {
      let active = false;

      if (!hasClass(item, 'cvp_enabled')) {
        active = true;
      } else {
        if (player.storage.get('volume') === 1 && player.storage.get('mute')) {
          player.toggleMute();
        } else {
          player.volumeControl.apply();
        }
      }

      toggleClass(item, 'cvp_enabled', active);
      item.setAttribute('aria-checked', String(active));

      player.storage.set(this.id, active);

      if (player.mobile) {
        player.menu.close();
      }
    });
  };

  apply = (force = true) => {
    const { player } = this;

    if (!player.ready || !player.menu.isEnabled(this.id) || !player.storage.get(this.id) || this.applied) {
      return false;
    }

    this.cancelWaitInteraction();
    player.controlBar.toggle(false);

    if (force) {
      this.applied = true;
      player.playPause.toggle('autoplay');
    }

    return true;
  };

  playMuted = () => {
    const { player } = this;

    this.cancelWaitInteraction();
    player.muted = true;
    player.volume = 0;

    this.applied = false;

    if (player.streaming.dashController?.dash) {
      player.streaming.dashController.play('autoplay');
    } else {
      this.apply();
    }

    // TODO: use events instead of this
    this.waitInteraction();
  };

  waitInteraction = (generation = ++this.waitInteractionGeneration) => {
    if (
      this.destroyed ||
      generation !== this.waitInteractionGeneration ||
      !this.config.waitInteraction ||
      IS_IOS ||
      IS_SAFARI
    ) {
      return;
    }

    const source = this.player.currentSource.src;

    if (IS_FIREFOX && this.tmpVideo !== null) {
      this.tmpVideo.remove();
      this.tmpVideo = null;
    }

    if (this.tmpVideo === null) {
      this.tmpVideo = document.createElement('video');
      this.tmpVideo.style.display = 'none';
      this.tmpVideo.src = this.player.config.blankVideo;

      document.body.appendChild(this.tmpVideo);
    }

    const promise = this.tmpVideo.play();

    if (promise === undefined) {
      return;
    }

    promise
      .then((_) => {
        if (
          this.destroyed ||
          generation !== this.waitInteractionGeneration ||
          !this.player.ready ||
          source !== this.player.currentSource.src
        ) {
          return;
        }

        this.player.toggleMute();
        this.tmpVideo.remove();
        this.tmpVideo = null;
      })
      .catch((error) => {
        if (
          this.destroyed ||
          generation !== this.waitInteractionGeneration ||
          !this.player.ready ||
          source !== this.player.currentSource.src
        ) {
          return;
        }

        if (error.name === 'NotAllowedError') {
          clearTimeout(this.waitInteractionTimer);
          this.waitInteractionTimer = setTimeout(() => {
            this.waitInteractionTimer = null;
            this.waitInteraction(generation);
          }, 500);
        }
      });
  };

  cancelWaitInteraction = () => {
    this.waitInteractionGeneration++;
    clearTimeout(this.waitInteractionTimer);
    this.waitInteractionTimer = null;

    if (this.tmpVideo) {
      this.tmpVideo.remove();
      this.tmpVideo = null;
    }
  };

  destroy = () => {
    this.destroyed = true;
    this.cancelWaitInteraction();
  };
}

export default Autoplay;
