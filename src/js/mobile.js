import { createElement, toggleClass, hasClass, insertAfter } from './utils/dom';
import { on } from './utils/events';
import is from './utils/is';

class Mobile {
    constructor(player) {
        this.player = player;

        this.touchTimer = null;
        this.forwardRewindTimer = null;
        this.showControlsTimer = null;

        this.singleTap = false;
        this.doubleTap = false;
        this.doubleTapRecent = false;

        this.totalForward = 0;
        this.totalRewind = 0;

        this.currentTimeForward = 0;
        this.currentTimeRewind = 0;

        this.init();
    }

    init = () => {
        if (!this.player.mobile) {
            return;
        }

        this.controls();
    };

    setup = () => {
        if (!this.player.mobile) {
            return;
        }

        this.player.controls.container = this.container;

        insertAfter(this.container, this.player.media);

        insertAfter(this.forwardRewind, this.player.media);
    };

    controls = () => {
        this.container = createElement('div', {
            class: 'fluid_mobile_controls',
        });

        this.player.controls.currentTime = createElement(
            'div',
            {
                class: 'fluid_time_elapsed',
            },
            '00:00',
        );
        this.container.appendChild(this.player.controls.currentTime);

        this.container.appendChild(this.player.controls.progressContainer);

        this.player.controls.duration = createElement(
            'div',
            {
                class: 'fluid_total_time',
            },
            '00:00',
        );
        this.container.appendChild(this.player.controls.duration);

        toggleClass(this.player.controls.live, 'mobile', true);

        this.container.appendChild(this.player.controls.live);

        this.container.appendChild(this.player.controls.fullscreen);

        // Forward / Rewind container
        this.forwardRewind = createElement('div', {
            class: 'fluid_forward_rewind',
        });

        // Info about forward / rewind
        this.forwardRewindInfoCon = createElement('div', {
            class: 'fluid_forward_rewind_info_con',
        });
        this.forwardRewind.appendChild(this.forwardRewindInfoCon);

        const forwardRewindInfo = createElement('div', {
            class: 'fluid_forward_rewind_info',
        });
        this.forwardRewindInfoCon.appendChild(forwardRewindInfo);

        const rewindInfo = createElement('div', {
            class: 'fluid_rewind_info',
        });
        forwardRewindInfo.appendChild(rewindInfo);

        for (let i = 0; i < 3; i++) {
            const rewindIcon = createElement('div', {
                class: 'fluid_icon fluid_icon_rewind',
            });
            rewindInfo.appendChild(rewindIcon);
        }

        const forwardRewindInfoText = createElement(
            'div',
            {
                class: 'fluid_forward_rewind_info_text',
            },
            'Double tap left or right to skip 10 seconds',
        );
        forwardRewindInfo.appendChild(forwardRewindInfoText);

        const forwardInfo = createElement('div', {
            class: 'fluid_forward_info',
        });
        forwardRewindInfo.appendChild(forwardInfo);

        for (let i = 0; i < 3; i++) {
            const forwardIcon = createElement('div', {
                class: 'fluid_icon fluid_icon_forward',
            });
            forwardInfo.appendChild(forwardIcon);
        }

        // Fast forward
        this.fastForwardCon = createElement('div', {
            class: 'fluid_fast_forward_con',
        });
        this.forwardRewind.appendChild(this.fastForwardCon);

        this.forwardText = createElement('div', {
            class: 'fluid_fast_forward_text',
        });
        this.fastForwardCon.appendChild(this.forwardText);

        this.fastForward = createElement('div', {
            class: 'fluid_fast_forward',
        });
        this.fastForwardCon.appendChild(this.fastForward);

        for (let i = 0; i < 3; i++) {
            const fastForwardIcon = createElement('div', {
                class: 'fluid_icon fluid_icon_forward',
            });
            this.fastForward.appendChild(fastForwardIcon);
        }

        // Fast rewind
        this.fastRewindCon = createElement('div', {
            class: 'fluid_fast_rewind_con',
        });
        this.forwardRewind.appendChild(this.fastRewindCon);

        this.rewindText = createElement('div', {
            class: 'fluid_fast_rewind_text',
        });
        this.fastRewindCon.appendChild(this.rewindText);

        this.fastRewind = createElement('div', {
            class: 'fluid_fast_rewind',
        });
        this.fastRewindCon.appendChild(this.fastRewind);

        for (let i = 0; i < 3; i++) {
            const fastRewindIcon = createElement('div', {
                class: 'fluid_icon fluid_icon_rewind',
            });
            this.fastRewind.appendChild(fastRewindIcon);
        }
    };

