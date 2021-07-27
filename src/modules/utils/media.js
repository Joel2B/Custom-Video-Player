export default function (self) {
    self.isHLS = (url) => {
        return url.includes('.m3u8');
    }

    self.isMKV = (url) => {
        return url.includes('.mkv');
    }
}
