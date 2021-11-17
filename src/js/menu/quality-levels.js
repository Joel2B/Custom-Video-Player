import { createElement, emptyEl, toggleClass } from '../utils/dom';
import { on } from '../utils/events';
import { isDASH, isHLS } from '../utils/media';
import { selector } from './menu-item';

class Quality {
    constructor(player) {
        this.player = player;
        this.id = 'qualityLevels';

        this.defaultSize = {
            width: 115,
            height: 67,
        };

        this.width = this.defaultSize.width;
        this.height = this.defaultSize.height;

        this.auto = true;
        this.current = -1;

        this.init();
    }

    init = () => {
        if (!this.player.menu.isEnabled(this.id)) {
            return;
        }

        if (this.player.storage.get(this.id) === null) {
            this.player.storage.set(this.id, -1);
        }

        this.createItems();
    };

    createItems = () => {
        this.item = selector({
            id: this.id,
            title: 'Quality',
            value: 'Auto',
        });

        this.page = createElement('ul', {
            class: 'cvp_options_list cvp_quality hide',
        });

        on.call(this.player, this.page, 'click', (event) => {
            if (event.target.tagName !== 'LI') {
                return;
            }
            this.select(event);
        });

        on.call(this.player, this.item, 'click', () => {
            this.player.menu.openSubMenu(this.item, this.page, this.width, this.height);
        });

        this.player.menu.add({
            id: this.id,
            field: 'selector',
            content: this.page,
            item: this.item,
        });
    };

    add = (data) => {
        const { player } = this;
        const levels = [];

        this.height = this.defaultSize.height;

        for (const [index, level] of data.entries()) {
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

            const li = createElement('li', null, title);
            li.setAttribute('data-level', index);

            let qualityLevel = title.match(/\d/g);
            qualityLevel = Number(qualityLevel !== null ? qualityLevel.join('') : 0);
            if ((qualityLevel && qualityLevel >= 720) || level.isHD === true) {
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

            if (player.streaming.hls) {
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
        }

        levels.reverse();
        if (player.streaming.hls) {
            this.height += player.menu.item.height;
            const auto = createElement(
                'li',
                {
                    class: 'cvp_active',
                },
                'Auto',
            );
            auto.setAttribute('data-level', -1);
            levels.push(auto);
        }

        emptyEl(this.page);

        this.page.append(...levels);
    };

    select = (event) => {
        const { player } = this;
        const selected = Number(event.target.dataset.level);

        if (selected === this.current && !this.auto) {
            return;
        }

        player.menu.inSubpage = false;
        this.auto = false;
        this.current = selected;
        this.update();

        if (player.streaming.hls && !player.multipleVideoSources) {
            // reset the "auto" label, if a level is selected
            const auto = event.target.parentNode.lastChild;
            if (auto.textContent !== 'Auto' && this.current !== -1) {
                auto.textContent = 'Auto';
            }
            player.streaming.hls.currentLevel = selected;
        } else {
            player.setVideoSource(player.videoSources[selected].src);
        }

        player.storage.set('qualityLevels', selected);
        player.menu.close();
    };

    update = () => {
        const { player } = this;
        const previous = this.page.querySelector('.cvp_active');

        if (previous) {
            toggleClass(previous, 'cvp_active', false);
        }

        if (!player.menu.inSubpage) {
            player.menu.restartLater();
        }

        const current = this.page.querySelector(`[data-level='${this.current}']`);
        let qualityLabel = current.firstChild.textContent;

        if (player.streaming.hls && !player.multipleVideoSources && this.auto) {
            qualityLabel = `Auto (${qualityLabel})`;
            const autoLevel = this.page.querySelector('[data-level="-1"]');
            autoLevel.textContent = qualityLabel;
            toggleClass(autoLevel, 'cvp_active', true);
        } else {
            toggleClass(current, 'cvp_active', true);
        }

        this.item.lastChild.textContent = qualityLabel;

        const quality = Number(current.firstChild.textContent.replace(/\D/g, ''));

        if (quality >= 720) {
            toggleClass(player.menu.btn, 'hd-quality-badge', true);
        } else {
            toggleClass(player.menu.btn, 'hd-quality-badge', false);
        }
    };

    set = (data) => {
        const { player } = this;
        let level = player.storage.get('qualityLevels');

        if (level === -1 || !player.config.layoutControls.persistentSettings.quality) {
            if (player.streaming.hls && !player.multipleVideoSources) {
                toggleClass(this.page.lastChild, 'cvp_active', true);
            } else {
                this.current = data.length - 1;
                this.update();
            }

            if (!isHLS(player.originalSrc) && !isDASH(player.originalSrc)) {
                player.autoPlay.apply();
            }

            return;
        }

        level = Number(level);
        if (level >= data.length) {
            level = data.length - 1;
        }

        if (player.streaming.hls && !player.multipleVideoSources) {
            player.streaming.hls.startLevel = level;
            player.streaming.hls.nextLevel = level;
        } else {
            player.setVideoSource(data[level].src);
        }

        this.auto = false;
        this.current = level;
        this.update();
    };
}

export default Quality;
