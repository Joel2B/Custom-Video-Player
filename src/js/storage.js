import is from './utils/is';

class Storage {
  constructor(player) {
    const { storage } = player.config;

    this.enabled = storage.enabled;
    this.key = storage.key;
    this.expiration = storage.expiration;

    this.key += '_';

    if (!storage.shared) {
      this.key = `${player.videoPlayerId}:${this.key}`;
    }
  }

  supported = () => {
    try {
      const test = '__storage_test__';
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      return true;
    } catch (_) {
      return false;
    }
  };

  set = (key, value) => {
    if (!this.supported() || !this.enabled) {
      return;
    }

    const data = {
      value,
      expire: new Date().getTime() / 1000 + 60 * 60 * 24 * (this.expiration || 30),
    };

    window.localStorage.setItem(this.key + key, JSON.stringify(data));
  };

  get = (key) => {
    if (!this.supported() || !this.enabled) {
      return null;
    }

    const data = JSON.parse(window.localStorage.getItem(this.key + key));

    if (is.empty(data) || data.expire <= new Date().getTime() / 1000) {
      window.localStorage.removeItem(this.key + key);
      return null;
    }

    return data.value;
  };

  remove = (key) => {
    if (!this.supported() || !this.enabled) {
      return;
    }

    window.localStorage.removeItem(this.key + key);
  };
}

export default Storage;
