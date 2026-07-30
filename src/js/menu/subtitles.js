import { createElement, emptyEl, insertAfter, toggleClass, findPosition } from '../utils/dom';
import { on, triggerEvent } from '../utils/events';
import { selector } from './menu-item';
import WebVTT from 'videojs-vtt.js/lib/vtt';
import fetch from '../utils/fetch';
import is from '../utils/is';
import { addVttCue, MAX_VTT_BYTES } from '../utils/vtt';

class Subtitles {
  constructor(player) {
    this.player = player;

    // id to save settings
    this.id = 'subtitles';

    // subtitle menu size
    this.defaultSize = {
      width: 145,
      height: 67,
    };

    this.width = this.defaultSize.width;
    this.height = this.defaultSize.height;

    // to know if the subtitles are enabled
    this.enabled = player.menu.isEnabled(this.id);

    // custom settings
    this.config = player.config.layoutControls[this.id];
    this.language = this.config.language;
    this.native = this.config.native;
    this.useVttjs = this.config.useVttjs;

    // check for support to use textTracks
    this.support = 'textTracks' in this.player.media;

    // to save all track data
    this.meta = new WeakMap();

    // save non-native tracks
    this.tracks = [];

    // if the menu is rendered
    this.isMenuReady = false;

    // to know if you want a default track
    this.useDefault = false;

    // count the internal and external tracks
    // internal: tracks processed by the player
    // external: tracks processed by externals e.g. hls.js
    this.internalTracks = 0;
    this.externalTracks = 0;

    // to display non-native subtitles
    this.internalTrack = false;

    // to show / hide subtitles
    this.active = false;

    // to render the current subtitles
    this.currentTrack = -1;
    this.request = null;
  }

  init = () => {
    if (!this.enabled) {
      return;
    }

    // create subtitle container
    this.setupSubtitle();

    // to know if a subtitle will be set by default
    this.setupDefaultSubtitle();

    // track elements are always emulated.
    // only hls tracks are used natively or emulated through it.
    // * if hls.js is not supported, and the native hls doesn't inject the tracks
    //   into the video element, nothing will happen
    if (this.support && this.native) {
      this.setupTextTracks();
    } else {
      this.emulateTextTracks();
    }

    // update the cues according to the time of the video
    on.call(this.player, this.player.media, 'timeupdate', () => {
      if (this.internalTrack || !this.native) {
        this.updateActiveCues();
        this.render();
      }
    });
  };

  saveConfig = (value) => {
    this.player.storage.set(this.id, value);
  };

  setupDefaultSubtitle = () => {
    const { player } = this;

    // only if it's the first time and you want a default subtitle
    if (player.storage.get(this.id) === null) {
      if (this.config.active) {
        this.useDefault = true;
      } else {
        this.saveConfig('-1');
      }
    }
  };

  // TODO: default is not supported in track elements
  // use language to specify a default one
  // otherwise the first default will always be selected.
  setDefaultSubtitle = () => {
    if (!this.useDefault) {
      return;
    }

    // if a language is not configured, it will use the one with default property
    if (this.setLanguage()) {
      return;
    }

    const tracks = this.getTracks();

    for (const [index, track] of tracks.entries()) {
      if (track.default) {
        this.saveConfig(this.getSubtitleId(track.type, index));

        this.useDefault = false;

        return;
      }
    }

    // if not found, use the first
    this.saveConfig(this.getSubtitleId(tracks[0].type, 0));
  };

  setLanguage = () => {
    if (this.language === 'auto') {
      return false;
    }

    const tracks = this.getTracks();

    let id = null;

    for (const [index, track] of tracks.entries()) {
      // in case native and non-native tracks are used
      if (track.srclang === this.language || track.language === this.language) {
        if (this.native) {
          id = this.meta.get(track).id;
        } else {
          id = this.getSubtitleId(track.type, index);
        }

        this.saveConfig(id);

        this.useDefault = false;

        return true;
      }
    }

    return false;
  };

  // id that will be used to select a subtitle from the menu
  // i: internal
  // e: external
  getSubtitleId = (type, index) => {
    let value = `i-${index}`;

    if (type === 'external' || type === 'hls') {
      value = `e-${index}`;
    }

    return value;
  };

