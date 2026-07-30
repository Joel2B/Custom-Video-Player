# Custom Video Player

HTML5 Video Player, based on Fluid Player v3.0.4

Desktop

![image](https://user-images.githubusercontent.com/58922368/141259307-d62c17a0-3e1c-46bb-bc34-c00df375f83e.jpg)

Mobile

![1](https://user-images.githubusercontent.com/58922368/147867823-1d4d4138-958e-4abe-97ce-de0ce6139bd1.jpg)
![2](https://user-images.githubusercontent.com/58922368/147867825-8c5396f7-3a6e-4e64-91fa-d3da4428c4bf.jpg)

## Difference with fluid player

- Some errors fixed
- No ads support (VAST/VPAID)
- Smooth animations
- Customized timeline
- Customized thumbnails
- A main menu
  - Autoplay
  - Loop
  - Speed
  - Quality
  - Audio
  - Subtitles
- Forward and backward one frame

## Demo

[Custom Video Player](https://player-demo.tinyapps.download/)

[E2E cases](https://player.tinyapps.download/)

## Setup

```HTML
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1.0" />
    <title>Player</title>
    <style>
      * {
        margin: 0;
        padding: 0;
      }

      body {
        width: 100%;
        height: 100%;
        position: absolute;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <video id="player">
      <source src="https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8" type="application/x-mpegURL" />
    </video>
    <!-- QA channel: accepts automatic updates from every deployed commit. -->
    <script src="https://player.tinyapps.download/v1/current/player.min.js"></script>
    <script>
      const options = {
        layoutControls: {
          fillToContainer: true,
          autoPlay: {
            waitInteraction: true,
          },
          playButtonShowing: true,
          playPauseAnimation: true,
          controlBar: {
            autoHide: true,
            autoHideTimeout: 3,
            animated: true,
            hideWhenPaused: false,
          },
          menu: {
            audio: true,
            subtitles: true,
          },
          fullscreen: {
            iosNative: true,
          },
        },
        hls: {
          overrideNative: true,
        },
        debug: true,
      };

      const player = fluidPlayer('player', options);
    </script>
  </body>
</html>
```

## Build Project

1. Install project dependencies: `npm ci`.
2. Run `npm run build-dev` for a local build with source maps.

## Browser Support

The player targets browsers selected by `> 0.25%` and `not dead`. Internet Explorer 11 is not supported.

Automated smoke tests run in Chromium and Firefox. Safari and iOS behavior should also be checked on a real device or simulator before releases that change media or fullscreen behavior.

## Testing

```text
npm run lint
npm run test:unit
npm run test:smoke
npm run test:webkit
npm run test:visual
pwsh ./deploy.ps1 -SelfTest
python3 deploy/test_safe_extract.py
npm run test:deploy
```

`npm run check` runs lint, production build, unit tests, and smoke tests. CI runs Chromium/Firefox smoke tests, focused WebKit coverage, and Win32 visual snapshots in separate jobs.

## CDN Deployments

Every commit deployment updates the uncached `current` channel. Use it for development, demos, and QA that explicitly accept automatic updates:

```html
<script src="https://player.tinyapps.download/v1/current/player.min.js"></script>
```

The `current` URL redirects to a deployment-specific URL containing its SHA-256 digest. Current builds expose the package version plus their commit, for example `2.0.0+b626634`.

After validating `current`, promote those exact bytes without rebuilding:

```text
npm run promote -- 2.0.0
```

Production integrations should pin the immutable version URL and SRI printed by promotion and recorded in its `release.json`:

```html
<script
  src="https://player.tinyapps.download/v1/versions/2.0.0/player.min.js"
  integrity="sha384-RELEASE_DIGEST"
  crossorigin="anonymous"
></script>
```

`/v1/stable/player.min.js` tracks the latest promoted version for consumers that accept automatic stable updates. Version URLs are immutable and cached for one year. `stable` and `current` remain uncached and independent.

Deploy with:

```text
npm run deploy
```

Required `.env` values are documented in `.env.example`. Deploy uses locked dependencies without lifecycle scripts, builds production CDN and E2E artifacts, validates ZIP entries and SHA-256, acquires local and remote locks, and keeps a persistent rollback transaction until Nginx reload succeeds. Public E2E builds omit source maps.

Production deploy should use the restricted `cvp-deploy` SSH account installed by `deploy/server/install.sh`. Its forced command accepts deployment packages over standard input and exposes no shell, forwarding, PTY, `sudo`, or Docker access beyond the root-owned Nginx activation helper.

Copy the deploy sources and dedicated Ed25519 public key into a root-owned staging directory, then run the installer there. The installer rejects source paths writable by non-root users:

```text
sudo install -d -o root -g root -m 700 /root/cvp-install
sudo cp -R deploy /root/cvp-install/
sudo cp /path/to/cvp_deploy.pub /root/cvp-install/
sudo chown -R root:root /root/cvp-install
sudo chmod -R go-w /root/cvp-install
sudo bash /root/cvp-install/deploy/server/install.sh /root/cvp-install/cvp_deploy.pub
```

The installer creates `cvp-deploy`, installs root-owned deploy and Nginx activation helpers, validates the dedicated sudoers rule, restricts `authorized_keys`, and grants ownership only over `/srv/cvp/player`. Keep an administrative SSH account separate from deployment credentials.

## Changes

New options:
| Option | Default | Description |
| :--- | :--- | :--- |
| Debug | false | Display debugging information in the console
| Locale | 'en' | Player interface language: `en`, `es`, or `auto`. `auto` uses the browser language and falls back to English. Locale is resolved only during initialization. |
| Storage | { enabled: true, key: 'cvp', expiration: 30, shared: true, } | `enabled`: enables local storage for saving settings. `key`: prefix to be used for each setting. `expiration`: days that settings will last. `shared`: share settings between all instances. |
| ControlBar | { autoHide: false, autoHideTimeout: 3, animated: true, hideWhenPaused: false, } | `autoHide`: hide controls when the user is inactive. `autoHideTimeout`: seconds before controls hide. `animated`: animate visibility changes. `hideWhenPaused`: allow controls to hide on mouse leave while paused. |
| Audio | { language: 'auto' } | `language`: sets the default language (if available)
| Subtitles | { active: false, language: 'auto', native: false, useVttjs: false, timestampMap: true, allowHtml: false, } | `active`: always use subtitles. `native`: the browser will handle subtitles or not. `useVttjs`: use a library to display subtitles. `timestampMap`: use in case of out-of-sync between subtitles and video (can work or not). `language`: sets the default language (if available). `allowHtml`: render subtitle cue text as HTML for trusted VTT files. Keep it disabled for remote or user-generated subtitles.
| HtmlOnPauseBlock | { html: null, height: null, width: null, } | `html`: trusted HTML shown while paused. Do not pass user-generated or remote HTML without sanitizing it first. `height` and `width`: block size in pixels.
| Hls | { url: 'https<nolink>://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js', debug: false, overrideNative: true, config: (options) => { return options; }} | `url`: url of the hls.js library. `debug`: debug logs in console. `overrideNative`: use native hls or not. `config`: to configure it

Hls.js:

`overrideNative`: When is true, if the platform supports Media Source Extensions hls.js will take over HLS playback and will be possible to change the quality, audio and subtitles manually

## Documentation

Some options and implementation details may still be documented on [fluidplayer](https://docs.fluidplayer.com/).
