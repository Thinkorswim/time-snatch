import { BlockedWebsite } from "@/models/BlockedWebsite";
import { GlobalTimeBudget } from "@/models/GlobalTimeBudget";
import { timeDisplayFormatBadge, extractHostnameAndDomain, validateURL } from "@/lib/utils";

export default defineBackground(() => {
    browser.runtime.onInstalled.addListener((object) => {
        if (object.reason === 'install') {
            browser.runtime.openOptionsPage();
        }

        browser.storage.local.get(['blockedWebsitesList', 'globalTimeBudget'], (data) => {
            if (!data.blockedWebsitesList) {
                browser.storage.local.set({ blockedWebsitesList: {} });
            }

            if (!data.globalTimeBudget) {
                const globalTimeBudget = new GlobalTimeBudget(
                    new Set(),
                    { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300, 5: 300, 6: 300 },
                    false,
                    false,
                    "",
                    new Date().toLocaleDateString('en-CA').slice(0, 10),
                    []
                );

                browser.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() });
            }

            if (object.reason === 'update') {
                // Handle legacy data
                browser.storage.sync.get(['blockList'], (data_blocked) => {
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
                                        timeAllowed: {
                                            0: item.timeDay,
                                            1: item.timeDay,
                                            2: item.timeDay,
                                            3: item.timeDay,
                                            4: item.timeDay,
                                            5: item.timeDay,
                                            6: item.timeDay,
                                        },
                                        totalTime: item.timeDay,
                                        blockIncognito: item.blockIncognito,
                                        variableSchedule: false,
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

                        browser.storage.sync.remove(['blockList']);
                        browser.storage.local.set({ blockedWebsitesList: newBlockedList });
                    }
                });

                // Loop through all the blocked websites and change the key
                browser.storage.local.get(['blockedWebsitesList'], (data) => {
                    const blockedWebsitesList = data.blockedWebsitesList;
                    if (!blockedWebsitesList) return;

                    const newBlockedWebsitesList: { [key: string]: BlockedWebsite } = {};

                    for (const website in blockedWebsitesList) {
                        if (blockedWebsitesList.hasOwnProperty(website)) {
                            newBlockedWebsitesList[extractHostnameAndDomain(website)!] = blockedWebsitesList[website];
                        }

                        // Check if the websites uses the new type of timeAllowed
                        if (typeof blockedWebsitesList[website].timeAllowed !== 'object') {
                            newBlockedWebsitesList[extractHostnameAndDomain(website)!].timeAllowed = {
                                0: blockedWebsitesList[website].timeAllowed,
                                1: blockedWebsitesList[website].timeAllowed,
                                2: blockedWebsitesList[website].timeAllowed,
                                3: blockedWebsitesList[website].timeAllowed,
                                4: blockedWebsitesList[website].timeAllowed,
                                5: blockedWebsitesList[website].timeAllowed,
                                6: blockedWebsitesList[website].timeAllowed,
                            }
                        }

                        // Make all scheduledBlockRanges have days field
                        if (blockedWebsitesList[website].scheduledBlockRanges && blockedWebsitesList[website].scheduledBlockRanges.length > 0) {
                            blockedWebsitesList[website].scheduledBlockRanges.forEach((range: { start: number; end: number; days?: boolean[] }) => {
                                if (!range.days) {
                                    range.days = [true, true, true, true, true, true, true];
                                }
                            });
                        }
                    }

                    browser.storage.local.set({ blockedWebsitesList: newBlockedWebsitesList });
                });

                
                console.log("Migrated blocked websites list to new format.");

                if (typeof data.globalTimeBudget.timeAllowed !== 'object') {
                    console.log("Migrated global time budget to new format.");
                    data.globalTimeBudget.timeAllowed = {
                        0: data.globalTimeBudget.timeAllowed,
                        1: data.globalTimeBudget.timeAllowed,
                        2: data.globalTimeBudget.timeAllowed,
                        3: data.globalTimeBudget.timeAllowed,
                        4: data.globalTimeBudget.timeAllowed,
                        5: data.globalTimeBudget.timeAllowed,
                        6: data.globalTimeBudget.timeAllowed,
                    }

                    browser.storage.local.set({ globalTimeBudget: data.globalTimeBudget });
                }
            }
        });
    });

    setInterval(() => {
        browser.windows.getCurrent((window) => {
            if (!window.focused) {
                stopCurrentBlocking();
            }
        });
    }, 1000);

    let activeBlockTimer: NodeJS.Timeout | null = null;

    browser.tabs.onUpdated.addListener((_tabId, _changedInfo, tab) => {
        if (tab.active && tab.url) {
            stopCurrentBlocking();
            debounceCheckUrlBlockStatus(tab);
        }
    });

    browser.tabs.onActivated.addListener((activeInfo) => {
        stopCurrentBlocking();

        browser.tabs.get(activeInfo.tabId, (tab) => {
            if (tab.active && tab.url) {
                debounceCheckUrlBlockStatus(tab);
            }
        });
    });

    browser.windows.onFocusChanged.addListener((windowId) => {
        stopCurrentBlocking();

        if (windowId !== browser.windows.WINDOW_ID_NONE) {
            browser.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                if (tabs[0].active && tabs[0].url) {
                    debounceCheckUrlBlockStatus(tabs[0]);
                }
            });
        }
    });


    browser.runtime.onConnect.addListener((port) => {
        stopCurrentBlocking(); // Stop blocking while popup is open

        port.onDisconnect.addListener(() => {
            // Check active tab when popup closes
            browser.tabs.query({ currentWindow: true, active: true }, (tabs) => {
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
        browser.storage.local.get(['blockedWebsitesList', 'globalTimeBudget'], (data) => {
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
                browser.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() })
            }

            const currentTabUrl = extractHostnameAndDomain(tab.url!);
            if (!currentTabUrl) return;

            const isUrlInGlobalList = globalTimeBudget.websites.has(currentTabUrl);
            const isUrlInBlockedList = Object.hasOwn(blockedWebsites, currentTabUrl);

            if (!isUrlInBlockedList && !isUrlInGlobalList) return;
            // Check what day of the week it is 
            const dayOfTheWeek = (new Date().getDay() + 6) % 7;

            if (isUrlInBlockedList) {
                let currentBlockedWebsite = blockedWebsites[currentTabUrl];
                if (!currentBlockedWebsite) return;

                if (currentBlockedWebsite.timeAllowed[dayOfTheWeek] == -1) return;

                // Check if it is an incognito tab
                if (currentBlockedWebsite.blockIncognito == false && tab.incognito == true) return;

                // Check if the current time is in a scheduled block time
                if (currentBlockedWebsite.scheduledBlockRanges.length > 0) checkScheduledBlock(currentBlockedWebsite.scheduledBlockRanges, currentBlockedWebsite.redirectUrl, tab);

                // Check if time has expired
                if (currentBlockedWebsite.totalTime >= currentBlockedWebsite.timeAllowed[dayOfTheWeek]) {
                    redirectToUrl(currentBlockedWebsite.redirectUrl, tab.id!);
                    return;
                }

                if (isUrlInGlobalList && globalTimeBudget.timeAllowed[dayOfTheWeek] != -1) {
                    // Check if the current time is in a global scheduled block time
                    if (globalTimeBudget.scheduledBlockRanges.length > 0) checkScheduledBlock(globalTimeBudget.scheduledBlockRanges, globalTimeBudget.redirectUrl, tab);

                    // Check if global time has expired
                    if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed[dayOfTheWeek]) {
                        redirectToUrl(globalTimeBudget.redirectUrl, tab.id!);
                        return;
                    }

                    if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(currentBlockedWebsite!, globalTimeBudget, tab), 1000);
                } else {
                    if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(currentBlockedWebsite!, null, tab), 1000);
                }

                setBadge(timeDisplayFormatBadge(currentBlockedWebsite.timeAllowed[dayOfTheWeek] - currentBlockedWebsite.totalTime))

            } else if (isUrlInGlobalList) {
                if (globalTimeBudget.timeAllowed[dayOfTheWeek] == -1) return;

                // Check if the current time is in a global scheduled block time
                if (globalTimeBudget.scheduledBlockRanges.length > 0) checkScheduledBlock(globalTimeBudget.scheduledBlockRanges, globalTimeBudget.redirectUrl, tab);

                // Check if global time has expired
                if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed[dayOfTheWeek]) {
                    redirectToUrl(globalTimeBudget.redirectUrl, tab.id!);
                    return;
                }

                if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(null, globalTimeBudget, tab), 1000);
                setBadge(timeDisplayFormatBadge(globalTimeBudget.timeAllowed[dayOfTheWeek] - globalTimeBudget.totalTime));
            }

        });
    }


    const updateTime = (blockedWebsite: BlockedWebsite | null, globalTimeBudget: GlobalTimeBudget | null, tab: chrome.tabs.Tab) => {
        const dayOfTheWeek = (new Date().getDay() + 6) % 7;

        if (blockedWebsite) {
            blockedWebsite.totalTime += 1;
            setBadge(timeDisplayFormatBadge(blockedWebsite.timeAllowed[dayOfTheWeek] - blockedWebsite.totalTime));
            storeData(blockedWebsite.website, blockedWebsite.totalTime);
            if (blockedWebsite.totalTime >= blockedWebsite.timeAllowed[dayOfTheWeek]) {
                clearInterval(activeBlockTimer!);
                redirectToUrl(blockedWebsite.redirectUrl, tab.id!);
            }

            if (globalTimeBudget) {
                globalTimeBudget.totalTime += 1;
                storeGlobalData(globalTimeBudget.totalTime);

                if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed[dayOfTheWeek]) {
                    clearInterval(activeBlockTimer!);
                    redirectToUrl(globalTimeBudget.redirectUrl, tab.id!);
                }
            }
        } else if (globalTimeBudget) {
            globalTimeBudget.totalTime += 1;
            setBadge(timeDisplayFormatBadge(globalTimeBudget.timeAllowed[dayOfTheWeek] - globalTimeBudget.totalTime));
            storeGlobalData(globalTimeBudget.totalTime);

            if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed[dayOfTheWeek]) {
                clearInterval(activeBlockTimer!);
                redirectToUrl(globalTimeBudget.redirectUrl, tab.id!);
            }
        }
    }

    const checkScheduledBlock = (scheduledBlockRanges: Array<{ start: number; end: number, days: boolean[] }>, redirectUrl: string, tab: chrome.tabs.Tab) => {
        const currentTime = new Date();
        const dayOfTheWeek = (currentTime.getDay() + 6) % 7;
        const currentTimestamp = currentTime.getHours() * 60 + currentTime.getMinutes();

        // exclude the current day if it is not in the scheduled block range
        const filteredScheduledBlockRanges = scheduledBlockRanges.filter((range) => range.days[dayOfTheWeek] == true);

        if (
            filteredScheduledBlockRanges.some(
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
            browser.tabs.update(tabId, { "url": browser.runtime.getURL('/inspiration.html') });
        } else {
            if (url.includes("https://") || url.includes("http://")) {
                browser.tabs.update(tabId, { "url": url });
            } else {
                browser.tabs.update(tabId, { "url": 'https://' + url });
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

        browser.storage.local.set({ blockedWebsitesList: blockedWebsites })
    }


    const storeData = (websiteName: string, totalTime: number) => {
        browser.storage.local.get(['blockedWebsitesList'], (data) => {
            if (!data.blockedWebsitesList || typeof data.blockedWebsitesList !== 'object') return;
            let blockedWebsitesList = data.blockedWebsitesList

            blockedWebsitesList[websiteName].totalTime = totalTime;

            browser.storage.local.set({ blockedWebsitesList: blockedWebsitesList });
        });
    }

    const storeGlobalData = (totalTime: number) => {
        browser.storage.local.get(['globalTimeBudget'], (data) => {
            if (!data.globalTimeBudget || typeof data.globalTimeBudget !== 'object') return;

            let globalTimeBudget = GlobalTimeBudget.fromJSON(data.globalTimeBudget);

            globalTimeBudget.totalTime = totalTime;

            browser.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() });
        });
    }

    const setBadge = (text: string) => {
        if (import.meta.env.BROWSER === 'firefox') {
            browser.browserAction.setBadgeBackgroundColor({ color: "#ae0f0f" });
            browser.browserAction.setBadgeText({ text });
        } else {
            browser.action.setBadgeBackgroundColor({ color: "#ae0f0f" });
            browser.action.setBadgeText({ text });
        }
    }
});