  setupSubtitle = () => {
    // subtitle container
    this.subtitles = createElement('div', {
      class: 'fluid_subtitles_container',
    });

    // set class for vtt.js
    if (this.useVttjs) {
      toggleClass(this.subtitles, 'fluid_vttjs', true);
    }

    // insert container after video
    insertAfter(this.subtitles, this.player.controls.container);
  };

  textTracksInTag = () => {
    return !!this.player.media.querySelectorAll('track').length;
  };

  emulateTextTracks = (type = 'intern') => {
    const { player } = this;
    const { media } = player;

    if (type === 'intern') {
      const tracks = media.querySelectorAll('track');

      if (!tracks.length) {
        return;
      }

      for (const track of tracks) {
        track.id = track.label;
        track.type = 'tag';

        this.addTrack(track);

        track.remove();
      }

      if (!this.tracks.length) {
        return;
      }

      this.setMenu();

      this.update(type);
    } else {
      const tracks = this.getTracks();

      if (!tracks.length) {
        return;
      }

      this.setMenu();

      this.update(type);
    }
  };

  setupTextTracks = () => {
    // for now, external refers to the tracks exposed by hls.js
    on.call(this.player, this.player.media.textTracks, 'addtrack removetrack', () => {
      this.update('external');
    });

    setTimeout(() => {
      this.emulateTextTracks();
    }, 0);
  };

  addTrack = (track) => {
    const { kind, label, src, srclang } = track;

    if (kind !== 'subtitles' && kind !== 'captions') {
      return;
    }

    this.tracks.push({
      id: track.id,
      type: track.type, // to know the origin of the track
      kind,
      label,
      src,
      srclang,
      default: track.default,
      forced: track.forced || false,
      activeCues: [],
      cues: [],
    });
  };

  downloadTrack = (url) => {
    this.request?.abort();

    const { player } = this;
    this.request = fetch(url, 'text', {
      timeout: player.config.xhrTimeout,
      maxBytes: MAX_VTT_BYTES,
      onBeforeOpen: player.config.onBeforeXMLHttpRequestOpen,
      onBeforeSend: player.config.onBeforeXMLHttpRequest,
    });

    const request = this.request;

    return request
      .then(
        (response) =>
          new Promise((resolve) => {
            const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
            const cues = [];

            parser.oncue = (cue) => {
              addVttCue(cues, cue);
            };

            parser.onflush = () => {
              resolve(cues);
            };

            parser.parse(response);
            parser.flush();
          }),
      )
      .finally(() => {
        if (this.request === request) {
          this.request = null;
        }
      });
  };

  destroy = () => {
    this.request?.abort();
  };

  setupMenu = () => {
    const { player } = this;

    this.item = selector({
      id: this.id,
      title: player.config.captions.subtitles,
      value: player.config.captions.off,
    });

    // expand the main menu
    player.menu.width = 205;

    this.page = createElement('ul', {
      class: 'cvp_options_list cvp_subtitles hide',
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

      this.set(event.target.dataset.track);
    });

    on.call(this.player, this.item, 'click', () => {
      player.menu.openSubMenu(this.item, this.page, this.width, this.height);
    });
  };

  setMenu = () => {
    if (this.isMenuReady) {
      return;
    }

    this.setupMenu();

    this.isMenuReady = true;
  };

  update = (type = 'intern') => {
    const { player } = this;
    const tracks = this.getTracks();

    // register tracks
    tracks
      .filter((track) => !this.meta.has(track))
      .forEach((track) => {
        player.debug.log('Track added', track);

        let id = null;
        if (type === 'intern') {
          id = this.getSubtitleId(type, this.internalTracks++);
        } else {
          id = this.getSubtitleId(type, this.externalTracks++);
        }

        this.meta.set(track, {
          id,
          type,
        });

        // for hls only
        if (this.native && type === 'external') {
          // hide subtitles through hls.js
          player.streaming.hls.subtitleDisplay = false;

          // hide subtitle if active
          if (track.mode === 'showing') {
            track.mode = 'hidden';
          }

          // add event listener for cue changes
          on.call(player, track, 'cuechange', this.render);
        }
      });

    // to accumulate subtitle options
    const items = new DocumentFragment();

    // option to turn off subtitles
    items.appendChild(
      createElement(
        'li',
        {
          class: 'cvp_active',
          'data-track': -1,
        },
        player.config.captions.off,
      ),
    );

    // reset menu size
    this.height = this.defaultSize.height;

    // add height for disable option
    this.height += player.menu.item.height;

    // create subtitle options
    for (const track of tracks) {
      if (track.forced) {
        continue;
      }

      const item = createElement(
        'li',
        {
          'data-track': this.meta.get(track).id,
        },
        track.label,
      );

      items.appendChild(item);

      // increase menu height
      this.height += player.menu.item.height;
    }

    if (this.native) {
      this.setMenu();
    }

    // remove old options
    emptyEl(this.page);

    // add new options
    this.page.appendChild(items);

    // set default subtitle
    this.setDefaultSubtitle();

    // set saved subtitle
    this.set(player.storage.get(this.id), true);
  };

