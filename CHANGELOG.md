# 2.0.0 (2026-07-30)

### Changed

- Dropped Internet Explorer 11 support.
- Added immutable CDN deployment URLs addressed by deployment ID and SHA-256.
- Hardened deployment locking, ZIP extraction, rollback, retention, SSH options, and Nginx validation.
- Stopped publishing source maps with public E2E builds.
- Restricted configurable links and credential-bearing XHR callbacks to explicit HTTPS trust boundaries.
- Added stable release promotion with immutable version URLs and Subresource Integrity metadata.

### Fixed

- Prevented hidden settings-menu pages from remaining keyboard-focusable.
- Hardened fullscreen, responsive controls, XHR cancellation, player lifecycle, and deployment rollback behavior.
- Bounded VTT and HLS subtitle memory use and removed unsafe CSS and DOM insertion paths.

# 1.0.0 (2021-08-02)

### Features

- smooth animation in the progress bar
- preview improvements
- resizing of the progress bar when resizing windows
- seek to next frame
- Instantly update progress bar
- Use libraries via CDN
- custom menu (Playback Rate, Quality level, AutoPlay, Loop)
- keyboard shortcut info in desktop mode
- hover progress
- animation on the menu button

### Bug Fixes

- wrong position of the progress bar
- hide the preview when exiting the progress bar
- basic preview shaking
- play button disappears
- doesn't unmute with keyboard
- mobile scroll
