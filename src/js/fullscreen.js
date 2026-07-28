// ==========================================================================
// Fullscreen wrapper
// https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API#prefixing
// https://webkit.org/blog/7929/designing-websites-for-iphone-x/
// ==========================================================================

import { IS_IOS } from './utils/browser';
import { hasClass, toggleClass, toggleHidden } from './utils/dom';
import { off, on, triggerEvent } from './utils/events';
import is from './utils/is';

let activeFallback = null;

class Fullscreen {
  constructor(player) {
    // Keep reference to parent
    this.player = player;

    // Get prefix
    this.prefix = Fullscreen.prefix;
    this.property = Fullscreen.property;

    // Scroll position
    this.scrollPosition = { x: 0, y: 0 };
    this.bodyOverflow = null;
    this.viewportState = null;
    this.fallbackActive = false;
    this.iosNativeActive = false;
    this.destroyed = false;

    // Force the use of 'full window/browser' rather than fullscreen
    this.forceFallback = player.config.layoutControls.fullscreen.fallback === 'force';

    // Register event listeners
    // Handle event (incase user presses escape etc)
    this.fullscreenChangeEvent = `${this.prefix}fullscreenchange`;
    this.nativeActive = this.nativeFullscreenActive;
    on.call(this.player, document, this.fullscreenChangeEvent, this.onNativeChange);

    if (IS_IOS && this.player.config.layoutControls.fullscreen.iosNative) {
      on.call(this.player, this.player.media, 'webkitbeginfullscreen', this.onIOSNativeBegin);
      on.call(this.player, this.player.media, 'webkitendfullscreen', this.onIOSNativeEnd);
    }

    // Fullscreen toggle on double click
    if (this.player.config.layoutControls.doubleclickFullscreen && !this.player.touch) {
      this.onDoubleClick = (event) => {
        // Ignore double click in controls
        if (this.player.controls.container.contains(event.target) || this.player.menu.menu.contains(event.target)) {
          return;
        }

        this.toggle();
      };

      on.call(this.player, this.player.wrapper, 'dblclick', this.onDoubleClick);
    }

    // Update the UI
    this.update();
  }

