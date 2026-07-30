import { createElement, findPosition, getEventOffsetX } from '../utils/dom';
import { on } from '../utils/events';
import { WebVTT } from 'videojs-vtt.js';
import { formatTime } from '../utils/time';
import computedStyle from '../utils/computed-style';
import fetch from '../utils/fetch';
import is from '../utils/is';
import { addVttCue, MAX_VTT_BYTES } from '../utils/vtt';

class PreviewThumbnails {
  constructor(player) {
    this.player = player;
    this.loaded = false;
    this.data = [];
    this.request = null;
    this.destroyed = false;
  }

  init = () => {
    const option = this.player.config.layoutControls.timelinePreview;

    if (option.type === 'VTT' && is.string(option.file) && !is.empty(option.file)) {
      return this.getThumbnails(option.file).then(() => this.render());
    }

    if (option.type === 'static' && is.array(option.frames)) {
      this.data = option.frames;
      option.spriteImage = true;
      this.render();
    }

    return Promise.resolve();
  };

  parseVtt = (vttRawData) => {
    if (!vttRawData.length) {
      return [];
    }

    const result = [];
    let tempThumbnailData = null;
    let tempThumbnailCoordinates = null;

    for (const vtt of vttRawData) {
      tempThumbnailData = vtt.text.split('#');
      let xCoords = 0;
      let yCoords = 0;
      let wCoords = 122.5;
      let hCoords = 69;

      // .vtt file contains sprite corrdinates
      if (tempThumbnailData.length === 2 && tempThumbnailData[1].indexOf('xywh=') === 0) {
        tempThumbnailCoordinates = tempThumbnailData[1].substring(5);
        tempThumbnailCoordinates = tempThumbnailCoordinates.split(',');

        if (tempThumbnailCoordinates.length === 4) {
          this.player.config.layoutControls.timelinePreview.spriteImage = true;
          xCoords = parseInt(tempThumbnailCoordinates[0]);
          yCoords = parseInt(tempThumbnailCoordinates[1]);
          wCoords = parseInt(tempThumbnailCoordinates[2]);
          hCoords = parseInt(tempThumbnailCoordinates[3]);
        }
      }

      const thumbnail = this.player.config.layoutControls.timelinePreview;
      let imageUrl = thumbnail.sprite ? thumbnail.sprite : tempThumbnailData[0];
      if (thumbnail.spriteRelativePath && thumbnail.file.indexOf('/') !== -1) {
        imageUrl = thumbnail.file.substring(0, thumbnail.file.lastIndexOf('/') + 1) + tempThumbnailData[0];
      }

      result.push({
        startTime: vtt.startTime,
        endTime: vtt.endTime,
        image: imageUrl,
        x: xCoords,
        y: yCoords,
        w: wCoords,
        h: hCoords,
      });
    }

    return result;
  };

  getThumbnails = (url) => {
    this.request?.abort();

    const { player } = this;
    this.request = fetch(url, 'text', {
      timeout: player.config.xhrTimeout,
      maxBytes: MAX_VTT_BYTES,
      onBeforeOpen: player.config.onBeforeXMLHttpRequestOpen,
      onBeforeSend: player.config.onBeforeXMLHttpRequest,
    });
    const request = this.request;
    return request.then(
      (response) =>
        new Promise((resolve) => {
          const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
          const cues = [];

          parser.oncue = (cue) => {
            addVttCue(cues, cue);
          };

          parser.onflush = () => {
            this.data = this.parseVtt(cues);
            resolve();
          };

          parser.parse(response);
          parser.flush();
        }),
    ).finally(() => {
      if (this.request === request) {
        this.request = null;
      }
    });
  };

  move = (event) => {
    const { player } = this;
    const progress = player.controls.progressContainer;
    const width = progress.clientWidth;
    if (!width) {
      return;
    }

    // get the hover position
    let offsetX = getEventOffsetX(progress, event);
    const seconds = (player.duration * offsetX) / width;
    // get the thumbnail coordinates
    const size = this.getThumbSize(seconds);
    if (!size) {
      return;
    }

    const preview = this.preview;
    // preview border is set to 2px, a total of 4px on both sides
    // and they are subtracted from the position of the timeline preview
    // so that it stays within the width of the timeline
    const borderLeft = parseInt(computedStyle(preview, 'border-left-width').replace('px', '')) * 2;
    const scrollLimit = Math.max(width - size.w - borderLeft, 0);
    // add the top position to the tooltip so it is not along with the preview
    const topTooltip = 7;
    // get the left position of the timeline
    const left = findPosition(progress, player.wrapper).left;

    offsetX = offsetX - size.w / 2;
    let positionX = left;

    if (offsetX >= 0) {
      if (offsetX <= scrollLimit) {
        positionX = offsetX + left;
      } else {
        positionX = scrollLimit + left;
      }
    } else {
      positionX = left;
    }

    preview.style.background = `url(${size.image})`;
    preview.style.backgroundRepeat = 'no-repeat';
    preview.style.backgroundAttachment = 'scroll';
    preview.style.backgroundPosition = `-${size.x}px -${size.y}px`;

    preview.style.width = size.w + 'px';
    preview.style.height = size.h + 'px';
    preview.style.left = `${positionX}px`;

    this.tooltip.style.top = size.h + topTooltip + 'px';
    this.tooltipText.textContent = formatTime(seconds);

    if (!player.config.layoutControls.timelinePreview.spriteImage) {
      preview.style.backgroundSize = 'contain';
    }

    this.show();
  };

  getThumbSize = (second) => {
    if (is.empty(this.data)) {
      return;
    }

    for (const data of this.data) {
      if (second >= data.startTime && second <= data.endTime) {
        return data;
      }
    }
  };

  show = () => {
    this.preview.style.visibility = 'visible';
  };

  hide = () => {
    if (is.empty(this.data)) {
      return;
    }

    this.preview.style.visibility = 'hidden';
  };

  render = () => {
    if (is.empty(this.data) || is.nullOrUndefined(this.player.controls)) {
      return;
    }

    this.preview = createElement('div', {
      class: 'fluid_timeline_preview_thumbnails',
    });

    this.tooltip = createElement('div', {
      class: 'fluid_tooltip',
    });

    this.tooltipText = createElement('span');

    this.tooltip.appendChild(this.tooltipText);
    this.preview.appendChild(this.tooltip);

    this.player.controls.container.appendChild(this.preview);

    this.listeners();

    this.loaded = true;
  };

  listeners = () => {
    const { player } = this;

    // show thumbnails
    on.call(player, player.controls.progressContainer, 'mousemove touchmove', this.move);

    // hide thumbnails
    on.call(player, player.controls.progressContainer, 'mouseleave touchend', this.hide);
  };

  destroy = () => {
    this.destroyed = true;
    this.request?.abort();
  };
}

export default PreviewThumbnails;
