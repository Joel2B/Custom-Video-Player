# Custom Video Player
HTML5 Video Player, based on Fluid Player v3.0.4

Desktop

![image](https://user-images.githubusercontent.com/58922368/141259307-d62c17a0-3e1c-46bb-bc34-c00df375f83e.jpg)

Mobile

![1](https://user-images.githubusercontent.com/58922368/147867823-1d4d4138-958e-4abe-97ce-de0ce6139bd1.jpg)
![2](https://user-images.githubusercontent.com/58922368/147867825-8c5396f7-3a6e-4e64-91fa-d3da4428c4bf.jpg)

## Difference with fluid player
* Some errors fixed
* Smooth animations
* Customized timeline
* Customized thumbnails
* A main menu
    * Autoplay
    * Loop
    * Speed
    * Quality
    * Audio
    * Subtitles
* Forward and backward one frame

## Demo
[Custom Video Player](https://appsdev.cyou/xv-ph-rt/)

[E2E cases](https://appsdev.cyou/player/tests/)

## Quick setup
```HTML
<video id="video-player">
    <source src="https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8" type="application/x-mpegURL"/>
</video>

<script src="https://appsdev.cyou/player/v1/current/player.min.js"></script>

<script>
    var instance = fluidPlayer('video-player');
</script>
```

## Build Project
1. install project dependencies: `npm install`
2. run `npm run build-dev`

## Changes

New options:
| Option | Default | Description |
| :--- | :--- | :--- |
| Debug | false | Display debugging information in the console
| Storage | { enabled: true, key: 'cvp', expiration: 30, shared: true, } | `enabled`: enables local storage for saving settings. `key`: prefix to be used for each setting. `expiration`: days that settings will last. `shared`: share settings between all instances. |
| Audio | { language: 'auto' } | `language`: sets the default language (if available)
| Subtitles | { active: false, language: 'auto', native: false, useVttjs: false, timestampMap: true, } | `active`: always use subtitles. `native`: the browser will handle subtitles or not. `useVttjs`: use a library to display subtitles. `timestampMap`: use in case of out-of-sync between subtitles and video (can work or not). `language`: sets the default language (if available)
| Hls | { url: 'https<nolink>://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js', debug: false, overrideNative: false, config: (options) => { return options; }} | `url`: url of the hls.js library. `debug`: debug logs in console. `overrideNative`: use native hls or not. `config`: to configure it

Hls.js:

`overrideNative`: When is true, if the platform supports Media Source Extensions hls.js will take over HLS playback and will be possible to change the quality, audio and subtitles manually

## Documentation
Everything you can do in [fluidplayer](https://docs.fluidplayer.com/) you can do it here
