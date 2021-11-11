export function convertTimeStringToSeconds(str) {
    if (!(str && str.match(/^(\d){2}(:[0-5][0-9]){2}(.(\d){1,3})?$/))) {
        return false;
    }

    const timeParts = str.split(':');
    return parseInt(timeParts[0], 10) * 3600 + parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
}

// Format time to hh:mm:ss
export function formatTime(duration) {
    const formatDateObj = new Date(duration * 1000);
    const formatHours = pad(formatDateObj.getUTCHours());
    const formatMinutes = pad(formatDateObj.getUTCMinutes());
    const formatSeconds = pad(formatDateObj.getSeconds());

    return formatHours >= 1
        ? formatHours + ':' + formatMinutes + ':' + formatSeconds
        : formatMinutes + ':' + formatSeconds;
}

export function pad(value) {
    if (value < 10) {
        return '0' + value;
    }
    return value;
}
