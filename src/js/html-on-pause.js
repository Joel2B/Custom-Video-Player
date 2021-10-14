export default function (self) {
    self.initHtmlOnPauseBlock = () => {
        //If onPauseRoll is defined than HtmlOnPauseBlock won't be shown
        if (self.hasValidOnPauseAd()) {
            return;
        }

        if (!self.displayOptions.layoutControls.htmlOnPauseBlock.html) {
            return;
        }

        const containerDiv = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_fluid_html_on_pause',
            className: 'fluid_html_on_pause',
            innerHTML: self.displayOptions.layoutControls.htmlOnPauseBlock.html,
            style: {
                display: 'none'
            }
        }, () => self.playPauseToggle());

        if (self.displayOptions.layoutControls.htmlOnPauseBlock.width) {
            containerDiv.style.width = self.displayOptions.layoutControls.htmlOnPauseBlock.width + 'px';
        }

        if (self.displayOptions.layoutControls.htmlOnPauseBlock.height) {
            containerDiv.style.height = self.displayOptions.layoutControls.htmlOnPauseBlock.height + 'px';
        }

        self.domRef.player.parentNode.insertBefore(containerDiv, null);
    };

    self.setHtmlOnPauseBlock = (passedHtml) => {
        if (typeof passedHtml != 'object' || typeof passedHtml.html == 'undefined') {
            return false;
        }

        const htmlBlock = document.getElementById(self.videoPlayerId + '_fluid_html_on_pause');

        // We create the HTML block from scratch if it doesn't already exist
        if (!htmlBlock) {
            const containerDiv = self.createElement({
                tag: 'div',
                id: self.videoPlayerId + '_fluid_html_on_pause',
                className: 'fluid_html_on_pause',
                innerHTML: passedHtml.html,
                style: {
                    display: 'none'
                }
            }, () => self.playPauseToggle());

            if (passedHtml.width) {
                containerDiv.style.width = passedHtml.width + 'px';
            }

            if (passedHtml.height) {
                containerDiv.style.height = passedHtml.height + 'px';
            }

            self.domRef.player.parentNode.insertBefore(containerDiv, null);
            return;
        }

        htmlBlock.innerHTML = passedHtml.html;

        if (passedHtml.width) {
            htmlBlock.style.width = passedHtml.width + 'px';
        }

        if (passedHtml.height) {
            htmlBlock.style.height = passedHtml.height + 'px';
        }
    };
}
