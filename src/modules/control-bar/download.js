export default function (self) {
    self.createDownload = () => {
        const downloadOption = self.domRef.controls.download;
        if (!self.displayOptions.layoutControls.allowDownload) {
            return;
        }
        downloadOption.style.display = 'inline-block';

        const downloadClick = self.createElement({
            tag: 'a',
            id: self.videoPlayerId + '_download',
        }, (e) => {
            const linkItem = downloadClick;

            if (typeof e.stopImmediatePropagation !== 'undefined') {
                e.stopImmediatePropagation();
            }

            setInterval(function () {
                linkItem.download = '';
                linkItem.href = '';
            }, 100);
        });

        downloadOption.appendChild(downloadClick);

        downloadOption.addEventListener('click', function () {
            const downloadItem = downloadClick;
            downloadItem.download = self.originalSrc;
            downloadItem.href = self.originalSrc;
            downloadClick.click();
        });
    };
}
