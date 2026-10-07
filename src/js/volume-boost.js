import { createElement, toggleClass } from './utils/dom';
import { on, once, triggerEvent } from './utils/events';
import { selector } from './menu/menu-item';

const LIMIT_MAX = 8;
const STEP = 0.25;
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 100;

class VolumeBoost {
  constructor(player) {
    this.player = player;
    this.id = 'volumeBoost';
    this.config = player.config.layoutControls.volumeBoost;
    this.persistent = player.config.layoutControls.persistentSettings.volumeBoost;

    const stored = this.persistent ? player.storage.get(this.id) : null;

    this.config.max = this.normalize(
      stored?.max,
      this.config.max,
      Math.max(this.config.min, this.config.reset),
      LIMIT_MAX,
    );

    this.preferredEnabled = typeof stored?.enabled === 'boolean' ? stored.enabled : this.config.enabled;
    this.enabled = false;
    this.level = this.normalize(stored?.level, this.config.reset, this.config.reset, this.config.max);
    this.mode = ['limiter', 'pure'].includes(stored?.mode) ? stored.mode : this.config.mode;
    this.available = Boolean(window.AudioContext || window.webkitAudioContext);
    this.error = this.available ? null : this.createError('unsupported');

    this.setupOverlay();
    this.setupMenu();

    if (this.preferredEnabled && this.available) {
      once.call(this.player, this.player.wrapper, 'pointerdown', () => this.setEnabled(true));
    }
  }

  setupOverlay = () => {
    this.indicator = createElement('div', {
      class: 'fluid_volume_boost_indicator',
      role: 'status',
      'aria-live': 'polite',
    });

    this.value = createElement('span');
    this.indicator.appendChild(this.value);
    this.player.wrapper.appendChild(this.indicator);
  };

  setupMenu = () => {
    if (!this.player.menu.isEnabled(this.id)) {
      return;
    }

    const captions = this.player.config.captions;

    this.item = selector({
      id: this.id,
      title: captions.volumeBoost,
      value: this.available ? captions.off : captions.notAvailable,
      popup: 'dialog',
    });

    this.page = createElement('div', {
      class: 'cvp_volume_boost_menu hide',
      'aria-label': captions.volumeBoost,
    });

    this.enabledRow = createElement('div', { class: 'cvp_volume_boost_enabled_row' });
    this.enabledLabel = createElement('span', { class: 'cvp_volume_boost_label' }, captions.enabled);

    this.enabledItem = createElement('button', {
      type: 'button',
      class: 'cvp_volume_boost_enabled',
      role: 'switch',
      'aria-checked': false,
      'aria-label': captions.enabled,
      disabled: !this.available,
    });

    this.enabledItem.appendChild(createElement('span', { class: 'cvp_volume_boost_toggle', 'aria-hidden': true }));

    this.errorButton = createElement('button', {
      type: 'button',
      class: 'cvp_volume_boost_error_button hide',
      'aria-label': captions.viewVolumeBoostError,
    });

    this.errorButton.append(
      createElement('span', null, captions.error),
      createElement('span', { class: 'cvp_volume_boost_error_icon', 'aria-hidden': true }, '↗'),
    );

    this.enabledRow.append(this.enabledLabel, this.enabledItem, this.errorButton);

    this.levelControl = this.createStepper(
      'level',
      captions.boostLevel,
      captions.decreaseVolumeBoost,
      captions.increaseVolumeBoost,
      () => this.setLevel(this.level - STEP),
      () => this.setLevel(this.level + STEP),
    );

    this.maximumControl = this.createStepper(
      'maximum',
      captions.maximum,
      captions.decreaseMaximumBoost,
      captions.increaseMaximumBoost,
      () => this.setMaximum(this.config.max - STEP),
      () => this.setMaximum(this.config.max + STEP),
    );

    this.modeControl = createElement('div', { class: 'cvp_volume_boost_mode' });
    this.modeControl.appendChild(createElement('span', { class: 'cvp_volume_boost_label' }, captions.boostMode));

    this.modeButtons = createElement('div', {
      class: 'cvp_volume_boost_modes',
      role: 'group',
      'aria-label': captions.boostMode,
    });

    this.limiterButton = createElement('button', { type: 'button' }, captions.limiter);
    this.pureButton = createElement('button', { type: 'button' }, captions.pureGain);
    this.modeButtons.append(this.limiterButton, this.pureButton);
    this.modeControl.appendChild(this.modeButtons);
    this.warning = createElement('p', { class: 'cvp_volume_boost_warning' }, captions.volumeBoostWarning);

    this.menuReset = createElement(
      'button',
      { type: 'button', class: 'cvp_volume_boost_reset_button' },
      captions.resetVolumeBoost,
    );

    this.page.append(
      this.enabledRow,
      this.levelControl.row,
      this.maximumControl.row,
      this.modeControl,
      this.warning,
      this.menuReset,
    );

    this.player.menu.add({ id: this.id, field: 'selector', content: this.page, item: this.item });

    on.call(this.player, this.item, 'click', () => {
      this.player.menu.openSubMenu(this.item, this.page, 248, this.menuHeight(), 'dialog');
    });

    on.call(this.player, this.enabledItem, 'click', () => this.setEnabled(!this.enabled));
    on.call(this.player, this.errorButton, 'click', this.openError);
    on.call(this.player, this.limiterButton, 'click', () => this.setMode('limiter'));
    on.call(this.player, this.pureButton, 'click', () => this.setMode('pure'));
    on.call(this.player, this.menuReset, 'click', this.reset);
    on.call(this.player, window, 'blur', this.stopRepeat);

    this.setupErrorDialog();
    this.updateMenu();
  };

