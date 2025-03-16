import { BlockedWebsite } from "@/models/BlockedWebsite";
import { GlobalTimeBudget } from "@/models/GlobalTimeBudget";
import { timeDisplayFormatBadge, extractHostnameAndDomain, validateURL } from "@/lib/utils";

export default defineBackground(() => {
    chrome.runtime.onInstalled.addListener((object) => {
        if (object.reason === 'install') {
            chrome.runtime.openOptionsPage();
        }

        chrome.storage.local.get(['blockedWebsitesList', 'globalTimeBudget'], (data) => {
            if (!data.blockedWebsitesList) {
                chrome.storage.local.set({ blockedWebsitesList: {} });
            }

            if (!data.globalTimeBudget) {
                const globalTimeBudget = new GlobalTimeBudget(
                    new Set(),
                    0,
                    false,
                    "",
                    new Date().toLocaleDateString('en-CA').slice(0, 10),
                    []
                );

                chrome.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() });
            }

            if (object.reason === 'update') {

                // Handle legacy data
                chrome.storage.sync.get(['blockList'], (data_blocked) => {
                    const blockedList = data_blocked.blockList

                    if (blockedList && blockedList.length > 0) {
                        const oldBlockedList = blockedList;
                        let newBlockedList = data.blockedWebsitesList ? data.blockedWebsitesList : {};

                        oldBlockedList.forEach((item: any) => {
                            if (validateURL(item.url)) {
                                const url = extractHostnameAndDomain(item.url);
                                if (url) {
                                    newBlockedList[url] = BlockedWebsite.fromJSON({
                                        website: url,
                                        timeAllowed: item.timeTotal,
                                        totalTime: item.timeDay,
                                        blockIncognito: item.blockIncognito,
                                        redirectUrl: "",
                                        lastAccessedDate: new Date().toLocaleDateString('en-CA').slice(0, 10),
                                        scheduledBlockRanges: []
                                    })

                                    if (item.redirectUrl != "default" && validateURL(item.redirectUrl)) {
                                        newBlockedList[url].redirectUrl = item.redirectUrl;
                                    }
                                }
                            }

                        });

                        chrome.storage.sync.remove(['blockList']);
                        chrome.storage.local.set({ blockedWebsitesList: newBlockedList });
                    }
                });

                // Loop through all the blocked websites and change the key
                chrome.storage.local.get(['blockedWebsitesList'], (data) => {
                    const blockedWebsitesList = data.blockedWebsitesList;
                    if (!blockedWebsitesList) return;

                    const newBlockedWebsitesList: { [key: string]: BlockedWebsite } = {};

                    for (const website in blockedWebsitesList) {
                        if (blockedWebsitesList.hasOwnProperty(website)) {
                            newBlockedWebsitesList[extractHostnameAndDomain(website)!] = blockedWebsitesList[website];
                        }
                    }

                    chrome.storage.local.set({ blockedWebsitesList: newBlockedWebsitesList });
                });

            }
        });
    });

    setInterval(() => {
        chrome.windows.getCurrent((window) => {
            if (!window.focused) {
                stopCurrentBlocking();
            }
        });
    }, 1000);

    let activeBlockTimer: NodeJS.Timeout | null = null;

    browser.tabs.onUpdated.addListener((_tabId, _changedInfo, tab) => {
        console.log("Tab updated");
        if (tab.active && tab.url) {
            stopCurrentBlocking();
            debounceCheckUrlBlockStatus(tab);
        }
    });

    browser.tabs.onActivated.addListener((activeInfo) => {
        console.log("Tab activated");
        stopCurrentBlocking();

        chrome.tabs.get(activeInfo.tabId, (tab) => {
            if (tab.active && tab.url) {
                debounceCheckUrlBlockStatus(tab);
            }
        });
    });

    browser.windows.onFocusChanged.addListener((windowId) => {
        console.log("Tab focus");

        stopCurrentBlocking();

        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
            chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                if (tabs[0].active && tabs[0].url) {
                    debounceCheckUrlBlockStatus(tabs[0]);
                }
            });
        }
    });


    chrome.runtime.onConnect.addListener((port) => {
        stopCurrentBlocking(); // Stop blocking while popup is open
    
        port.onDisconnect.addListener(() => {
            // Check active tab when popup closes
            chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].url) {
                    debounceCheckUrlBlockStatus(tabs[0]);
                }
            });
        });
    });

    const stopCurrentBlocking = () => {
        if (activeBlockTimer != null) {
            clearInterval(activeBlockTimer);
            activeBlockTimer = null;
            setBadge("");
        }
    }

    let debounceTimer: NodeJS.Timeout | null = null;

    const debounceCheckUrlBlockStatus = (tab: chrome.tabs.Tab) => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            checkUrlBlockStatus(tab);
        }, 200); // Adjust delay as needed
    };


    const checkUrlBlockStatus = (tab: chrome.tabs.Tab) => {
        chrome.storage.local.get(['blockedWebsitesList', 'globalTimeBudget'], (data) => {
            if (!data.blockedWebsitesList || !data.globalTimeBudget) return;

            const websiteNames = Object.keys(data.blockedWebsitesList);
            const blockedWebsites = data.blockedWebsitesList;
            const globalTimeBudget = GlobalTimeBudget.fromJSON(data.globalTimeBudget);

            // No blocked websites
            if (websiteNames.length === 0 && globalTimeBudget.websites.size === 0) return;

            // Reset daily times if it is a new day
            const today = new Date().toLocaleDateString('en-CA').slice(0, 10);
            if (websiteNames.length > 0 && blockedWebsites[websiteNames[0]].lastAccessedDate !== today) {
                resetDailyTimers(data.blockedWebsitesList);
            }

            if (globalTimeBudget && globalTimeBudget.lastAccessedDate !== today) {
                globalTimeBudget.lastAccessedDate = today;
                chrome.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() })
            }

            const currentTabUrl = extractHostnameAndDomain(tab.url!);
            if (!currentTabUrl) return;

            const isUrlInGlobalList = globalTimeBudget.websites.has(currentTabUrl);
            const isUrlInBlockedList = Object.hasOwn(blockedWebsites, currentTabUrl);

            if (!isUrlInBlockedList && !isUrlInGlobalList) return;

            if (isUrlInBlockedList) {
                let currentBlockedWebsite = blockedWebsites[currentTabUrl];
                if (!currentBlockedWebsite) return;

                // Check if it is an incognito tab
                if (currentBlockedWebsite.blockIncognito == false && tab.incognito == true) return;

                // Check if the current time is in a scheduled block time
                if (currentBlockedWebsite.scheduledBlockRanges.length > 0) checkScheduledBlock(currentBlockedWebsite.scheduledBlockRanges, currentBlockedWebsite.redirectUrl, tab);

                // Check if time has expired
                if (currentBlockedWebsite.totalTime >= currentBlockedWebsite.timeAllowed) {
                    redirectToUrl(currentBlockedWebsite.redirectUrl, tab.id!);
                    return;
                }

                if (isUrlInGlobalList) {
                    // Check if the current time is in a global scheduled block time
                    if (globalTimeBudget.scheduledBlockRanges.length > 0) checkScheduledBlock(globalTimeBudget.scheduledBlockRanges, globalTimeBudget.redirectUrl, tab);

                    // Check if global time has expired
                    if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed) {
                        redirectToUrl(globalTimeBudget.redirectUrl, tab.id!);
                        return;
                    }

                    if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(currentBlockedWebsite!, globalTimeBudget, tab), 1000);
                } else {
                    if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(currentBlockedWebsite!, null, tab), 1000);
                }

                setBadge(timeDisplayFormatBadge(currentBlockedWebsite.timeAllowed - currentBlockedWebsite.totalTime))

            } else if (isUrlInGlobalList) {
                // Check if the current time is in a global scheduled block time
                if (globalTimeBudget.scheduledBlockRanges.length > 0) checkScheduledBlock(globalTimeBudget.scheduledBlockRanges, globalTimeBudget.redirectUrl, tab);

                // Check if global time has expired
                if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed) {
                    redirectToUrl(globalTimeBudget.redirectUrl, tab.id!);
                    return;
                }

                if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(null, globalTimeBudget, tab), 1000);
                setBadge(timeDisplayFormatBadge(globalTimeBudget.timeAllowed - globalTimeBudget.totalTime));
            }

        });
    }


    const updateTime = (blockedWebsite: BlockedWebsite | null, globalTimeBudget: GlobalTimeBudget | null, tab: chrome.tabs.Tab) => {
        if (blockedWebsite) {
            blockedWebsite.totalTime += 1;
            setBadge(timeDisplayFormatBadge(blockedWebsite.timeAllowed - blockedWebsite.totalTime));
            storeData(blockedWebsite.website, blockedWebsite.totalTime);
            if (blockedWebsite.totalTime >= blockedWebsite.timeAllowed) {
                clearInterval(activeBlockTimer!);
                redirectToUrl(blockedWebsite.redirectUrl, tab.id!);
            }

            if (globalTimeBudget) {
                globalTimeBudget.totalTime += 1;
                storeGlobalData(globalTimeBudget.totalTime);

                if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed) {
                    clearInterval(activeBlockTimer!);
                    redirectToUrl(globalTimeBudget.redirectUrl, tab.id!);
                }
            }
        } else if (globalTimeBudget) {
            globalTimeBudget.totalTime += 1;
            setBadge(timeDisplayFormatBadge(globalTimeBudget.timeAllowed - globalTimeBudget.totalTime));
            storeGlobalData(globalTimeBudget.totalTime);

            if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed) {
                clearInterval(activeBlockTimer!);
                redirectToUrl(globalTimeBudget.redirectUrl, tab.id!);
            }
        }
    }

    const checkScheduledBlock = (scheduledBlockRanges: Array<{ start: number; end: number }>, redirectUrl: string, tab: chrome.tabs.Tab) => {
        const currentTime = new Date();
        const currentTimestamp = currentTime.getHours() * 60 + currentTime.getMinutes();

        if (
            scheduledBlockRanges.some(
                (range) => isWithinScheduledBlock(range, currentTimestamp)
            )
        ) {
            redirectToUrl(redirectUrl, tab.id!);
            return;
        }
    }

    function isWithinScheduledBlock(range: { start: number; end: number }, currentTimestamp: number) {
        // Handles crossing midnight by checking if end < start
        if (range.end < range.start) {
            return currentTimestamp >= range.start || currentTimestamp < range.end;
        }
        return currentTimestamp >= range.start && currentTimestamp < range.end;
    }

    const redirectToUrl = (url: string, tabId: number) => {
        if (url == "") {
            chrome.tabs.update(tabId, { "url": chrome.runtime.getURL('/inspiration.html') });
        } else {
            if (url.includes("https://") || url.includes("http://")) {
                chrome.tabs.update(tabId, { "url": url });
            } else {
                chrome.tabs.update(tabId, { "url": 'https://' + url });
            }
        }
    }

    const resetDailyTimers = (blockedWebsites: Record<string, BlockedWebsite>) => {
        for (const website in blockedWebsites) {
            if (blockedWebsites.hasOwnProperty(website)) {
                blockedWebsites[website].totalTime = 0;
                blockedWebsites[website].lastAccessedDate = new Date().toLocaleDateString('en-CA').slice(0, 10);
            }
        }

        chrome.storage.local.set({ blockedWebsitesList: blockedWebsites })
    }


    const storeData = (websiteName: string, totalTime: number) => {
        chrome.storage.local.get(['blockedWebsitesList'], (data) => {
            if (!data.blockedWebsitesList || typeof data.blockedWebsitesList !== 'object') return;
            let blockedWebsitesList = data.blockedWebsitesList

            blockedWebsitesList[websiteName].totalTime = totalTime;

            chrome.storage.local.set({ blockedWebsitesList: blockedWebsitesList });
        });
    }

    const storeGlobalData = (totalTime: number) => {
        chrome.storage.local.get(['globalTimeBudget'], (data) => {
            if (!data.globalTimeBudget || typeof data.globalTimeBudget !== 'object') return;

            let globalTimeBudget = GlobalTimeBudget.fromJSON(data.globalTimeBudget);

            globalTimeBudget.totalTime = totalTime;

            chrome.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() });
        });
    }

    const setBadge = (text: string) => {
        chrome.action.setBadgeBackgroundColor({ color: "#ae0f0f" });
        chrome.action.setBadgeText({ text });
    }
});