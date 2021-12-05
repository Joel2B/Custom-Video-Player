import { createElement, emptyEl, toggleClass } from '../utils/dom';
import { on, triggerEvent } from '../utils/events';
import { selector } from './menu-item';

class Audio {
    constructor(player) {
        this.player = player;

        // id to save settings
        this.id = 'audio';

        // audio menu size
        this.defaultSize = {
            width: 145,
            height: 67,
        };

        this.width = this.defaultSize.width;
        this.height = this.defaultSize.height;

        // to check if to show the audio in the menu
        this.enabled = player.menu.isEnabled(this.id);

        // custom settings
        this.config = player.config.layoutControls[this.id];
        this.language = this.config.language;

        // to save all audio
        this.meta = new WeakMap();

        // if the menu is rendered
        this.isMenuReady = false;

        // to know if you want a default track
        this.useDefault = false;

        this.currentTrack = null;
    }

    init = () => {
        if (!this.enabled) {
            return;
        }

        // to know if an audio will be set by default
        this.setupDefaultAudio();
    };

    saveConfig = (value) => {
        this.player.storage.set(this.id, value);
    };

    setupDefaultAudio = () => {
        const { player } = this;

        // only if it's the first time, a default track is used
        if (player.storage.get(this.id) === null) {
            this.useDefault = true;
        }
    };

    setDefaultAudio = () => {
        if (!this.useDefault) {
            return;
        }

        // if a language is not configured, it will use the one with default property
        if (this.setLanguage()) {
            return;
        }

        const tracks = this.getTracks();

        for (const track of tracks) {
            if (track.default) {
                const id = this.meta.get(track).id;

                this.saveConfig(id);

                this.useDefault = false;

                return;
            }
        }

        // if not found, use the first
        this.saveConfig(0);
    };

    setLanguage = () => {
        if (this.language === 'auto') {
            return false;
        }

        const tracks = this.getTracks();

        for (const track of tracks) {
            if (track.lang === this.language) {
                const id = this.meta.get(track).id;

                this.saveConfig(id);

                this.useDefault = false;

                return true;
            }
        }

        return false;
    };

    setupMenu = () => {
        const { player } = this;

        this.item = selector({
            id: this.id,
            title: 'Audio',
            value: 'n/a',
        });

        this.page = createElement('ul', {
            class: 'cvp_options_list cvp_audio hide',
        });

        player.menu.add({
            id: this.id,
            field: 'selector',
            content: this.page,
            item: this.item,
            position: 'last#1', // place it in the penultimate option
        });

        on.call(this.player, this.page, 'click', (event) => {
            if (event.target.tagName !== 'LI') {
                return;
            }

            this.set(Number(event.target.dataset.track));
        });

        on.call(this.player, this.item, 'click', () => {
            this.player.menu.openSubMenu(this.item, this.page, this.width, this.height);
        });
    };

    setMenu = () => {
        if (this.isMenuReady) {
            return;
        }

        this.setupMenu();

        this.isMenuReady = true;
    };

    getTracks = () => {
        return this.player.streaming.hls.audioTracks;
    }

    addTrack = (track) => {
        const { player } = this;
        const tracks = this.getTracks();

        tracks
            .filter((track) => !this.meta.has(track))
            .forEach((track) => {
                player.debug.log('Audio track added', track);

                this.meta.set(track, {
                    id: track.id,
                });
            });
    }

    update = () => {
        const { player } = this;
        const tracks = this.getTracks();

        // to accumulate options
        const items = new DocumentFragment();

        // reset menu size
        this.height = this.defaultSize.height;

        // create options
        for (const track of tracks) {
            if (track.forced) {
                continue;
            }

            const item = createElement(
                'li',
                {
                    'data-track': this.meta.get(track).id,
                },
                track.name,
            );

            items.appendChild(item);

            // increase menu height
            this.height += player.menu.item.height;
        }

        this.setMenu();

        // remove old options
        emptyEl(this.page);

        // add new options
        this.page.appendChild(items);

        this.setDefaultAudio();

        // set saved audio
        this.set(player.storage.get(this.id));
    };

    set = (index, force = false) => {
        const { player } = this;

        if (index >= this.getTracks().length) {
            index = 0;
        }

        // check if the option exists in the menu
        if (!this.page.querySelector(`[data-track="${index}"]`)) {
            return;
        }

        const previous = this.page.querySelector('.cvp_active');
        const current = this.page.querySelector(`[data-track="${index}"]`);

        toggleClass(previous, 'cvp_active', false);
        toggleClass(current, 'cvp_active', true);

        // update main menu text
        this.item.lastChild.textContent = current.textContent;

        // not advance if it is the same
        if (this.currentTrack === index && !force) {
            return;
        }

        this.currentTrack = index;

        this.saveConfig(index);

        player.menu.close();

        player.streaming.hls.audioTrack = index;

        // trigger event
        triggerEvent.call(player, player.media, 'audiochange');
    };

    // if the track changes for any reason, we set it up again
    checkTrack = (id) => {
        if (this.currentTrack === id) {
            return;
        }

        this.set(this.currentTrack, true);
    }
}

export default Audio;
