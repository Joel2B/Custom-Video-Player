import { selector } from './menu-item';

class Quality {
    constructor(player) {
        this.player = player;
        this.id = 'qualityLevels';
        if (!this.player.menu.isEnabled(this.id)) {
            return;
        }

        if (this.player.getLocalStorage(this.id) === null) {
            this.player.setLocalStorage(this.id, -1);
        }

        this.width = 115;
        this.height = 67;

        this.auto = true;
        this.current = -1;

        this.createItems();
    }

    createItems() {
        this.item = selector({
            id: this.id,
            title: 'Quality',
            value: 'Auto',
        });

        this.page = this.player.createElement({
            tag: 'ul',
            className: 'cvp_options_list cvp_quality hide',
        });

        this.page.addEventListener('click', (e) => {
            if (e.target.tagName !== 'LI') {
                return;
            }
            this.select(e);
        });

        this.item.addEventListener('click', () => {
            this.player.menu.openSubMenu(this.item, this.page, this.width, this.height);
        });

        this.player.menu.add({
            id: this.id,
            field: 'selector',
            content: this.page,
            item: this.item,
        });
    }

    add(data) {
        const levels = [];

        for (const [index, level] of data.entries()) {
            const info = [];
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

            let qualityLevel = title.match(/\d/g);
            qualityLevel = Number(qualityLevel !== null ? qualityLevel.join('') : 0);
            if ((qualityLevel && qualityLevel >= 720) || level.isHD === true) {
                info.push({
                    tag: 'span',
                    className: 'hd',
                    textContent: 'HD',
                });
            }

            if (this.player.hlsPlayer) {
                const bitrate = (level.bitrate / 1000).toFixed();
                info.push({
                    tag: 'span',
                    className: 'kbps',
                    textContent: `${bitrate} kbps`,
                });
            }

            levels.push(
                this.player.createElement({
                    tag: 'li',
                    textContent: title,
                    dataset: { level: index },
                    childs: info,
                }),
            );
            this.height += this.player.menu.item.height;
        }

        levels.reverse();
        if (this.player.hlsPlayer) {
            this.height += this.player.menu.item.height;
            levels.push(
                this.player.createElement({
                    tag: 'li',
                    className: 'cvp_active',
                    textContent: 'Auto',
                    dataset: { level: -1 },
                }),
            );
        }

        this.page.append(...levels);
    }

    select(e) {
        const selected = Number(e.target.dataset.level);
        if (selected === this.current && !this.auto) {
            return;
        }

        this.player.menu.inSubpage = false;
        this.auto = false;
        this.current = selected;
        this.update();

        if (this.player.hlsPlayer && !this.player.multipleVideoSources) {
            // reset the "auto" label, if a level is selected
            const auto = e.target.parentNode.lastChild;
            if (auto.textContent !== 'Auto' && this.current !== -1) {
                auto.textContent = 'Auto';
            }
            this.player.hlsPlayer.currentLevel = selected;
        } else {
            this.player.setBuffering();
            this.player.setVideoSource(this.player.videoSources[selected].src);
        }

        this.player.setLocalStorage('qualityLevels', selected);
        this.player.menu.close();
    }

    update() {
        const previous = this.page.querySelector('.cvp_active');
        if (previous) {
            previous.classList.remove('cvp_active');
        }

        if (!this.player.menu.inSubpage) {
            this.player.menu.restartLater();
        }

        const current = this.page.querySelector(`[data-level='${this.current}']`);
        let qualityLabel = current.firstChild.textContent;

        if (this.player.hlsPlayer && !this.player.multipleVideoSources && this.auto) {
            qualityLabel = `Auto (${qualityLabel})`;
            const autoLevel = this.page.querySelector('[data-level="-1"]');
            autoLevel.textContent = qualityLabel;
            autoLevel.classList.add('cvp_active');
        } else {
            current.classList.add('cvp_active');
        }

        this.item.lastChild.textContent = qualityLabel;

        const settings = this.player.domRef.wrapper.getElementsByClassName('fluid_button_main_menu');
        const quality = Number(current.firstChild.textContent.replace(/\D/g, ''));
        for (const setting of settings) {
            if (quality >= 720) {
                setting.classList.add('hd-quality-badge');
            } else {
                setting.classList.remove('hd-quality-badge');
            }
        }
    }

    set(data) {
        let level = this.player.getLocalStorage('qualityLevels');
        if (level === -1 || !this.player.displayOptions.layoutControls.persistentSettings.quality) {
            if (this.player.hlsPlayer && !this.player.multipleVideoSources) {
                this.page.lastChild.classList.add('cvp_active');
            } else {
                this.current = data.length - 1;
                this.update();
            }
            return;
        }

        level = Number(level);
        if (level >= data.length) {
            level = data.length - 1;
        }

        if (this.player.hlsPlayer && !this.player.multipleVideoSources) {
            this.player.hlsPlayer.startLevel = level;
            this.player.hlsPlayer.nextLevel = level;
        } else {
            this.player.setBuffering();
            this.player.setVideoSource(data[level].src);
        }

        this.auto = false;
        this.current = level;
        this.update();
    }
}

export default Quality;
