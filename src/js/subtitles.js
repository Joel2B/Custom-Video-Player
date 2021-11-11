import { WebVTT } from 'videojs-vtt.js';
import { createElement, insertAfter, toggleClass, hasClass } from './utils/dom';
import { on, once } from './utils/events';
import fetch from './utils/fetch';
import is from './utils/is';

class Subtitles {
    constructor(player) {
        this.player = player;
        this.subtitlesData = [];
        this.support = 'textTracks' in document.createElement('video');

        this.init();
    }

    init = () => {
        if (this.support) {
            on.call(this.player, this.player.media.textTracks, 'addtrack', () => {
                for (const textTrack of this.player.media.textTracks) {
                    textTrack.mode = 'hidden';
                }
            });
        }

        if (!this.player.menu.isEnabled('subtitles')) {
            return;
        }
        this.create();
    };

    create = () => {
        const { player } = this;
        const tracks = [];
        const tracksList = player.media.querySelectorAll('track');

        for (const track of tracksList) {
            if (track.kind === 'metadata' && track.src && track.srclang) {
                tracks.push({ label: track.label, url: track.src, lang: track.srclang });
            }
        }

        if (is.empty(tracks)) {
            return;
        }

        tracks.unshift({ label: 'OFF', url: 'na', lang: 'na' });

        this.list = createElement('div', {
            class: 'fluid_subtitles_list',
        });
        this.list.style.display = 'none';

        let firstSubtitle = true;

        for (const subtitle of tracks) {
            const subtitleSelected = firstSubtitle ? 'subtitle_selected' : '';
            const item = createElement('div', {
                class: `fluid_subtitle_list_item ${subtitleSelected}`,
            });
            item.setAttribute('data-lang', subtitle.lang);
            item.appendChild(
                createElement('span', {
                    class: 'subtitle_button_icon',
                }),
            );
            item.appendChild(document.createTextNode(subtitle.label || subtitle.lang));
            this.list.appendChild(item);
            firstSubtitle = false;
        }

        on.call(player, this.list, 'click', (e) => {
            if (!hasClass(e.target, 'fluid_subtitle_list_item')) {
                return;
            }

            const previous = this.list.querySelector('.subtitle_selected');
            const selected = e.target;

            toggleClass(previous, 'subtitle_selected', false);
            toggleClass(selected, 'subtitle_selected', true);

            if (selected.dataset.lang === 'na') {
                this.subtitlesData = [];
                return;
            }

            for (const subtitle of tracks) {
                if (subtitle.lang === selected.dataset.lang) {
                    this.getSubtitles(subtitle.url);
                    break;
                }
            }
        });

        const btn = player.controls.subtitles;
        btn.appendChild(this.list);
        toggleClass(btn, 'show', true);

        on.call(player, btn, 'click', () => {
            this.toggle();
        });

        this.subtitles = createElement('div', {
            class: 'fluid_subtitles_container',
        });
        insertAfter(this.subtitles, player.media);

        // attach subtitles to show based on time
        // this function is for rendering of subtitles when content is playing
        const subtitlesUpdate = () => {
            this.render();
        };
        on.call(player, player.media, 'timeupdate', subtitlesUpdate);
    };

    getSubtitles = (url) => {
        return new Promise((resolve) => {
            fetch(url).then((response) => {
                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const cues = [];
                parser.oncue = (cue) => {
                    cues.push(cue);
                    resolve();
                };
                parser.parse(response);
                parser.flush();
                this.subtitlesData = cues;
            });
        });
    };

    render = () => {
        const { subtitles } = this;

        if (this.player.isCurrentlyPlayingAd) {
            subtitles.innerHTML = '';
            return;
        }

        const media = this.player.media;
        const currentTime = Math.floor(media.currentTime);
        let subtitlesAvailable = false;

        for (const subtitle of this.subtitlesData) {
            if (currentTime >= subtitle.startTime && currentTime <= subtitle.endTime) {
                subtitles.innerHTML = '';
                subtitles.appendChild(WebVTT.convertCueToDOMTree(window, subtitle.text));
                subtitlesAvailable = true;
            }
        }

        if (!subtitlesAvailable) {
            subtitles.innerHTML = '';
        }
    };

    toggle = () => {
        const list = this.list;
        if (this.isCurrentlyPlayingAd) {
            toggleClass(list, 'show', false);
            return;
        }

        if (hasClass(list, 'show')) {
            toggleClass(list, 'show', false);
        } else {
            toggleClass(list, 'show', true);
            once.call(this.player, list, 'mouseleave', () => {
                toggleClass(list, 'show', false);
            });
        }
    };
}

export default Subtitles;
