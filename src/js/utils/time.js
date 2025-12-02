export function convertTimeStringToSeconds(str) {
  if (!(str && str.match(/^(\d){2}(:[0-5][0-9]){2}(.(\d){1,3})?$/))) {
    return false;
  }

  const timeParts = str.split(':');
  return parseInt(timeParts[0], 10) * 3600 + parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
}

// Format time to hh:mm:ss
export function formatTime(duration) {
  const totalSeconds = Math.floor(duration);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const d = pad(days);
  const h = pad(hours);
  const m = pad(minutes);
  const s = pad(seconds);

  if (days > 0) {
    return `${d}:${h}:${m}:${s}`;
  }

  return hours >= 1 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function pad(value) {
  if (value < 10) {
    return '0' + value;
  }
  return value;
}
