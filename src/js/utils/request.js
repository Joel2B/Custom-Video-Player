export default function(self, options) {
    self.sendRequest = (url, withCredentials, timeout, functionReadyStateChange) => {
        const xmlHttpReq = new XMLHttpRequest();

        xmlHttpReq.onreadystatechange = functionReadyStateChange;

        self.displayOptions.onBeforeXMLHttpRequestOpen(xmlHttpReq);

        xmlHttpReq.open('GET', url, true);
        xmlHttpReq.withCredentials = withCredentials;
        xmlHttpReq.timeout = timeout;

        self.displayOptions.onBeforeXMLHttpRequest(xmlHttpReq);

        xmlHttpReq.send();
    };
}