  set = (index, force = false) => {
    const { player } = this;

    index = index || '-1';

    let data = index.split('-');

    const type = data[0];
    index = Number(data[1]);

    if (type === 'i') {
      if (index >= this.internalTracks) {
        index = 0;
      }
    } else if (type === 'e') {
      if (index >= this.getTracks().length - this.internalTracks) {
        index = 0;
      }
    }

    data[1] = index;
    index = data.join('-');

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

    // -1: don't display subtitles
    if (index === '-1') {
      this.active = false;

      toggleClass(this.subtitles, 'hide', true);

      emptyEl(this.subtitles);
      return;
    }

    // to identify the subtitle
    // e.g i-2
    // i: internal track
    // 2: index
    data = index.split('-');

    index = Number(data[1]);

    const tracks = this.getTracks();

    // external track (hls)
    if (type === 'e') {
      this.internalTrack = false;

      // change the subtitle via hls.js
      player.streaming.hls.subtitleTrack = index;
    } else {
      this.internalTrack = true;

      const track = tracks[index];

      if (is.empty(track.cues)) {
        const selectedTrack = this.currentTrack;
        this.downloadTrack(track.src)
          .then((cues) => {
            track.cues = cues;
            track.activeCues = this.getActiveCues(cues);

            if (this.currentTrack === selectedTrack) {
              this.render();
            }
          })
          .catch((error) => {
            if (error.name === 'AbortError') {
              return;
            }

            player.debug.error(`Failed to load subtitles: ${track.src}`, error);

            if (this.currentTrack === selectedTrack) {
              this.active = false;
              toggleClass(this.subtitles, 'hide', true);
            }
          });
      }
    }

    this.active = true;

    toggleClass(this.subtitles, 'hide', false);

    this.render();

    // trigger event
    triggerEvent.call(player, player.media, 'languagechange');
  };

  // only for hls
  // if the track changes for any reason, we set it up again
  checkTrack = (id) => {
    if (this.currentTrack === -1) {
      return;
    }

    const data = this.currentTrack.split('-');
    const index = Number(data[1]);

    if (index === id) {
      return;
    }

    this.set(this.currentTrack, true);
  };

  getTracks = () => {
    let nativeTracks = [];

    if (this.native) {
      nativeTracks = Array.from((this.player.media || {}).textTracks || []).filter((track) =>
        ['captions', 'subtitles'].includes(track.kind),
      );
    }

    return [...this.tracks, ...nativeTracks];
  };

  updateActiveCues = () => {
    for (const track of this.getTracks()) {
      if (!track.cues || (track.type !== 'tag' && this.native)) {
        continue;
      }

      track.activeCues = this.getActiveCues(track.cues);
    }
  };

  getActiveCues = (cues) => {
    const { player } = this;
    const { currentTime } = player.media;
    const activeCues = [];

    for (const cue of cues) {
      if (cue.startTime <= currentTime && cue.endTime >= currentTime) {
        activeCues.push(cue);
        break;
      }
    }

    return activeCues;
  };

