export default function (self, options) {
    self.storageAvailable = () => {
        try {
            const test = '__storage_test__';
            const storage = window.localStorage;
            storage.setItem(test, test);
            storage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    self.setLocalStorage = (key, value, days) => {
        if (!self.storageAvailable()) {
            return false;
        }
        const data = {
            value: value,
            expire: new Date().getTime() / 1000 + 60 * 60 * 24 * (days || 1)
        }
        localStorage.setItem(key, JSON.stringify(data));
    }

    self.getLocalStorage = (key) => {
        if (!self.storageAvailable()) {
            return false;
        }
        let data = localStorage.getItem(key);
        if (!data) {
            return false;
        }
        data = JSON.parse(data);
        if (data.value == undefined || data.expire < new Date().getTime() / 1000) {
            localStorage.removeItem(key);
            return false;
        }
        return data.value;
    }

    self.removeLocalStorage = (key) => {
        if (!self.storageAvailable()) {
            return false;
        }
        localStorage.removeItem(key);
    }
}
