(() => {
    /**
     * Return the URL.
     *
     * For the first request, the document is not known, but for the next, only the domain should be check to
     * avoid blocking content.
     */
    function getUrl(request) {
        if (typeof request.documentUrl !== "undefined") {
            return request.documentUrl;
        } else {
            return request.url;
        }
    }

    function blockRequestSilently() {
        return {
            cancel: true,
        }
    }

    function blockRequestWithInfoTab(request, reason) {
        browser.tabs.create({
                active: true,
                url: browser.runtime.getURL("blocked.html") + "?url=" + encodeURIComponent(getUrl(request)) + "&reason=" + reason,
            }
        );

        return blockRequestSilently();
    }

    function extensionNotReadyListener(request) {
        return blockRequestWithInfoTab(request, 1);
    }

    function checkUrl(request, whiteList, blackList) {
        function listToPatters(list) {
            return list.split("\n")
                .map(i => i.replace("*", "[\\w\\.-]*"))
                .map(i => new RegExp("^" + i + "$"));
        }

        function getDomain(url) {
            let domain = (new URL(url));
            return domain.hostname;
        }

        function isDomainInLists(domain, list) {
            let result = false;
            list.forEach((pattern) => {
                if (pattern.test(domain)) result = true;
            });
            return result;
        }

        let whiteListPatterns = listToPatters(whiteList);
        let blackListPatterns = listToPatters(blackList);
        let domain = getDomain(getUrl(request));

        if (isDomainInLists(domain, blackListPatterns)) {
            console.log(domain + " in blacklist.")
            return blockRequestSilently();
        }

        if (!isDomainInLists(domain, whiteListPatterns)) {
            console.log(domain + " not in whitelist.")
            return blockRequestWithInfoTab(request, 0);
        }
    }

    function startWithOptions(options) {
        let enable = options.enable || false;
        let whiteList = options.whiteList || "";
        let blackList = options.blackList || "";


        function onNewUrlListener(request) {
            return checkUrl(request, whiteList, blackList);
        }

        if (enable) {
            browser.webRequest.onBeforeRequest.removeListener(onNewUrlListener)
            browser.webRequest.onBeforeRequest.addListener(onNewUrlListener, {urls: ["<all_urls>"]}, ["blocking"]);
        } else {
            browser.webRequest.onBeforeRequest.removeListener(onNewUrlListener)
        }
    }

    function setButtonIcon(enable) {
        if (enable) {
            browser.browserAction.setIcon({path: "icons/lock-32.png"});
        } else {
            browser.browserAction.setIcon({path: "icons/unlock-32.png"});
        }
    }

    function buttonToolbarListener(event) {
        browser.storage.sync.get(["enable"]).then((options) => {
            browser.storage.sync.set({
                enable: !options.enable,
            });
            browser.runtime.reload();
        }, (error) => {
            console.log(`Error: ${error}`);
        });
    }

    function main() {
        // add a listener to deny everything until extension is ready
        browser.webRequest.onBeforeRequest.addListener(extensionNotReadyListener, {urls: ["<all_urls>"]}, ["blocking"]);

        // load all the options and call the main
        browser.storage.sync.get(["enable", "whiteList", "blackList"]).then((options) => {
            setButtonIcon(options.enable)
            startWithOptions(options);
            browser.webRequest.onBeforeRequest.removeListener(extensionNotReadyListener);
        }, (error) => {
            console.log(`Error: ${error}`);
        });

        // add listener to the button
        browser.browserAction.onClicked.addListener(buttonToolbarListener);
    }

    main();
})();


