import './polyfills';
import playerInitializer from './js/player';

if (typeof FP_HOMEPAGE === 'undefined') {
    global.FP_HOMEPAGE = 'https://appsdev.cyou';
}

if (typeof FP_BUILD_VERSION === 'undefined') {
    global.FP_BUILD_VERSION = 'v3';
}

if (typeof FP_ENV === 'undefined') {
    const isLocalhost = window &&
        window.location &&
        (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '');

    if (process && process.env && process.env.NODE_ENV) {
        global.FP_ENV = process.env.NODE_ENV;
    } else if (window && !isLocalhost) {
        global.FP_ENV = 'production';
    } else {
        global.FP_ENV = 'development';
    }
}

if (typeof FP_DEBUG === 'undefined') {
    global.FP_DEBUG = false;
}

export default playerInitializer;
