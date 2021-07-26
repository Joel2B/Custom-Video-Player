export default function (self) {
    self.restartMenu = () => {
        self.domRef.controls.menuBackground.style.width = `${self.widthOptionsMenu}px`;
        self.domRef.controls.menuBackground.style.height = `${self.hightOptionsMenu}px`;
        self.domRef.controls.mainPage.style.width = `${self.widthOptionsMenu}px`;
        self.domRef.controls.optionsMenu.classList.remove('cvp_level2');
        self.domRef.controls.levelsPage.classList.add('hide');
        self.domRef.controls.speedsPage.classList.add('hide');
    }

    self.restartMenuLater = () => {
        setTimeout(() => {
            self.restartMenu();
        }, 200);
    }

    self.isMenuClosed = () => {
        return self.domRef.controls.optionsMenu.className.indexOf('cvp_visible') == -1 ? true : false;
    }

    self.closeMenu = () => {
        if (self.isMenuClosed()) {
            return;
        }

        self.domRef.controls.optionsMenu.classList.remove('cvp_visible');
        self.inSubMenu = false;
        self.restartMenuLater();
    }


    self.setupClickMenuButton = () => {
        self.trackEvent(self.domRef.player.parentNode, 'click', '.fluid_button_main_menu', () => {
            if (self.isCurrentlyPlayingAd) {
                return;
            }

            if (self.isMenuClosed()) {
                self.domRef.controls.optionsMenu.classList.add('cvp_visible');
            } else {
                self.closeMenu();
            }
        });
    }

    self.setupClickMenuHeader = () => {
        self.domRef.controls.menuHeader.addEventListener('click', () => {
            self.restartMenu();
            self.inSubMenu = false;
        });
    }

    self.openSubMenu = (option, subPage, width, height) => {
        subPage.classList.remove('hide');
        self.domRef.controls.optionsMenu.classList.toggle('cvp_level2');
        self.domRef.controls.menuBackground.style.width = `${width}px`;
        self.domRef.controls.menuBackground.style.height = `${height}px`;
        self.domRef.controls.menuHeader.textContent = option.firstChild.textContent;
        self.inSubMenu = true;
    }

    self.setupMenu = () => {
        self.domRef.player.parentNode.insertBefore(self.domRef.controls.optionsMenu, null);
        self.setupClickMenuButton();
        self.setupClickMenuHeader();
        self.setupAutoPlay();
        self.setupPlaybackRates();
        self.setupQualityLevels();
    };
}