    listeners = () => {
        const { player } = this;

        if (!player.mobile) {
            return;
        }

        on.call(player, player.media, 'touchend', () => {
            if (player.paused || hasClass(player.wrapper, 'fluid_show_controls')) {
                player.controlBar.toggleMobile();
                return;
            }

            if (this.doubleTap) {
                this.doubleTap = false;
                clearTimeout(this.showControlsTimer);
            }

            if (hasClass(this.player.wrapper, 'fluid_show_options')) {
                return;
            }

            this.showControlsTimer = setTimeout(() => {
                if (this.doubleTapRecent) {
                    this.doubleTapRecent = false;
                    return;
                }

                if (this.singleTap) {
                    player.controlBar.toggleMobile();
                    this.singleTap = false;
                }
            }, 310);
        });

        on.call(player, player.wrapper, 'touchstart', (event) => {
            if (player.playPause.initialPlay.contains(event.target) || player.paused || player.isCurrentlyPlayingAd) {
                return;
            }

            if (this.touchTimer === null) {
                this.touchTimer = setTimeout(() => {
                    this.touchTimer = null;
                    this.singleTap = true;
                }, 300);

                this.doubleTap = false;
                clearTimeout(this.showControlsTimer);
            } else {
                clearTimeout(this.touchTimer);
                clearTimeout(this.forwardRewindTimer);

                this.touchTimer = null;
                this.singleTap = false;
                this.doubleTap = true;
                this.doubleTapRecent = true;

                const evt = is.nullOrUndefined(event.originalEvent) ? event : event.originalEvent;
                const touch = evt.touches[0] || evt.changedTouches[0];
                const x = touch.pageX;

                const width = player.wrapper.clientWidth;

                const timeForward = player.config.layoutControls.controlForwardRewind.forward;
                const timeRewind = player.config.layoutControls.controlForwardRewind.rewind;

                if (x > width / 2) {
                    this.totalRewind = 0;
                    this.currentTimeRewind = 0;

                    toggleClass(this.fastRewindCon, 'fluid_visible', false);
                    toggleClass(this.fastForwardCon, 'fluid_visible', true);

                    if (player.currentTime + timeForward > player.duration) {
                        if (this.currentTimeForward === 0) {
                            this.currentTimeForward = Math.floor(player.duration - player.currentTime);
                        }

                        player.currentTime = player.duration;
                    } else {
                        this.totalForward += timeForward;
                        player.currentTime += timeForward;
                    }

                    this.forwardText.textContent = `${this.totalForward + this.currentTimeForward} seconds`;

                    toggleClass(this.fastForward, 'fluid_run_animation', true);
                } else {
                    this.totalForward = 0;
                    this.currentTimeForward = 0;

                    toggleClass(this.fastForwardCon, 'fluid_visible', false);
                    toggleClass(this.fastRewindCon, 'fluid_visible', true);

                    if (player.currentTime - timeRewind < 0) {
                        if (this.currentTimeRewind === 0) {
                            this.currentTimeRewind = Math.floor(player.currentTime);
                        }

                        player.currentTime = 0;
                    } else {
                        this.totalRewind += timeRewind;
                        player.currentTime -= timeRewind;
                    }

                    this.rewindText.textContent = `-${this.totalRewind + this.currentTimeRewind} seconds`;

                    toggleClass(this.fastRewind, 'fluid_run_animation', true);
                }

                this.forwardRewindTimer = setTimeout(() => {
                    toggleClass(this.fastForwardCon, 'fluid_visible', false);
                    toggleClass(this.fastRewindCon, 'fluid_visible', false);

                    toggleClass(this.fastForward, 'fluid_run_animation', false);
                    toggleClass(this.fastRewind, 'fluid_run_animation', false);

                    this.totalForward = 0;
                    this.totalRewind = 0;

                    this.currentTimeForward = 0;
                    this.currentTimeRewind = 0;
                }, 400);
            }
        });

        on.call(player, player.media, 'ended', () => {
            if (player.isCurrentlyPlayingAd) {
                return;
            }

            player.controlBar.toggleMobile(true);
        });
    };
}

export default Mobile;
