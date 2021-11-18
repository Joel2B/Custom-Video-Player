import { isInFrame, toggleClass } from '../utils/dom';
import { on, triggerEvent } from '../utils/events';
import is from '../utils/is';

class Theatre {
    constructor(player) {
        this.player = player;
        this.active = false;

        this.init();
    }

    init = () => {
        const { player } = this;

        if (!player.config.layoutControls.allowTheatre || isInFrame()) {
            player.controls.theatre.style.display = 'none';
            return;
        }

        player.controls.theatre.style.display = 'inline-block';

        on.call(player, player.controls.theatre, 'click', this.toggle);
    };

    toggle = () => {
        if (isInFrame()) {
            return;
        }

        const { player } = this;

        // Keep in theatre mode
        if (player.fullscreen.active) {
            player.fullscreen.toggle();
            if (this.active) {
                return;
            }
        }

        // Advanced Theatre mode if specified
        if (player.config.layoutControls.theatreAdvanced) {
            const custom = document.getElementById(player.config.layoutControls.theatreAdvanced.theatreElement);
            const customClass = player.config.layoutControls.theatreAdvanced.classToApply;
            if (is.element(custom)) {
                toggleClass(custom, customClass, !this.active);
            } else {
                player.debug.log(`Theatre element not found: ${custom}`);
                // Default overlay behaviour
                this.defaultLayout();
            }
        } else {
            // Default overlay behaviour
            this.defaultLayout();
        }

        // Set correct variables
        this.active = !this.active;
        player.storage.set('theatre', this.active);

        // Trigger theatre event
        triggerEvent.call(player, player.media, this.active ? 'theatreModeOn' : 'theatreModeOff');
    };

    defaultLayout = () => {
        const { player } = this;
        const { wrapper } = player;

        if (this.active) {
            toggleClass(wrapper, 'fluid_theatre_mode', false);

            wrapper.style.maxHeight = '';
            wrapper.style.marginTop = '';
            wrapper.style.left = '';
            wrapper.style.right = '';
            wrapper.style.position = '';

            if (!player.config.layoutControls.fillToContainer) {
                wrapper.style.width = player.originalWidth + 'px';
                wrapper.style.height = player.originalHeight + 'px';
            } else {
                wrapper.style.width = '100%';
                wrapper.style.height = '100%';
            }

            return;
        }

        toggleClass(wrapper, 'fluid_theatre_mode', true);

        const workingWidth = player.config.layoutControls.theatreSettings.width;
        let defaultHorizontalMargin = '10px';

        wrapper.style.width = workingWidth;
        wrapper.style.height = player.config.layoutControls.theatreSettings.height;
        wrapper.style.maxHeight = screen.height + 'px';
        wrapper.style.marginTop = player.config.layoutControls.theatreSettings.marginTop + 'px';

        switch (player.config.layoutControls.theatreSettings.horizontalAlign) {
            case 'center':
                // We must calculate the margin differently based on whether they passed % or px
                if (workingWidth.endsWith('%')) {
                    // A margin of half the remaining space
                    defaultHorizontalMargin =
                        (100 - parseInt(workingWidth.substring(0, workingWidth.length - 1))) / 2 + '%';
                } else if (workingWidth.endsWith('px')) {
                    // Half the (Remaining width / fullwidth)
                    defaultHorizontalMargin =
                        (((screen.width - parseInt(workingWidth.substring(0, workingWidth.length - 2))) /
                            screen.width) *
                            100) /
                            2 +
                        '%';
                } else {
                    player.debug.log('Theatre width specified invalid.');
                }

                wrapper.style.left = defaultHorizontalMargin;
                break;
            case 'right':
                wrapper.style.right = defaultHorizontalMargin;
                break;
            case 'left':
            default:
                wrapper.style.left = defaultHorizontalMargin;
                break;
        }
    };

    apply = () => {
        if (this.player.storage.get('theatre')) {
            this.toggle();
        }
    };
}

export default Theatre;
