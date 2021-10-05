# Custom Video Player


HTML5 Video Player, based on Fluid Player v3.0.4

### how to use it

```HTML
<video id="video-player">
    <source src="https://multiplatform-f.akamaihd.net/i/multi/will/bunny/big_buck_bunny_,640x360_400,640x360_700,640x360_1000,950x540_1500,.f4v.csmil/master.m3u8" type="application/x-mpegURL"/>
</video>

<script src="player.min.js"></script>

<script>
    var instance = fluidPlayer('video-player');
</script>
```

### Example online
[Custom Video Player](https://appsdev.cyou/xv-ph-rt/)

### Build Project

1. install project dependencies: `npm install`

### Documentation

The integration and configuration of Fluid Player is fully outlined in Fluid [Player Documentation](https://docs.fluidplayer.com/)
