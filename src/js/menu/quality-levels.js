import { createElement, emptyEl, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { selector } from './menu-item';

class Quality {
    constructor(player) {
        this.player = player;
        this.id = 'qualityLevels';

        this.persistent = this.player.config.layoutControls.persistentSettings.quality;

        this.defaultSize = {
            width: 115,
            height: 67,
        };

        this.width = this.defaultSize.width;
        this.height = this.defaultSize.height;

        // if the menu is rendered
        this.isMenuReady = false;

        this.current = null;
        this.auto = false;

        this.sources = [];

        this.init();
    }

    init = () => {
        if (!this.player.menu.isEnabled(this.id)) {
            return;
        }

        if (this.player.storage.get(this.id) === null) {
            this.player.storage.set(this.id, -1);
        }
    };

    setupMenu = () => {
        this.item = selector({
            id: this.id,
            title: 'Quality',
            value: 'Auto',
        });

        this.page = createElement('ul', {
            class: 'cvp_options_list cvp_quality hide',
        });

        this.player.menu.add({
            id: this.id,
            field: 'selector',
            content: this.page,
            item: this.item,
            position: 'last#0', // place it in the penultimate option
        });

        on.call(this.player, this.page, 'click', (event) => {
            if (event.target.tagName !== 'LI') {
                return;
            }

            this.select(Number(event.target.dataset.level));
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

    add = (sources) => {
        const { player } = this;

        if (sources.length === 1) {
            return;
        }

        this.height = this.defaultSize.height;

        const levels = [];

        sources.forEach((level, index) => {
            let title;

            if (level.attrs && level.attrs.NAME) {
                title = level.attrs.NAME;
            } else if (level.title) {
                title = level.title;
            } else if (level.height) {
                title = level.height + 'p';
            } else {
                title = `Level ${index}`;
            }

            const li = createElement(
                'li',
                {
                    'data-level': index,
                },
                title,
            );

            const qualityLevel = Number(title.replace(/\D/g, ''));

            if (qualityLevel >= 720 || level.hd === true) {
                li.appendChild(
                    createElement(
                        'span',
                        {
                            class: 'hd',
                        },
                        'HD',
                    ),
                );
            }

            if (player.streaming.hls && !player.multipleSourceTypes) {
                const bitrate = (level.bitrate / 1000).toFixed();

                li.appendChild(
                    createElement(
                        'span',
                        {
                            class: 'kbps',
                        },
                        `${bitrate} kbps`,
                    ),
                );
            }

            levels.push(li);

            this.height += player.menu.item.height;
        });

        levels.reverse();

        if (player.streaming.hls && !player.multipleSourceTypes) {
            this.height += player.menu.item.height;
            const auto = createElement(
                'li',
                {
                    class: 'cvp_active',
                    'data-level': -1,
                },
                'Auto',
            );

            levels.push(auto);
        }

        this.setMenu();

        emptyEl(this.page);

        this.page.append(...levels);

        this.sources = sources;

        this.set(player.storage.get(this.id));
    };

    select = (index) => {
        const { player } = this;

        if ((index === this.current && !this.auto) || (index === -1 && this.auto) || player.isCurrentlyPlayingAd) {
            return;
        }

        player.menu.inSubpage = false;

        if (player.streaming.hls && !player.multipleSourceTypes) {
            // reset the "auto" label, if a level is selected
            const auto = event.target.parentNode.lastChild;

            if (auto.textContent !== 'Auto' && this.current !== -1) {
                auto.textContent = 'Auto';
            }
        }

        this.set(index);

        player.menu.close();
    };

    update = () => {
        const { player } = this;

        if (!this.isMenuReady) {
            return;
        }

        if (!player.menu.inSubpage) {
            player.menu.restartLater();
        }

        const previous = this.page.querySelector('.cvp_active');
        toggleClass(previous, 'cvp_active', false);

        let current = this.page.querySelector(`[data-level='${this.current}']`);

        // name displayed in the quality level options, Ex. "1080p"
        let qualityLabel = current.firstChild.textContent;

        // add the name to the "Auto" option, Ex. "Auto (1080p)"
        if (player.streaming.hls && this.auto && !player.multipleSourceTypes) {
            qualityLabel = `Auto (${qualityLabel})`;

            current = this.page.querySelector('[data-level="-1"]');
            current.textContent = qualityLabel;
        }

        toggleClass(current, 'cvp_active', true);

        // show the name of the option in the main menu
        this.item.lastChild.textContent = qualityLabel;

        // assign HD logo based on the option name
        const quality = Number(current.firstChild.textContent.replace(/\D/g, ''));
        toggleClass(player.menu.btn, 'hd-quality-badge', quality >= 720 && !player.mobile);
    };

    set = (index) => {
        const { player } = this;

        index = Number(index);

        if (index >= this.sources.length) {
            index = this.sources.length - 1;
        }

        if (player.streaming.hls && !player.multipleSourceTypes) {
            if (!this.persistent) {
                index = -1;
            }

            if (index !== -1) {
                this.auto = false;
            }

            player.streaming.hls.currentLevel = index;
        } else {
            if (!this.persistent || index === -1) {
                index = this.sources.length - 1;
            }

            const { currentTime, paused, preload, readyState } = player.media;

            const source = this.sources[index];

            if (source.src !== player.currentSource.src) {
                player.source = source;

                player.speedMenu.lock = true;

                if (preload !== 'none' || readyState) {
                    player.loadSource(currentTime, paused);
                }
            }
        }

        this.current = index;

        player.storage.set(this.id, index);

        this.update();
    };
}

export default Quality;
