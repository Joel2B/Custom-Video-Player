export default function(self, options) {
    self.convertTimeStringToSeconds = (str) => {
        if (!(str && str.match(/^(\d){2}(:[0-5][0-9]){2}(.(\d){1,3})?$/))) {
            return false;
        }

        const timeParts = str.split(':');
        return parseInt(timeParts[0], 10) * 3600 + parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
    };

    // Format time to hh:mm:ss
    self.formatTime = (duration) => {
        const formatDateObj = new Date(duration * 1000);
        const formatHours = self.pad(formatDateObj.getUTCHours());
        const formatMinutes = self.pad(formatDateObj.getUTCMinutes());
        const formatSeconds = self.pad(formatDateObj.getSeconds());

        return formatHours >= 1
            ? formatHours + ':' + formatMinutes + ':' + formatSeconds
            : formatMinutes + ':' + formatSeconds;
    };

    self.pad = (value) => {
        if (value < 10) {
            return '0' + value;
        }
        return value;
    };
}
