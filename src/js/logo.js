export default function (self) {
    self.initLogo = () => {
        if (!self.displayOptions.layoutControls.logo.imageUrl) {
            return;
        }

        // Container div for the logo
        // This is to allow for fade in and out logo_maintain_display
        const logoHolder = self.createElement({
            tag: 'div',
            id: self.videoPlayerId + '_logo'
        });
        let hideClass = 'logo_maintain_display';
        if (self.displayOptions.layoutControls.logo.hideWithControls) {
            hideClass = 'initial_controls_show';
        }
        logoHolder.classList.add(hideClass, 'fp_logo');

        // The logo itself
        const logoImage = self.createElement({
            tag: 'img',
            id: self.videoPlayerId + '_logo_image'
        });
        if (self.displayOptions.layoutControls.logo.imageUrl) {
            logoImage.src = self.displayOptions.layoutControls.logo.imageUrl;
        }

        logoImage.style.position = 'absolute';
        logoImage.style.margin = self.displayOptions.layoutControls.logo.imageMargin;
        const logoPosition = self.displayOptions.layoutControls.logo.position.toLowerCase();

        if (logoPosition.indexOf('bottom') !== -1) {
            logoImage.style.bottom = 0;
        } else {
            logoImage.style.top = 0;
        }
        if (logoPosition.indexOf('right') !== -1) {
            logoImage.style.right = 0;
        } else {
            logoImage.style.left = 0;
        }
        if (self.displayOptions.layoutControls.logo.opacity) {
            logoImage.style.opacity = self.displayOptions.layoutControls.logo.opacity;
        }

        if (self.displayOptions.layoutControls.logo.clickUrl !== null) {
            logoImage.style.cursor = 'pointer';
            logoImage.addEventListener('click', function () {
                const win = window.open(self.displayOptions.layoutControls.logo.clickUrl, '_blank');
                win.focus();
            });
        }

        // If a mouseOverImage is provided then we must set up the listeners for it
        if (self.displayOptions.layoutControls.logo.mouseOverImageUrl) {
            logoImage.addEventListener('mouseover', function () {
                logoImage.src = self.displayOptions.layoutControls.logo.mouseOverImageUrl;
            }, false);
            logoImage.addEventListener('mouseout', function () {
                logoImage.src = self.displayOptions.layoutControls.logo.imageUrl;
            }, false);
        }

        self.domRef.player.parentNode.insertBefore(logoHolder, null);
        logoHolder.appendChild(logoImage, null);
    };

    self.toggleLogo = (logo) => {
        if (typeof logo != 'object' || !logo.imageUrl) {
            return false;
        }

        const logoBlock = document.getElementById(self.videoPlayerId + '_logo');

        // We create the logo from scratch if it doesn't already exist, they might not give everything correctly so we
        self.displayOptions.layoutControls.logo.imageUrl = (logo.imageUrl) ? logo.imageUrl : null;
        self.displayOptions.layoutControls.logo.position = (logo.position) ? logo.position : 'top left';
        self.displayOptions.layoutControls.logo.clickUrl = (logo.clickUrl) ? logo.clickUrl : null;
        self.displayOptions.layoutControls.logo.opacity = (logo.opacity) ? logo.opacity : 1;
        self.displayOptions.layoutControls.logo.mouseOverImageUrl = (logo.mouseOverImageUrl) ? logo.mouseOverImageUrl : null;
        self.displayOptions.layoutControls.logo.imageMargin = (logo.imageMargin) ? logo.imageMargin : '2px';
        self.displayOptions.layoutControls.logo.hideWithControls = (logo.hideWithControls) ? logo.hideWithControls : false;
        self.displayOptions.layoutControls.logo.showOverAds = (logo.showOverAds) ? logo.showOverAds : false;

        if (logoBlock) {
            logoBlock.remove();
        }

        self.initLogo();
    };
}
