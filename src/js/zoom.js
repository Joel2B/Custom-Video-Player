import { createElement, toggleClass } from './utils/dom';
import { on, triggerEvent } from './utils/events';
import { selector } from './menu/menu-item';

const LIMIT_MIN = 1;
const LIMIT_MAX = 8;
const STEP = 0.25;
const PAN_THRESHOLD = 8;

class Zoom {
  constructor(player) {
    this.player = player;
    this.id = 'zoom';
    this.config = player.config.layoutControls.zoom;
    this.scale = this.config.reset;
    this.x = 0;
    this.y = 0;
    this.pointers = new Map();
    this.pinch = null;
    this.pan = null;
    this.suppressUntil = 0;

    const stored = player.config.layoutControls.persistentSettings.zoom ? player.storage.get(this.id) : null;
    this.enabled = typeof stored === 'boolean' ? stored : (stored?.enabled ?? this.config.enabled);
    this.config.min = this.normalizeLimit(stored?.min, this.config.min);
    this.config.max = this.normalizeLimit(stored?.max, this.config.max);
    this.config.min = Math.min(this.config.min, this.config.max);

    this.setupOverlay();
    this.setupMenu();
    this.listeners();
    this.setEnabled(this.enabled, false);
  }

  setupOverlay = () => {
    this.indicator = createElement('div', {
      class: 'fluid_zoom_indicator',
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

    this.item = selector({
      id: this.id,
      title: this.player.config.captions.zoom,
      value: this.enabled ? this.player.config.captions.on : this.player.config.captions.off,
      popup: 'dialog',
    });

    this.page = createElement('div', {
      class: 'cvp_zoom_menu hide',
      'aria-label': this.player.config.captions.zoom,
    });

    this.enabledItem = createElement('button', {
      type: 'button',
      class: 'cvp_zoom_enabled',
      role: 'switch',
      'aria-checked': this.enabled,
    });

    this.enabledItem.appendChild(
      createElement('span', { class: 'cvp_zoom_label' }, this.player.config.captions.enabled),
    );

    this.enabledItem.appendChild(createElement('span', { class: 'cvp_zoom_toggle', 'aria-hidden': true }));

    this.levelControl = this.createStepper(
      'level',
      this.player.config.captions.zoomLevel,
      this.player.config.captions.decreaseZoom,
      this.player.config.captions.increaseZoom,
      () => this.setScale(this.scale - STEP),
      () => this.setScale(this.scale + STEP),
    );

    this.minimumControl = this.createStepper(
      'minimum',
      this.player.config.captions.minimum,
      this.player.config.captions.decreaseMinimumZoom,
      this.player.config.captions.increaseMinimumZoom,
      () => this.setMinimum(this.config.min - STEP),
      () => this.setMinimum(this.config.min + STEP),
    );

    this.maximumControl = this.createStepper(
      'maximum',
      this.player.config.captions.maximum,
      this.player.config.captions.decreaseMaximumZoom,
      this.player.config.captions.increaseMaximumZoom,
      () => this.setMaximum(this.config.max - STEP),
      () => this.setMaximum(this.config.max + STEP),
    );

    this.menuReset = createElement(
      'button',
      { type: 'button', class: 'cvp_zoom_reset_button' },
      this.player.config.captions.resetZoom,
    );

    this.page.append(
      this.enabledItem,
      this.levelControl.row,
      this.minimumControl.row,
      this.maximumControl.row,
      this.menuReset,
    );

    this.player.menu.add({ id: this.id, field: 'selector', content: this.page, item: this.item });

    on.call(this.player, this.item, 'click', () => {
      this.player.menu.openSubMenu(this.item, this.page, 240, 240, 'dialog');
    });

    on.call(this.player, this.enabledItem, 'click', () => this.setEnabled(!this.enabled));

    on.call(this.player, this.menuReset, 'click', () => {
      this.reset();
      this.player.menu.close();
    });

    this.updateMenu();
  };

  createStepper = (id, label, decreaseLabel, increaseLabel, decrease, increase) => {
    const row = createElement('div', { class: `cvp_zoom_stepper cvp_zoom_${id}` });
    const text = createElement('span', { class: 'cvp_zoom_label', 'data-short': this.shortLabel(id) }, label);
    const controls = createElement('div', { class: 'cvp_zoom_stepper_controls' });
    const minus = createElement('button', { type: 'button', 'aria-label': decreaseLabel }, '−');
    const value = createElement('output', { 'aria-live': 'polite' });
    const plus = createElement('button', { type: 'button', 'aria-label': increaseLabel }, '+');

    controls.append(minus, value, plus);
    row.append(text, controls);

    on.call(this.player, minus, 'click', decrease);
    on.call(this.player, plus, 'click', increase);

    return { row, minus, value, plus };
  };

  shortLabel = (id) => {
    const labels = {
      level: this.player.config.captions.zoom,
      minimum: this.player.config.captions.minimumShort,
      maximum: this.player.config.captions.maximumShort,
    };

    return labels[id];
  };

  listeners = () => {
    const { player } = this;
    on.call(player, player.wrapper, 'wheel', this.wheel, false);
    on.call(player, player.wrapper, 'pointerdown', this.pointerDown, false);
    on.call(player, player.wrapper, 'pointermove', this.pointerMove, false);
    on.call(player, player.wrapper, 'pointerup pointercancel', this.pointerUp, false);
    on.call(player, player.wrapper, 'mousedown auxclick', this.auxClick, false);
  };

  setEnabled = (enabled, persist = true) => {
    this.enabled = enabled;
    toggleClass(this.player.wrapper, 'fluid_zoom_enabled', enabled);

    if (!enabled) {
      this.reset();
    }

    if (this.enabledItem) {
      this.enabledItem.setAttribute('aria-checked', String(enabled));
      this.item.querySelector('.cvp_value').textContent = enabled
        ? this.player.config.captions.on
        : this.player.config.captions.off;
      this.updateMenu();
    }

    if (persist) {
      this.persist();
    }
  };

  setScale = (scale) => {
    if (!this.enabled || (this.scale <= this.config.min && scale < this.scale)) {
      return;
    }

    const rect = this.player.wrapper.getBoundingClientRect();
    this.zoomTo(scale, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  setMinimum = (minimum) => {
    this.config.min = Math.min(this.normalizeLimit(minimum, this.config.min), this.config.max);

    if (this.scale !== this.config.reset && this.scale < this.config.min) {
      this.setScale(this.config.min);
    }

    this.persist();
    this.updateMenu();
  };

  setMaximum = (maximum) => {
    this.config.max = Math.max(this.normalizeLimit(maximum, this.config.max), this.config.min);

    if (this.scale > this.config.max) {
      this.setScale(this.config.max);
    }

    this.persist();
    this.updateMenu();
  };

  normalizeLimit = (value, fallback) => {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(Math.round(value / STEP) * STEP, LIMIT_MIN), LIMIT_MAX);
  };

  persist = () => {
    if (this.player.config.layoutControls.persistentSettings.zoom) {
      this.player.storage.set(this.id, {
        enabled: this.enabled,
        min: this.config.min,
        max: this.config.max,
      });
    }
  };

  updateMenu = () => {
    if (!this.levelControl) {
      return;
    }

    this.levelControl.value.textContent = `${Math.round(this.scale * 100)}%`;
    this.minimumControl.value.textContent = `${this.config.min.toFixed(2)}x`;
    this.maximumControl.value.textContent = `${this.config.max.toFixed(2)}x`;
    this.levelControl.minus.disabled = !this.enabled || this.scale <= this.config.min;
    this.levelControl.plus.disabled = !this.enabled || this.scale >= this.config.max;
    this.minimumControl.minus.disabled = this.config.min <= LIMIT_MIN;
    this.minimumControl.plus.disabled = this.config.min >= this.config.max;
    this.maximumControl.minus.disabled = this.config.max <= this.config.min;
    this.maximumControl.plus.disabled = this.config.max >= LIMIT_MAX;

    toggleClass(this.page, 'cvp_zoom_disabled', !this.enabled);
  };

  wheel = (event) => {
    if (!this.enabled || this.isControl(event.target)) {
      return;
    }

    if (event.deltaY > 0 && this.scale <= this.config.min) {
      return;
    }

    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.zoomTo(this.scale * factor, event.clientX, event.clientY);
    this.suppressInteraction();
  };

  auxClick = (event) => {
    if (this.enabled && event.button === 1) {
      event.preventDefault();
      this.reset();
    }
  };

  pointerDown = (event) => {
    if (!this.enabled || this.isControl(event.target) || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    try {
      this.player.media.setPointerCapture?.(event.pointerId);
    } catch (_) {
      // Synthetic pointer events have no active browser pointer to capture.
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1 && this.scale > this.config.min) {
      this.pan = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        originX: this.x,
        originY: this.y,
        active: false,
      };
    } else if (this.pointers.size >= 2) {
      this.startPinch();
      this.pan = null;
    }
  };

  pointerMove = (event) => {
    if (!this.enabled || !this.pointers.has(event.pointerId)) {
      return;
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pinch) {
      const first = this.pointers.get(this.pinch.ids[0]);
      const second = this.pointers.get(this.pinch.ids[1]);

      if (!first || !second) {
        return;
      }

      event.preventDefault();
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      this.zoomTo(this.pinch.scale * (distance / this.pinch.distance), centerX, centerY);
      this.suppressInteraction();
      return;
    }

    if (this.pan?.id === event.pointerId) {
      const distance = Math.hypot(event.clientX - this.pan.x, event.clientY - this.pan.y);

      if (!this.pan.active && distance < PAN_THRESHOLD) {
        return;
      }

      this.pan.active = true;
      event.preventDefault();
      this.x = this.pan.originX + event.clientX - this.pan.x;
      this.y = this.pan.originY + event.clientY - this.pan.y;
      this.clampPosition();
      this.render();
      this.suppressInteraction();
    }
  };

  pointerUp = (event) => {
    if (!this.pointers.has(event.pointerId)) {
      return;
    }

    this.pointers.delete(event.pointerId);

    try {
      this.player.media.releasePointerCapture?.(event.pointerId);
    } catch (_) {
      // Pointer cancellation can release capture before this handler runs.
    }

    if (this.pinch?.ids.includes(event.pointerId)) {
      this.pinch = null;
    }

    if (this.pan?.id === event.pointerId) {
      this.pan = null;
    }

    if (this.pointers.size >= 2) {
      this.startPinch();
    } else if (this.pointers.size === 1 && this.scale > this.config.min) {
      const [id, point] = this.pointers.entries().next().value;
      this.pan = { id, x: point.x, y: point.y, originX: this.x, originY: this.y, active: false };
    }
  };

  startPinch = () => {
    const points = [...this.pointers.entries()];
    let pair = [points[0], points[1]];
    let shortest = Infinity;

    for (let first = 0; first < points.length - 1; first++) {
      for (let second = first + 1; second < points.length; second++) {
        const distance = Math.hypot(points[second][1].x - points[first][1].x, points[second][1].y - points[first][1].y);
        if (distance < shortest) {
          shortest = distance;
          pair = [points[first], points[second]];
        }
      }
    }

    this.pinch = { ids: [pair[0][0], pair[1][0]], distance: shortest, scale: this.scale };
  };

  zoomTo = (scale, clientX, clientY) => {
    const next = Math.min(Math.max(scale, this.config.min), this.config.max);
    const rect = this.player.media.getBoundingClientRect();
    const wrapper = this.player.wrapper.getBoundingClientRect();
    const focusX = clientX - (wrapper.left + wrapper.width / 2);
    const focusY = clientY - (wrapper.top + wrapper.height / 2);
    const ratio = next / this.scale;

    if (rect.width && rect.height && ratio !== 1) {
      this.x = focusX - (focusX - this.x) * ratio;
      this.y = focusY - (focusY - this.y) * ratio;
    }

    this.scale = next;
    this.clampPosition();
    this.render();
  };

  clampPosition = () => {
    const rect = this.player.wrapper.getBoundingClientRect();
    const maxX = (rect.width * (this.scale - 1)) / 2;
    const maxY = (rect.height * (this.scale - 1)) / 2;

    this.x = Math.min(Math.max(this.x, -maxX), maxX);
    this.y = Math.min(Math.max(this.y, -maxY), maxY);
  };

  render = () => {
    this.player.media.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})`;
    const active = Math.abs(this.scale - this.config.reset) > 0.001;

    toggleClass(this.player.wrapper, 'fluid_zoom_active', active);
    toggleClass(this.indicator, 'fluid_zoom_visible', active);

    const zoomValue = `${Math.round(this.scale * 100)}%`;
    this.value.textContent = zoomValue;
    this.indicator.setAttribute('aria-label', `${this.player.config.captions.zoom} ${zoomValue}`);
    this.updateMenu();

    triggerEvent.call(this.player, this.player.media, 'zoomchange', false, { scale: this.scale });
  };

  reset = () => {
    this.scale = this.config.reset;
    this.x = 0;
    this.y = 0;
    this.render();
  };

  resize = () => {
    this.clampPosition();
    this.render();
  };

  suppressInteraction = () => {
    this.suppressUntil = performance.now() + 400;
  };

  consumeInteraction = () => {
    if (performance.now() >= this.suppressUntil) {
      return false;
    }

    this.suppressUntil = 0;
    return true;
  };

  isInteracting = () => {
    return this.pointers.size > 1 || this.pinch !== null;
  };

  isControl = (target) => {
    if (!target) {
      return false;
    }

    return (
      this.player.controls.container.contains(target) ||
      this.player.menu.menu?.contains(target) ||
      this.player.contextMenu.menu?.contains(target) ||
      this.indicator.contains(target)
    );
  };

  destroy = () => {
    this.pointers.clear();
    this.pinch = null;
    this.pan = null;
  };
}

export default Zoom;
