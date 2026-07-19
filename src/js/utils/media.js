import { getMimetype, MimetypesKind } from './mimetypes';

const normalizeType = (type = '') => type.toLowerCase().split(';')[0].trim();

export function isHLS(url, type) {
  const mediaType = normalizeType(type);
  return url.includes('.m3u8') || mediaType === MimetypesKind.m3u8 || mediaType === MimetypesKind.m3u8_2;
}

export const supportsHLS = document.createElement('video').canPlayType('application/vnd.apple.mpegurl');

export function isDASH(url, type) {
  return url.includes('.mpd') || normalizeType(type) === MimetypesKind.mpd;
}

export function isMKV(url) {
  return url.includes('.mkv');
}

export function isMp4(url) {
  return url.includes('.mp4');
}

export function isWebM(url) {
  return url.includes('.webm');
}

export function isSource(url, type) {
  const mediaType = getMimetype(url) || normalizeType(type);

  return (
    isHLS(url, mediaType) ||
    isDASH(url, mediaType) ||
    [MimetypesKind.mkv, MimetypesKind.mp4, MimetypesKind.webm].includes(mediaType)
  );
}
