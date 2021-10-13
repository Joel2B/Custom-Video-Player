# Custom Video Player
HTML5 Video Player, based on Fluid Player v3.0.4

![image](https://user-images.githubusercontent.com/58922368/137044109-df853ad2-de2d-48cc-b1cd-750a97dc3e6c.png)

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

## Documentation
Everything you can do in [fluidplayer](https://docs.fluidplayer.com/) you can do it here
