// ==========================================================================
// Fullscreen wrapper
// https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API#prefixing
// https://webkit.org/blog/7929/designing-websites-for-iphone-x/
// ==========================================================================

import { IS_IOS } from './utils/browser';
import { hasClass, toggleClass, toggleHidden } from './utils/dom';
import { on, triggerEvent } from './utils/events';
import is from './utils/is';

class Fullscreen {
  constructor(player) {
    // Keep reference to parent
    this.player = player;

    // Get prefix
    this.prefix = Fullscreen.prefix;
    this.property = Fullscreen.property;

    // Scroll position
    this.scrollPosition = { x: 0, y: 0 };

    // Force the use of 'full window/browser' rather than fullscreen
    this.forceFallback = player.config.layoutControls.fullscreen.fallback === 'force';

    // Register event listeners
    // Handle event (incase user presses escape etc)
    on.call(
      this.player,
      document,
      this.prefix === 'ms' ? 'MSFullscreenChange' : `${this.prefix}fullscreenchange`,
      () => {
        // TODO: Filter for target??
        this.onChange();
      },
    );

    // Fullscreen toggle on double click
    if (this.player.config.layoutControls.doubleclickFullscreen && !this.player.touch) {
      on.call(this.player, this.player.wrapper, 'dblclick', (event) => {
        // Ignore double click in controls
        if (this.player.controls.container.contains(event.target) || this.player.menu.menu.contains(event.target)) {
          return;
        }

        this.toggle();
      });
    }

    // Update the UI
    this.update();
  }

  // Determine if native supported
  static get native() {
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
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
    const prefixes = ['webkit', 'moz', 'ms'];

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

    // Fallback using classname
    if (!Fullscreen.native || this.forceFallback) {
      return hasClass(this.target, 'fluid_fullscreen_fallback');
    }

    const element = !this.prefix
      ? this.target.getRootNode().fullscreenElement
      : this.target.getRootNode()[`${this.prefix}${this.property}Element`];

    return element && element.shadowRoot ? element === this.target.getRootNode().host : element === this.target;
  }

  // Get target element
  get target() {
    return IS_IOS && this.player.config.layoutControls.fullscreen.iosNative ? this.player.media : this.player.wrapper;
  }

  onChange = () => {
    if (!this.enabled) {
      return;
    }

    const { player } = this;

    const fs = player.controls.fullscreen;

    toggleClass(fs, 'fluid_button_fullscreen', !this.active);
    toggleClass(fs, 'fluid_button_fullscreen_exit', this.active);

    player.contextMenu.fs.textContent = player.config.captions[this.active ? 'exitFullscreen' : 'fullscreen'];

    // Trigger an event
    triggerEvent.call(this.player, this.player.media, this.active ? 'enterfullscreen' : 'exitfullscreen', true);
  };

  toggleFallback = (toggle = false) => {
    // Store or restore scroll position
    if (toggle) {
      this.scrollPosition = {
        x: window.scrollX || 0,
        y: window.scrollY || 0,
      };
    } else {
      window.scrollTo(this.scrollPosition.x, this.scrollPosition.y);
    }

    // Toggle scroll
    document.body.style.overflow = toggle ? 'hidden' : '';

    // Toggle class hook
    toggleClass(this.target, 'fluid_fullscreen_fallback', toggle);

    // Force full viewport on iPhone X+
    if (IS_IOS) {
      let viewport = document.head.querySelector('meta[name="viewport"]');
      const property = 'viewport-fit=cover';

      // Inject the viewport meta if required
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
      }

      // Check if the property already exists
      const hasProperty = is.string(viewport.content) && viewport.content.includes(property);

      if (toggle) {
        this.cleanupViewport = !hasProperty;

        if (!hasProperty) {
          viewport.content += `,${property}`;
        }
      } else if (this.cleanupViewport) {
        viewport.content = viewport.content
          .split(',')
          .filter((part) => part.trim() !== property)
          .join(',');
      }
    }

    // Toggle button and fire events
    this.onChange();
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

      if (this.target.requestFullscreen) {
        this.target.requestFullscreen().catch(() => {
          this.toggleFallback(true);
        });
        return;
      }

      this.toggleFallback(true);
      return;
    }

    if (!Fullscreen.native || this.forceFallback) {
      this.toggleFallback(true);
    } else if (!this.prefix) {
      this.target.requestFullscreen?.({ navigationUI: 'hide' }).catch?.(() => {
        this.toggleFallback(true);
      });
    } else if (!is.empty(this.prefix)) {
      this.target[`${this.prefix}Request${this.property}`]();
    }
  };

  // Bail from fullscreen
  exit = () => {
    if (!this.enabled) {
      return;
    }

    // iOS native fullscreen
    if (IS_IOS && this.player.config.layoutControls.fullscreen.iosNative) {
      this.target.webkitExitFullscreen();
      this.player.play();
    } else if (!Fullscreen.native || this.forceFallback) {
      this.toggleFallback(false);
    } else if (!this.prefix) {
      (document.cancelFullScreen || document.exitFullscreen).call(document);
    } else if (!is.empty(this.prefix)) {
      const action = this.prefix === 'moz' ? 'Cancel' : 'Exit';
      document[`${this.prefix}${action}${this.property}`]();
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
}

export default Fullscreen;