  // Determine if native supported
  static get native() {
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled
    );
  }

  // If we're actually using native
  get usingNative() {
    return Fullscreen.native && !this.forceFallback;
  }

  // Get the prefix for handlers
  static get prefix() {
    // No prefix
    if (is.function(document.exitFullscreen)) {
      return '';
    }

    // Check for fullscreen support by vendor prefix
    let value = '';
    const prefixes = ['webkit', 'moz'];

    prefixes.some((pre) => {
      if (is.function(document[`${pre}ExitFullscreen`]) || is.function(document[`${pre}CancelFullScreen`])) {
        value = pre;
        return true;
      }

      return false;
    });

    return value;
  }

  static get property() {
    return this.prefix === 'moz' ? 'FullScreen' : 'Fullscreen';
  }

  // Determine if fullscreen is enabled
  get enabled() {
    return (
      (Fullscreen.native || this.player.config.layoutControls.fullscreen.fallback) &&
      this.player.config.layoutControls.fullscreen.enabled
    );
  }

  // Get active state
  get active() {
    if (!this.enabled) {
      return false;
    }

    if (IS_IOS && this.player.config.layoutControls.fullscreen.iosNative && this.iosNativeActive) {
      return true;
    }

    // Fallback using classname
    if (this.fallbackActive || !Fullscreen.native || this.forceFallback) {
      return hasClass(this.player.wrapper, 'fluid_fullscreen_fallback');
    }

    return this.nativeFullscreenActive;
  }

  get nativeFullscreenActive() {
    if (!Fullscreen.native) {
      return false;
    }

    const element = !this.prefix
      ? this.target.getRootNode().fullscreenElement
      : this.target.getRootNode()[`${this.prefix}${this.property}Element`];

    return !!element && (element.shadowRoot ? element === this.target.getRootNode().host : element === this.target);
  }

  // Get target element
  get target() {
    return IS_IOS && this.player.config.layoutControls.fullscreen.iosNative ? this.player.media : this.player.wrapper;
  }

  onNativeChange = () => {
    if (this.destroyed || !this.enabled || !this.usingNative) {
      return;
    }

    const active = this.nativeFullscreenActive;

    if (active === this.nativeActive) {
      return;
    }

    this.nativeActive = active;
    this.onChange(active);
  };

  onIOSNativeBegin = () => {
    if (this.destroyed || this.iosNativeActive) {
      return;
    }

    this.iosNativeActive = true;
    this.onChange(true);
  };

  onIOSNativeEnd = () => {
    if (this.destroyed || !this.iosNativeActive) {
      return;
    }

    this.iosNativeActive = false;
    this.onChange(false);
  };

  onChange = (active = this.active) => {
    if (!this.enabled) {
      return;
    }

    const { player } = this;

    const fs = player.controls.fullscreen;

    toggleClass(fs, 'fluid_button_fullscreen', !active);
    toggleClass(fs, 'fluid_button_fullscreen_exit', active);
    fs.setAttribute('aria-pressed', String(active));
    fs.setAttribute('aria-label', player.config.captions[active ? 'exitFullscreen' : 'fullscreen']);

    if (player.contextMenu.fs) {
      player.contextMenu.fs.textContent = player.config.captions[active ? 'exitFullscreen' : 'fullscreen'];
    }

    if (player.controls.fullscreenTooltip) {
      player.controls.fullscreenTooltip.textContent = player.config.captions[active ? 'exitFullscreen' : 'fullscreen'];
    }

    // Trigger an event
    triggerEvent.call(this.player, this.player.media, active ? 'enterfullscreen' : 'exitfullscreen', true);
  };

  toggleFallback = (toggle = false, notify = true) => {
    if (toggle === this.fallbackActive) {
      return;
    }

    if (toggle && activeFallback && activeFallback !== this) {
      activeFallback.toggleFallback(false);
      if (activeFallback) {
        return;
      }
    }

    // Store or restore scroll position
    if (toggle) {
      this.scrollPosition = {
        x: window.scrollX || 0,
        y: window.scrollY || 0,
      };

      this.bodyOverflow = {
        value: document.body.style.getPropertyValue('overflow'),
        priority: document.body.style.getPropertyPriority('overflow'),
      };
    } else {
      window.scrollTo(this.scrollPosition.x, this.scrollPosition.y);
    }

    // Toggle scroll
    if (toggle) {
      document.body.style.setProperty('overflow', 'hidden');
    } else if (this.bodyOverflow.value) {
      document.body.style.setProperty('overflow', this.bodyOverflow.value, this.bodyOverflow.priority);
    } else {
      document.body.style.removeProperty('overflow');
    }

    // Toggle class hook
    toggleClass(this.player.wrapper, 'fluid_fullscreen_fallback', toggle);
    this.fallbackActive = toggle;
    activeFallback = toggle ? this : activeFallback === this ? null : activeFallback;

    // Force full viewport on iPhone X+
    if (IS_IOS) {
      let viewport = document.head.querySelector('meta[name="viewport"]');
      const property = 'viewport-fit=cover';
      const created = !viewport;

      // Inject the viewport meta if required
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        document.head.appendChild(viewport);
      }

      // Check if the property already exists
      const hasProperty = is.string(viewport.content) && viewport.content.includes(property);

      if (toggle) {
        this.viewportState = {
          element: viewport,
          created,
          content: viewport.getAttribute('content'),
          changed: !hasProperty,
        };

        if (!hasProperty) {
          viewport.content = viewport.content ? `${viewport.content},${property}` : property;
        }
      } else if (this.viewportState) {
        const { element, created: viewportCreated, content, changed } = this.viewportState;

        if (viewportCreated) {
          element.remove();
        } else if (changed && content === null) {
          element.removeAttribute('content');
        } else if (changed) {
          element.setAttribute('content', content);
        }

        this.viewportState = null;
      }
    }

    // Toggle button and fire events
    if (notify) {
      this.onChange(toggle);
    }
  };

  // Update UI
  update = () => {
    if (this.enabled) {
      let mode;

      if (this.forceFallback) {
        mode = 'Fallback (forced)';
      } else if (Fullscreen.native) {
        mode = 'Native';
      } else {
        mode = 'Fallback';
      }

      this.player.debug.log(`${mode} fullscreen enabled`);
    } else {
      toggleHidden(this.player.controls.fullscreen, true);

      this.player.debug.log('Fullscreen not supported and fallback disabled');
    }
  };

  // Make an element fullscreen
  enter = () => {
    if (!this.enabled) {
      return;
    }

    // iOS native fullscreen doesn't need the request step
    if (IS_IOS && this.player.config.layoutControls.fullscreen.iosNative) {
      if (typeof this.target.webkitEnterFullscreen === 'function') {
        this.target.webkitEnterFullscreen();
        return;
      }

      if (is.function(this.target.requestFullscreen)) {
        const request = this.target.requestFullscreen();
        if (request && is.function(request.catch)) {
          request.catch(() => {
            if (!this.destroyed) {
              this.toggleFallback(true);
            }
          });
        }
        return;
      }

      this.toggleFallback(true);
      return;
    }

    if (!Fullscreen.native || this.forceFallback) {
      this.toggleFallback(true);
    } else if (!this.prefix) {
      const request = this.target.requestFullscreen?.({ navigationUI: 'hide' });
      if (request && is.function(request.catch)) {
        request.catch(() => {
          if (!this.destroyed) {
            this.toggleFallback(true);
          }
        });
      }
    } else if (!is.empty(this.prefix)) {
      this.target[`${this.prefix}Request${this.property}`]();
    }
  };

  exitNative = () => {
    if (!this.prefix) {
      const exit = document.cancelFullScreen || document.exitFullscreen;
      if (is.function(exit)) {
        const request = exit.call(document);
        if (request && is.function(request.catch)) {
          request.catch(() => {});
        }
      }
    } else if (!is.empty(this.prefix)) {
      const action = this.prefix === 'moz' ? 'Cancel' : 'Exit';
      const exit = document[`${this.prefix}${action}${this.property}`];
      if (is.function(exit)) {
        const request = exit.call(document);
        if (request && is.function(request.catch)) {
          request.catch(() => {});
        }
      }
    }
  };

  // Bail from fullscreen
  exit = () => {
    if (!this.enabled) {
      return;
    }

    if (this.fallbackActive) {
      this.toggleFallback(false);
    } else if (
      IS_IOS &&
      this.player.config.layoutControls.fullscreen.iosNative &&
      this.iosNativeActive &&
      is.function(this.target.webkitExitFullscreen)
    ) {
      this.target.webkitExitFullscreen();
      this.player.play();
    } else if (!Fullscreen.native || this.forceFallback) {
      this.toggleFallback(false);
    } else {
      this.exitNative();
    }
  };

  // Toggle state
  toggle = () => {
    if (!this.active) {
      this.enter();
    } else {
      this.exit();
    }
  };

  destroy = () => {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    off(document, this.fullscreenChangeEvent, this.onNativeChange);
    off(this.player.media, 'webkitbeginfullscreen', this.onIOSNativeBegin);
    off(this.player.media, 'webkitendfullscreen', this.onIOSNativeEnd);

    if (this.onDoubleClick) {
      off(this.player.wrapper, 'dblclick', this.onDoubleClick);
    }

    if (this.fallbackActive) {
      this.toggleFallback(false, false);
    } else {
      toggleClass(this.player.wrapper, 'fluid_fullscreen_fallback', false);

      if (this.iosNativeActive && is.function(this.target.webkitExitFullscreen)) {
        this.target.webkitExitFullscreen();
      } else if (this.nativeFullscreenActive) {
        this.exitNative();
      }
    }
  };
}

export default Fullscreen;
