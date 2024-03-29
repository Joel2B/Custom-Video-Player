/**
 * Build entry point for CDN builds.
 * You SHOULD NOT import this file except if you plan to build browser distribution of Fluid Player.
 */

import playerInitializer from './index';

// Import SASS automatically in browser builds.
import './sass/player.scss';

if (window) {
  /**
   * Register public interface.
   */
  if (!window.fluidPlayer) {
    window.fluidPlayer = playerInitializer;
  }
}