  setupErrorDialog = () => {
    const captions = this.player.config.captions;
    const titleId = `${this.player.videoPlayerId}_volume_boost_error_title`;

    this.errorDialog = createElement('div', {
      class: 'cvp_volume_boost_error_dialog',
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': titleId,
      'aria-hidden': true,
    });

    this.errorCard = createElement('div', { class: 'cvp_volume_boost_error_card' });
    this.errorTitle = createElement('h2', { id: titleId }, captions.volumeBoostUnavailable);
    this.errorMessage = createElement('p', { class: 'cvp_volume_boost_error_message' });
    this.errorHelp = createElement('p', { class: 'cvp_volume_boost_error_help' });
    this.technicalGroup = createElement('div', { class: 'cvp_volume_boost_error_technical' });
    this.technicalGroup.appendChild(createElement('strong', null, captions.technicalDetails));
    this.technical = createElement('code');
    this.technicalGroup.appendChild(this.technical);

    this.closeErrorButton = createElement(
      'button',
      { type: 'button', class: 'cvp_volume_boost_error_close' },
      captions.close,
    );

    this.errorCard.append(
      this.errorTitle,
      this.errorMessage,
      this.errorHelp,
      this.technicalGroup,
      this.closeErrorButton,
    );

    this.errorDialog.appendChild(this.errorCard);
    this.player.wrapper.appendChild(this.errorDialog);

    on.call(this.player, this.closeErrorButton, 'click', () => this.closeError(true));

    on.call(this.player, this.errorDialog, 'click', (event) => {
      if (event.target === this.errorDialog) {
        this.closeError(true);
      }
    });

    on.call(
      this.player,
      this.errorDialog,
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.closeError(true);
        } else if (event.key === 'Tab') {
          event.preventDefault();
          this.closeErrorButton.focus();
        }
      },
      false,
    );
  };

  openError = () => {
    if (!this.error) {
      return;
    }

    this.errorInvoker = this.errorButton;
    this.errorMessage.textContent = this.error.message;
    this.errorHelp.textContent = this.error.help;
    this.technical.textContent = this.error.technical;
    this.setBackgroundInteractive(false);
    toggleClass(this.errorDialog, 'cvp_active', true);
    this.errorDialog.setAttribute('aria-hidden', 'false');
    this.closeErrorButton.focus();
  };

  closeError = (restoreFocus = false) => {
    if (!this.errorDialog?.classList.contains('cvp_active')) {
      return;
    }

    toggleClass(this.errorDialog, 'cvp_active', false);
    this.errorDialog.setAttribute('aria-hidden', 'true');
    this.setBackgroundInteractive(true);

    if (restoreFocus) {
      const invoker = this.errorInvoker?.isConnected ? this.errorInvoker : this.errorButton;
      clearTimeout(this.focusTimer);
      this.focusTimer = setTimeout(() => invoker.focus(), 0);
    }

    this.errorInvoker = null;
  };

  setBackgroundInteractive = (interactive) => {
    for (const element of this.player.wrapper.children) {
      if (element === this.errorDialog) {
        continue;
      }

      if (interactive) {
        if (element.dataset.volumeBoostInert !== 'true') {
          element.removeAttribute('inert');
        }

        delete element.dataset.volumeBoostInert;
      } else {
        element.dataset.volumeBoostInert = String(element.hasAttribute('inert'));
        element.setAttribute('inert', '');
      }
    }
  };

  createStepper = (id, label, decreaseLabel, increaseLabel, decrease, increase) => {
    const row = createElement('div', { class: `cvp_volume_boost_stepper cvp_volume_boost_${id}` });
    const text = createElement('span', { class: 'cvp_volume_boost_label' }, label);
    const controls = createElement('div', { class: 'cvp_volume_boost_stepper_controls' });
    const minus = createElement('button', { type: 'button', 'aria-label': decreaseLabel }, '−');
    const value = createElement('output', { 'aria-live': 'polite' });
    const plus = createElement('button', { type: 'button', 'aria-label': increaseLabel }, '+');

    controls.append(minus, value, plus);
    row.append(text, controls);
    this.bindStepper(minus, decrease);
    this.bindStepper(plus, increase);

    return { row, minus, value, plus };
  };

  bindStepper = (button, action) => {
    on.call(this.player, button, 'click', (event) => {
      if (this.suppressClick === button) {
        clearTimeout(this.suppressTimer);
        this.suppressClick = null;
        event.preventDefault();
        return;
      }

      action();
    });

    on.call(this.player, button, 'pointerdown', (event) => {
      if (event.button !== 0 || button.disabled) {
        return;
      }

      this.stopRepeat();
      this.suppressClick = null;
      this.repeatButton = button;
      this.repeatAction = action;

      try {
        button.setPointerCapture?.(event.pointerId);
      } catch (_) {
        // Synthetic pointer events have no active browser pointer to capture.
      }

      this.repeatTimer = setTimeout(this.beginRepeat, REPEAT_DELAY);
    });

    on.call(this.player, button, 'pointerup pointercancel lostpointercapture', this.stopRepeat);
  };

  beginRepeat = () => {
    if (!this.repeatButton || this.repeatButton.disabled) {
      return this.stopRepeat();
    }

    this.suppressClick = this.repeatButton;
    this.repeatAction();

    if (this.repeatButton.disabled) {
      return this.stopRepeat(true);
    }

    this.repeatInterval = setInterval(() => {
      if (!this.repeatButton || this.repeatButton.disabled) {
        this.stopRepeat(true);
        return;
      }

      this.repeatAction();
    }, REPEAT_INTERVAL);
  };

  stopRepeat = () => {
    clearTimeout(this.repeatTimer);
    clearInterval(this.repeatInterval);

    this.repeatTimer = null;
    this.repeatInterval = null;

    if (this.suppressClick) {
      clearTimeout(this.suppressTimer);

      this.suppressTimer = setTimeout(() => {
        this.suppressClick = null;
      }, 150);
    }

    this.repeatButton = null;
    this.repeatAction = null;
  };

  ensureGraph = async () => {
    if (this.context) {
      if (this.context.state === 'suspended') {
        try {
          await this.context.resume();
        } catch (error) {
          return this.fail('resume', error);
        }
      }

      return true;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return this.fail('unsupported');
    }

    const sourceAccess = this.sourceAccess();

    if (sourceAccess === null) {
      return false;
    }

    if (!sourceAccess) {
      return this.fail('cors');
    }

    try {
      this.context = new AudioContext();
      this.source = this.context.createMediaElementSource(this.player.media);
      this.gain = this.context.createGain();
      this.limiter = this.context.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.25;
      this.source.connect(this.gain);
      this.connectOutput();
    } catch (error) {
      this.player.debug.error(error);
      await this.context?.close?.().catch(() => {});
      this.context = null;
      this.source = null;
      this.gain = null;
      this.limiter = null;

      return this.fail('graph', error);
    }

    try {
      await this.context.resume();
      return true;
    } catch (error) {
      return this.fail('resume', error);
    }
  };

  sourceAccess = () => {
    const source = this.player.currentSource.src || this.player.media.currentSrc || this.player.media.src;

    if (!source) {
      return null;
    }

    try {
      return (
        new URL(source, window.location.href).origin === window.location.origin ||
        this.player.media.crossOrigin === 'anonymous'
      );
    } catch (_) {
      return false;
    }
  };

  connectOutput = () => {
    this.gain.disconnect();
    this.limiter.disconnect();

    if (this.mode === 'limiter') {
      this.gain.connect(this.limiter);
      this.limiter.connect(this.context.destination);
    } else {
      this.gain.connect(this.context.destination);
    }
  };

  createError = (code, error) => {
    const captions = this.player.config.captions;

    const messages = {
      cors: [captions.volumeBoostCorsError, captions.volumeBoostCorsHelp],
      unsupported: [captions.volumeBoostUnsupportedError, captions.volumeBoostUnsupportedHelp],
      graph: [captions.volumeBoostGraphError, captions.volumeBoostGraphHelp],
      resume: [captions.volumeBoostResumeError, captions.volumeBoostResumeHelp],
    };

    const [message, help] = messages[code];

    const technical = error
      ? `${error.name || 'Error'}: ${error.message || String(error)}`
      : captions[`volumeBoost${code.charAt(0).toUpperCase() + code.slice(1)}Technical`];

    return { code, message, help, technical };
  };

  fail = (code, error) => {
    this.error = this.createError(code, error);
    this.available = false;
    this.enabled = false;
    this.updateMenu();

    return false;
  };

  setEnabled = async (enabled) => {
    this.preferredEnabled = Boolean(enabled);
    this.persist();

    if (enabled && !(await this.ensureGraph())) {
      return false;
    }

    this.enabled = Boolean(enabled);
    this.applyGain();
    this.updateMenu();
    this.render();
    this.persist();

    return true;
  };

  setLevel = async (level) => {
    const next = this.normalize(level, this.level, this.config.min, this.config.max);

    if (next > this.config.reset && !this.enabled && !(await this.setEnabled(true))) {
      return false;
    }

    this.level = next;
    this.applyGain();
    this.updateMenu();
    this.render();
    this.persist();

    return true;
  };

  setMaximum = (maximum) => {
    this.config.max = this.normalize(maximum, this.config.max, this.config.min, LIMIT_MAX);

    if (this.level > this.config.max) {
      this.level = this.config.max;
      this.applyGain();
      this.render();
    }

    this.persist();
    this.updateMenu();
  };

  setMode = (mode) => {
    if (!['limiter', 'pure'].includes(mode)) {
      throw new RangeError('Volume boost mode must be "limiter" or "pure"');
    }

    this.mode = mode;
    this.persist();

    if (this.gain) {
      this.connectOutput();
    }

    this.updateMenu();
    this.render();
  };

  normalize = (value, fallback, minimum, maximum) => {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(Math.round(value / STEP) * STEP, minimum), maximum);
  };

  persist = () => {
    if (this.persistent) {
      this.player.storage.set(this.id, {
        enabled: this.preferredEnabled,
        level: this.level,
        max: this.config.max,
        mode: this.mode,
      });
    }
  };

  applyGain = () => {
    if (!this.gain) {
      return;
    }

    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(this.enabled ? this.level : 1, now, 0.015);
  };

  updateMenu = () => {
    if (!this.levelControl) {
      return;
    }

    const captions = this.player.config.captions;
    this.enabledItem.disabled = !this.available;
    this.enabledItem.setAttribute('aria-checked', String(this.enabled));
    this.item.querySelector('.cvp_value').textContent = this.available
      ? captions[this.enabled ? 'on' : 'off']
      : captions.notAvailable;

    toggleClass(this.enabledItem, 'hide', Boolean(this.error));
    toggleClass(this.errorButton, 'hide', !this.error);

    this.levelControl.value.textContent = `${this.level.toFixed(2)}x`;
    this.maximumControl.value.textContent = `${this.config.max.toFixed(2)}x`;
    this.levelControl.minus.disabled = !this.available || this.level <= this.config.min;
    this.levelControl.plus.disabled = !this.available || this.level >= this.config.max;
    this.maximumControl.minus.disabled = this.config.max <= this.config.min;
    this.maximumControl.plus.disabled = this.config.max >= LIMIT_MAX;
    this.limiterButton.setAttribute('aria-pressed', String(this.mode === 'limiter'));
    this.pureButton.setAttribute('aria-pressed', String(this.mode === 'pure'));

    toggleClass(this.page, 'cvp_volume_boost_unavailable', !this.available);
    toggleClass(this.warning, 'hide', this.mode !== 'pure' && this.level <= 3);

    if (this.player.menu.submenuOption === this.item) {
      this.player.menu.resizeSubMenu(248, this.menuHeight());
    }
  };

  menuHeight = () => (this.mode === 'pure' || this.level > 3 ? 270 : 240);

  render = () => {
    const active = this.enabled && this.level > this.config.reset;
    const text = `${this.level.toFixed(2)}x`;

    this.value.textContent = text;
    this.indicator.setAttribute('aria-label', `${this.player.config.captions.volumeBoost} ${text}`);

    toggleClass(this.indicator, 'fluid_volume_boost_visible', active);

    triggerEvent.call(this.player, this.player.media, 'volumeboostchange', false, {
      enabled: this.enabled,
      level: this.level,
      mode: this.mode,
    });
  };

  reset = () => {
    this.level = this.config.reset;
    this.applyGain();
    this.updateMenu();
    this.render();
    this.persist();
  };

  destroy = () => {
    this.closeError();
    this.stopRepeat();
    clearTimeout(this.suppressTimer);
    clearTimeout(this.focusTimer);
    this.source?.disconnect();
    this.gain?.disconnect();
    this.limiter?.disconnect();
    this.context?.close?.().catch(() => {});
    this.context = null;
  };
}

export default VolumeBoost;
