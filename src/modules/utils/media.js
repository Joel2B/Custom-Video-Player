export default function (self) {
    self.isHLS = (url) => {
        return url.includes('.m3u8');
    }

    self.isDASH = (url) => {
        return url.includes('.mpd');
    }

    self.isMKV = (url) => {
        return url.includes('.mkv');
    }

    self.isMp4 = (url) => {
        return url.includes('.mp4');
    }

    self.isSource = (url) => {
        return self.isHLS(url) || self.isDASH(url) || self.isMKV(url) || self.isMp4(url);
    }
}