  render = () => {
    if (!this.active) {
      return;
    }

    const tracks = this.getTracks();
    const data = this.currentTrack.split('-');
    const type = data[0];
    let index = Number(data[1]);

    // the external tracks are after the internals
    // so we add up the total of the internal tracks to locate them
    if (type === 'e') {
      index += this.internalTracks;
    }

    const activeCues = Array.from((tracks[index] || {}).activeCues || []);

    if (is.empty(activeCues)) {
      // remove subtitles
      emptyEl(this.subtitles);
      return;
    }

    if (this.useVttjs) {
      // use vtt.js to process and display the cues
      WebVTT.processCues(window, activeCues, this.subtitles);
    } else {
      this.setCustomSubtitles(activeCues);
    }

    // trigger event
    triggerEvent.call(this, this.player.media, 'cuechange');
  };

  setCustomSubtitles = (activeCues) => {
    const content = activeCues.map((cue) => cue.text.trim()).join('\n');
    const normalized = content.replace(/<br\s*\/?>/gi, '\n');
    const [textLineTop, textLineBottom] = normalized.split(/\r?\n/).filter((o) => o.trim() && !/></.test(o));

    // remove old subtitles
    emptyEl(this.subtitles);

    // create subtitle container
    const [containerTop, lineTop] = this.createLine(textLineTop);
    const [containerBottom, lineBottom] = this.createLine(textLineBottom);

    if (!containerTop) {
      return;
    }

    const subtitles = createElement('span', {
      class: 'fluid_subtitles',
    });

    subtitles.appendChild(containerTop);
    this.subtitles.appendChild(subtitles);

    const r = 5;
    const rpx = `${r}px`;

    if (!containerBottom) {
      lineTop.style.borderRadius = rpx;
      return;
    }

    subtitles.appendChild(containerBottom);

    const getBorderRadius = () => {
      const value = Math.abs(lineTop.clientWidth - lineBottom.clientWidth) / 2;
      const warranty = 2;

      return `${value < r ? r - value / 2 - warranty : r}px`;
    };

    const setBorderTop = () => {
      lineTop.style.borderTopRightRadius = rpx;
      lineTop.style.borderTopLeftRadius = rpx;
    };

    const setBorderBottom = () => {
      lineBottom.style.borderBottomRightRadius = rpx;
      lineBottom.style.borderBottomLeftRadius = rpx;
    };

    const setLineTop = () => {
      containerTop.style.alignItems = 'end';
      setBorderTop();
      lineBottom.style.borderRadius = getBorderRadius();

      if (lineTop.clientWidth + r * 2 < lineBottom.clientWidth) {
        const top = this.createCorner('bottomRight', r);
        const bottom = this.createCorner('bottomLeft', r);

        containerTop.insertBefore(top, containerTop.firstChild);
        containerTop.insertBefore(bottom, null);
      }
    };

    const setLineBottom = () => {
      lineTop.style.borderRadius = getBorderRadius();
      setBorderBottom();

      if (lineBottom.clientWidth + r * 2 < lineTop.clientWidth) {
        const top = this.createCorner('topRight', r);
        const bottom = this.createCorner('topLeft', r);

        containerBottom.insertBefore(top, containerBottom.firstChild);
        containerBottom.insertBefore(bottom, null);
      }
    };

    const posTop = findPosition(lineTop, containerTop);
    const posBottom = findPosition(lineBottom, containerBottom);

    if (posTop.width < containerTop.clientWidth) {
      setLineTop();
    } else if (posBottom.width < containerBottom.clientWidth) {
      setLineBottom();
    } else {
      setBorderTop();
      setBorderBottom();
    }
  };

  createLine = (line) => {
    if (!line) return [];

    const container = createElement('div', {
      class: 'fluid_subtitles_container_line',
    });

    const el = createElement('span', {
      class: 'fluid_subtitles_line',
    });

    if (this.config.allowHtml) {
      el.innerHTML = line;
    } else {
      el.textContent = line;
    }

    container.appendChild(el);

    return [container, el];
  };

  createCorner = (corner, r) => {
    const pos = {
      topRight: '0% 100%',
      topLeft: '100% 100%',
      bottomRight: '0% 0%',
      bottomLeft: '100% 0%',
    }[corner];

    const rpx = `${r}px`;

    const el = createElement('span', {
      class: 'fluid_subtitles_block',
    });

    el.style.height = rpx;
    el.style.width = rpx;
    el.style.mask = `radial-gradient(circle at ${pos}, transparent 0 ${rpx}, #000 calc(${rpx} + .5px))`;

    return el;
  };
}

export default Subtitles;
