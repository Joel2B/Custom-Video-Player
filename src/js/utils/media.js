import { getFileExtension } from './url';
import { getMimetype, MimetypesKind } from './mimetypes';

const normalizeType = (type = '') => type.toLowerCase().split(';')[0].trim();

export function isHLS(url, type) {
  const mediaType = normalizeType(type);
  return getFileExtension(url) === 'm3u8' || mediaType === MimetypesKind.m3u8 || mediaType === MimetypesKind.m3u8_2;
}

export const supportsHLS = document.createElement('video').canPlayType('application/vnd.apple.mpegurl');

export function isDASH(url, type) {
  return getFileExtension(url) === 'mpd' || normalizeType(type) === MimetypesKind.mpd;
}

export function isMKV(url) {
  return getFileExtension(url) === 'mkv';
}

export function isMp4(url) {
  return getFileExtension(url) === 'mp4';
}

export function isWebM(url) {
  return getFileExtension(url) === 'webm';
}

export function isSource(url, type, media, capabilityType = type) {
  const mediaType = getMimetype(url) || normalizeType(type);

  return (
    isHLS(url, mediaType) ||
    isDASH(url, mediaType) ||
    mediaType === MimetypesKind.mkv ||
    Boolean(media?.canPlayType(capabilityType))
  );
}
