import { triggerEvent } from './utils/events';

class UserActivity {
    constructor(player) {
        this.player = player;
        this.newActivity = null;
        this.inactivityTimeout = null;
        this.active = false;
        this.isStillDown = false;

        this.checker();
    }

    activity = (event) => {
        if (this.player.touch && event.type.includes('mouse')) {
            return;
        }

        if (event.type === 'touchstart' || event.type === 'mousedown') {
            this.isStillDown = true;
        }
        if (event.type === 'touchend' || event.type === 'mouseup') {
            this.isStillDown = false;
        }
        this.newActivity = true;
    };

    checker = () => {
        const { player } = this;

        this.newActivity = null;

        setInterval(() => {
            if (!this.newActivity) {
                return;
            }

            if (!this.isStillDown && !this.isLoading) {
                this.newActivity = false;
            }

            if (!this.active) {
                triggerEvent.call(player, player.media, 'userActive');
                this.active = true;
            }

            clearTimeout(this.inactivityTimeout);

            this.inactivityTimeout = setTimeout(() => {
                if (this.newActivity) {
                    clearTimeout(this.inactivityTimeout);
                    return;
                }

                this.active = false;

                triggerEvent.call(player, player.media, 'userInactive');
            }, player.config.layoutControls.controlBar.autoHideTimeout * 1000);
        }, 300);
    };
}

export default UserActivity;
