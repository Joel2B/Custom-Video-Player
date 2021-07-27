export default function (self) {
    self.restartMenu = () => {
        self.domRef.controls.menuBackground.style.width = `${self.menu.width}px`;
        self.domRef.controls.menuBackground.style.height = `${self.menu.height}px`;
        self.domRef.controls.mainPage.style.width = `${self.menu.width}px`;
        self.domRef.controls.mainPage.style.height = `${self.menu.height}px`;
        self.domRef.controls.optionsMenu.classList.remove('cvp_level2');
        if (self.isEnabledModule('qualityLevels')) {
            self.domRef.controls.levelsPage.classList.add('hide');
        }
        if (self.isEnabledModule('playbackRate')) {
            self.domRef.controls.speedsPage.classList.add('hide');
        }
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
        self.menu.inSubmenu = false;
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
            self.menu.inSubmenu = false;
        });
    }

    self.openSubMenu = (option, subPage, width, height) => {
        subPage.classList.remove('hide');
        self.domRef.controls.optionsMenu.classList.toggle('cvp_level2');
        self.domRef.controls.menuBackground.style.width = `${width}px`;
        self.domRef.controls.menuBackground.style.height = `${height}px`;
        self.domRef.controls.menuHeader.textContent = option.firstChild.textContent;
        self.menu.inSubmenu = true;
    }

    self.setupMenu = () => {
        if (self.menu.enabledModules == 0) {
            return;
        }
        self.domRef.player.parentNode.insertBefore(self.domRef.controls.optionsMenu, null);
        self.setupClickMenuButton();
        self.setupClickMenuHeader();
        self.setupAutoPlay();
        self.setupPlaybackRates();
        self.setupQualityLevels();
    };

    self.isEnabledModule = (module) => {
        return self.displayOptions.layoutControls.menu[module] ? true : false
    };

    self.removeOption = (option) => {
        self.domRef.controls[option].remove();
        self.menu.height -= self.menu.option.height;
        self.restartMenu();
    }
}
