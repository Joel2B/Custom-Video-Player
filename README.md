# Custom Video Player
HTML5 Video Player, based on Fluid Player v3.0.4

![image](https://user-images.githubusercontent.com/58922368/141259307-d62c17a0-3e1c-46bb-bc34-c00df375f83e.jpg)

## Difference with fluid player
* Some errors fixed
* Smooth animations
* Customized timeline
* Customized thumbnails
* A main menu (autoplay, loop, speed, quality)
* Forward and backward one frame

## Demo
[Custom Video Player](https://appsdev.cyou/xv-ph-rt/)

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
| Storage | storage: { enabled: true, key: 'cvp', expiration: 30, shared: true, } | `enabled`: enables local storage for saving settings. `key`: prefix to be used for each setting. `expiration`: days that settings will last. `shared`: share settings between all instances. |

Hls.js:

`overrideNative`: When is true, if the platform supports Media Source Extensions hls.js will take over HLS playback and will be possible to change the quality manually

## Documentation
Everything you can do in [fluidplayer](https://docs.fluidplayer.com/) you can do it here
