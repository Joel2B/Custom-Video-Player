export function isHLS(url) {
    return url.includes('.m3u8');
};

export const supportsHLS = document.createElement('video').canPlayType('application/vnd.apple.mpegurl');

export function isDASH(url) {
    return url.includes('.mpd');
};

export function isMKV(url) {
    return url.includes('.mkv');
};

export function isMp4(url) {
    return url.includes('.mp4');
};

export function isSource(url) {
    return isHLS(url) || isDASH(url) || isMKV(url) || isMp4(url);
};
