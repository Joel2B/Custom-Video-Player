export default function (self, options) {
    // TODO: rename
    self.announceLocalError = (code, msg) => {
        const parsedCode = typeof (code) !== 'undefined' ? parseInt(code) : 900;
        let message = '[Error] (' + parsedCode + '): ';
        message += !msg ? 'Failed to load Vast' : msg;
        console.warn(message);
    };

    // TODO: move this somewhere else and refactor
    self.debugMessage = (msg) => {
        if (self.displayOptions.debug) {
            console.log(msg);
        }
    };
}