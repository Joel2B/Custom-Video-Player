export default function(self, options) {
    self.storageAvailable = () => {
        try {
            const test = '__storage_test__';
            const storage = window.localStorage;
            storage.setItem(test, test);
            storage.removeItem(test);
            return true;
        } catch (error) {

        }
    };

    self.setLocalStorage = (key, value, days) => {
        if (!self.storageAvailable()) {
            return;
        }
        const data = {
            value: value,
            expire: new Date().getTime() / 1000 + 60 * 60 * 24 * (days || 30),
        };
        localStorage.setItem(key, JSON.stringify(data));
    };

    self.getLocalStorage = (key) => {
        if (!self.storageAvailable()) {
            return;
        }
        const data = JSON.parse(localStorage.getItem(key));
        if (!data || data.expire < new Date().getTime() / 1000) {
            localStorage.removeItem(key);
            return null;
        }
        return data.value;
    };

    self.removeLocalStorage = (key) => {
        if (!self.storageAvailable()) {
            return;
        }
        localStorage.removeItem(key);
    };
}
