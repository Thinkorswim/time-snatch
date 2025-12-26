import { BlockedWebsite } from "@/models/BlockedWebsite";
import { GlobalTimeBudget } from "@/models/GlobalTimeBudget";
import { timeDisplayFormatBadge, extractHostnameAndDomain, extractPathnameAndParams, validateURL, scheduledBlockDisplay } from "@/lib/utils";
import { defaultQuotes } from "@/entrypoints/inspiration/quotes";
import { Settings } from "@/models/Settings";
import { syncWebsitesIfNeeded, syncTimeUpdate, syncPushAll, TIME_SYNC_INTERVAL } from "@/lib/sync";

export default defineBackground(() => {
    browser.runtime.onInstalled.addListener((object) => {
        if (object.reason === 'install') {
            browser.runtime.openOptionsPage();
        }

        browser.storage.local.get(['blockedWebsitesList', 'groupTimeBudgets', 'globalTimeBudget', 'dailyStatistics', 'historicalRestrictedTimePerDay', 'historicalBlockedPerDay', "quotes", "settings", "password"], (data) => {
            if (!data.blockedWebsitesList) {
                browser.storage.local.set({ blockedWebsitesList: {} });
            }

            if (!data.historicalBlockedPerDay) {
                const historicalBlockedPerDay = {}

                browser.storage.local.set({ historicalBlockedPerDay });
            }

            if (!data.historicalRestrictedTimePerDay) {
                const historicalRestrictedTimePerDay = {}

                browser.storage.local.set({ historicalRestrictedTimePerDay });
            }

            if (!data.dailyStatistics) {
                const dailyStatistics = {
                    blockedPerDay: {},
                    restrictedTimePerDay: {},
                    day: new Date().toLocaleDateString('en-CA').slice(0, 10),
                };

                browser.storage.local.set({ dailyStatistics });
            }

            if (!data.groupTimeBudgets && !data.globalTimeBudget) {
                const defaultBudget = new GlobalTimeBudget(
                    new Set(),
                    { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300, 5: 300, 6: 300 },
                    false,
                    false,
                    "",
                    new Date().toLocaleDateString('en-CA').slice(0, 10),
                    []
                );

                const groupTimeBudgets = [defaultBudget];

                browser.storage.local.set({ 
                    groupTimeBudgets: groupTimeBudgets.map(b => b.toJSON()) 
                });
            }

            if (!data.quotes) {
                browser.storage.local.set({ quotes: defaultQuotes });
            }

            if (!data.settings) {
                let password = data.password ? data.password : "";
                
                const settings = Settings.fromJSON({
                    password: password,
                    whiteListPathsEnabled: false,
                });

                browser.storage.local.set({ settings });
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
                                        scheduledBlockRanges: [],
                                        allowedPaths: [],
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

                        // add empty allowedPaths array
                        if (!blockedWebsitesList[website].allowedPaths) {
                            blockedWebsitesList[website].allowedPaths = [];
                        }
                    }

                    browser.storage.local.set({ blockedWebsitesList: newBlockedWebsitesList });
                });

                
                // Migrate from single globalTimeBudget to multiple groupTimeBudgets
                if (data.globalTimeBudget && !data.groupTimeBudgets) {
                    // Convert old single budget to new multiple budgets format
                    const oldBudget = data.globalTimeBudget;
                    
                    // Ensure timeAllowed is an object
                    if (typeof oldBudget.timeAllowed !== 'object') {
                        oldBudget.timeAllowed = {
                            0: oldBudget.timeAllowed,
                            1: oldBudget.timeAllowed,
                            2: oldBudget.timeAllowed,
                            3: oldBudget.timeAllowed,
                            4: oldBudget.timeAllowed,
                            5: oldBudget.timeAllowed,
                            6: oldBudget.timeAllowed,
                        }
                    }

                    // Ensure scheduledBlockRanges have days field
                    if (oldBudget.scheduledBlockRanges && oldBudget.scheduledBlockRanges.length > 0) {
                        oldBudget.scheduledBlockRanges.forEach((range: { start: number; end: number; days?: boolean[] }) => {
                            if (!range.days) {
                                range.days = [true, true, true, true, true, true, true];
                            }
                        });
                    }

                    // Create the new GlobalTimeBudget
                    const migratedBudget = GlobalTimeBudget.fromJSON(oldBudget);

                    // Create array with single budget
                    const groupTimeBudgets = [migratedBudget];

                    // Save the new format
                    browser.storage.local.set({ 
                        groupTimeBudgets: groupTimeBudgets.map(b => b.toJSON()) 
                    });
                    
                    // Remove the old globalTimeBudget field
                    browser.storage.local.remove(['globalTimeBudget']);
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

    // Track current blocking for time sync
    let lastTimeSyncTime = 0;
    let currentSyncData: {
        website: string | null;
        blockedWebsite: BlockedWebsite | null;
        groupBudgetIndex: number | null;
        groupBudget: GlobalTimeBudget | null;
    } | null = null;

    const syncCurrentTime = async () => {
        if (!currentSyncData) return;
        
        const today = new Date().toLocaleDateString('en-CA').slice(0, 10);
        const { website, blockedWebsite, groupBudgetIndex, groupBudget } = currentSyncData;

        // Get current daily statistics
        const data = await browser.storage.local.get(['dailyStatistics']);
        const dailyStatistics = data.dailyStatistics || null;

        await syncTimeUpdate({
            ...(website && blockedWebsite ? {
                website,
                blockedWebsite: { totalTime: blockedWebsite.totalTime, lastAccessedDate: today }
            } : {}),
            ...(groupBudgetIndex !== null && groupBudget ? {
                groupBudgetIndex,
                groupBudget: { totalTime: groupBudget.totalTime, lastAccessedDate: today }
            } : {}),
            ...(dailyStatistics ? { dailyStatistics } : {})
        });

        lastTimeSyncTime = Date.now();
    };

    const stopCurrentBlocking = async () => {
        if (activeBlockTimer != null) {
            clearInterval(activeBlockTimer);
            activeBlockTimer = null;
            setBadge("");

            // Sync before stopping
            await syncCurrentTime();
            currentSyncData = null;
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

    const checkUrlBlockStatus = async (tab: chrome.tabs.Tab) => {
        // Sync website data from backend if needed (Pro users only, throttled)
        await syncWebsitesIfNeeded();

        browser.storage.local.get(['blockedWebsitesList', 'groupTimeBudgets'], (data) => {
            if (!data.blockedWebsitesList) return;

            const websiteNames = Object.keys(data.blockedWebsitesList);
            const blockedWebsites = data.blockedWebsitesList;
            
            // Load group time budgets (array of GlobalTimeBudget)
            let groupTimeBudgets: GlobalTimeBudget[] = [];
            if (data.groupTimeBudgets && Array.isArray(data.groupTimeBudgets)) {
                groupTimeBudgets = data.groupTimeBudgets.map((b: any) => GlobalTimeBudget.fromJSON(b));
            }

            // No blocked websites and no group budgets
            const totalGroupWebsites = groupTimeBudgets.reduce((sum, budget) => sum + budget.websites.size, 0);
            
            if (websiteNames.length === 0 && totalGroupWebsites === 0) return;

            // Reset daily times if it is a new day
            const today = new Date().toLocaleDateString('en-CA').slice(0, 10);
            let dayReset = false;

            if (websiteNames.length > 0 && blockedWebsites[websiteNames[0]].lastAccessedDate !== today) {
                resetDailyTimers(data.blockedWebsitesList);
                dayReset = true;
            }

            // Reset group budgets if it's a new day
            if (groupTimeBudgets.length > 0) {
                let needsUpdate = false;
                for (const budget of groupTimeBudgets) {
                    if (budget.lastAccessedDate !== today) {
                        budget.lastAccessedDate = today;
                        budget.totalTime = 0;
                        needsUpdate = true;
                    }
                }
                
                if (needsUpdate) {
                    browser.storage.local.set({ 
                        groupTimeBudgets: groupTimeBudgets.map(b => b.toJSON()) 
                    });
                    updateHistoricalData();
                    dayReset = true;
                }
            }

            // Sync once after all resets
            if (dayReset) {
                syncPushAll();
            }

            const currentTabUrl = extractHostnameAndDomain(tab.url!);
            if (!currentTabUrl) return;

            const currentTabPath = extractPathnameAndParams(tab.url!);

            // Find all group budgets that contain this URL (with their indices)
            const relevantGroupBudgetIndices: number[] = [];
            const relevantGroupBudgets: GlobalTimeBudget[] = [];
            groupTimeBudgets.forEach((budget, index) => {
                if (budget.websites.has(currentTabUrl)) {
                    relevantGroupBudgetIndices.push(index);
                    relevantGroupBudgets.push(budget);
                }
            });
            
            const isUrlInGroupBudgets = relevantGroupBudgets.length > 0;
            const isUrlInBlockedList = Object.hasOwn(blockedWebsites, currentTabUrl);

            if (!isUrlInBlockedList && !isUrlInGroupBudgets) return;
            
            // Check what day of the week it is 
            const dayOfTheWeek = (new Date().getDay() + 6) % 7;

            if (isUrlInBlockedList) {
                let currentBlockedWebsite = blockedWebsites[currentTabUrl];
                if (!currentBlockedWebsite) return;

                if (currentTabPath) {
                    let allowedPaths: string[] = currentBlockedWebsite.allowedPaths;
                    if (allowedPaths.includes(currentTabPath)) return;
                }

                if (currentBlockedWebsite.timeAllowed[dayOfTheWeek] == -1) return;

                // Check if it is an incognito tab
                if (currentBlockedWebsite.blockIncognito == false && tab.incognito == true) return;

                // Check if the current time is in a scheduled block time
                if (currentBlockedWebsite.scheduledBlockRanges.length > 0) checkScheduledBlock(currentBlockedWebsite.scheduledBlockRanges, currentBlockedWebsite.redirectUrl, tab, false);

                // Check if time has expired
                if (currentBlockedWebsite.totalTime >= currentBlockedWebsite.timeAllowed[dayOfTheWeek]) {
                    redirectToUrl(currentBlockedWebsite.redirectUrl, tab.id!, currentTabUrl, "Time limit reached on " + currentTabUrl);
                    return;
                }

                // Check all relevant group budgets
                if (isUrlInGroupBudgets) {
                    for (const groupBudget of relevantGroupBudgets) {
                        if (groupBudget.timeAllowed[dayOfTheWeek] == -1) continue;
                        
                        // Check if the current time is in a group scheduled block time
                        if (groupBudget.scheduledBlockRanges.length > 0) {
                            checkScheduledBlock(groupBudget.scheduledBlockRanges, groupBudget.redirectUrl, tab, true);
                        }

                        // Check if group time has expired
                        if (groupBudget.totalTime >= groupBudget.timeAllowed[dayOfTheWeek]) {
                            redirectToUrl(groupBudget.redirectUrl, tab.id!, "Group Budget", "Time limit reached on Group Budget (" + currentTabUrl + ")");
                            return;
                        }
                    }

                    if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(currentBlockedWebsite!, relevantGroupBudgets, relevantGroupBudgetIndices, tab), 1000);
                } else {
                    if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(currentBlockedWebsite!, null, null, tab), 1000);
                }
                
                // Show badge for the most restrictive time
                const badgeTime = getMostRestrictiveBadgeTime(currentBlockedWebsite, isUrlInGroupBudgets ? relevantGroupBudgets : null, dayOfTheWeek);
                setBadge(badgeTime === -1 ? "" : timeDisplayFormatBadge(badgeTime));

            } else if (isUrlInGroupBudgets) {
                // Only in group budgets, not in blocked list
                // Check all relevant group budgets and use the most restrictive one
                for (const groupBudget of relevantGroupBudgets) {
                    if (groupBudget.timeAllowed[dayOfTheWeek] == -1) continue;

                    // Check if the current time is in a group scheduled block time
                    if (groupBudget.scheduledBlockRanges.length > 0) {
                        checkScheduledBlock(groupBudget.scheduledBlockRanges, groupBudget.redirectUrl, tab, true);
                    }

                    // Check if group time has expired
                    if (groupBudget.totalTime >= groupBudget.timeAllowed[dayOfTheWeek]) {
                        redirectToUrl(groupBudget.redirectUrl, tab.id!, "Group Budget", "Time limit reached on Group Budget (" + currentTabUrl + ")");
                        return;
                    }
                }

                if (activeBlockTimer == null) activeBlockTimer = setInterval(() => updateTime(null, relevantGroupBudgets, relevantGroupBudgetIndices, tab), 1000);
                
                // Show badge for the most restrictive group (least time remaining)
                const badgeTime = getMostRestrictiveBadgeTime(null, relevantGroupBudgets, dayOfTheWeek);
                setBadge(badgeTime === -1 ? "" : timeDisplayFormatBadge(badgeTime));
            }

        });
    }

    // Helper function to calculate the most restrictive time remaining for badge display
    // Returns -1 if all time limits are unlimited (day off), otherwise returns the lowest time remaining
    const getMostRestrictiveBadgeTime = (blockedWebsite: BlockedWebsite | null, groupBudgets: GlobalTimeBudget[] | null, dayOfTheWeek: number): number => {
        let lowestTimeRemaining = Infinity;

        // Check blocked website time
        if (blockedWebsite && blockedWebsite.timeAllowed[dayOfTheWeek] !== -1) {
            lowestTimeRemaining = blockedWebsite.timeAllowed[dayOfTheWeek] - blockedWebsite.totalTime;
        }

        // Check all group budgets time
        if (groupBudgets && groupBudgets.length > 0) {
            for (const groupBudget of groupBudgets) {
                if (groupBudget.timeAllowed[dayOfTheWeek] === -1) continue;
                const groupTimeRemaining = groupBudget.timeAllowed[dayOfTheWeek] - groupBudget.totalTime;
                if (groupTimeRemaining < lowestTimeRemaining) {
                    lowestTimeRemaining = groupTimeRemaining;
                }
            }
        }

        // If no time limits were found (all are -1), return -1 to indicate no badge should be shown
        return lowestTimeRemaining === Infinity ? -1 : lowestTimeRemaining;
    }


    const updateTime = (blockedWebsite: BlockedWebsite | null, groupBudgets: GlobalTimeBudget[] | null, groupBudgetIndices: number[] | null, tab: chrome.tabs.Tab) => {
        const dayOfTheWeek = (new Date().getDay() + 6) % 7;
        const today = new Date().toLocaleDateString('en-CA').slice(0, 10);
        let currentUrl = extractHostnameAndDomain(tab.url!);

        // Update tracking state for sync (use first group budget if multiple)
        currentSyncData = {
            website: blockedWebsite?.website || null,
            blockedWebsite,
            groupBudgetIndex: groupBudgetIndices && groupBudgetIndices.length > 0 ? groupBudgetIndices[0] : null,
            groupBudget: groupBudgets && groupBudgets.length > 0 ? groupBudgets[0] : null,
        };
        
        browser.storage.local.get(['dailyStatistics'], (data) => {
            if (data.dailyStatistics) {
                const dailyStatistics = data.dailyStatistics;
                if (blockedWebsite?.website) {
                    dailyStatistics['restrictedTimePerDay'][blockedWebsite.website] = dailyStatistics['restrictedTimePerDay'][blockedWebsite.website] || 0;
                    dailyStatistics['restrictedTimePerDay'][blockedWebsite.website] += 1;
                } else {
                    if (currentUrl) {
                        dailyStatistics['restrictedTimePerDay'][currentUrl] = dailyStatistics['restrictedTimePerDay'][currentUrl] || 0;
                        dailyStatistics['restrictedTimePerDay'][currentUrl] += 1;
                    }
                }

                browser.storage.local.set({ dailyStatistics: dailyStatistics });
            }
        });

        if (blockedWebsite) {
            blockedWebsite.totalTime += 1;
            storeData(blockedWebsite.website, blockedWebsite.totalTime);
            if (blockedWebsite.totalTime >= blockedWebsite.timeAllowed[dayOfTheWeek]) {
                clearInterval(activeBlockTimer!);
                redirectToUrl(blockedWebsite.redirectUrl, tab.id!, blockedWebsite.website, "Time limit reached on " + currentUrl);
                return;
            }

            // Update all relevant group budgets
            if (groupBudgets && groupBudgets.length > 0 && groupBudgetIndices && groupBudgetIndices.length > 0) {
                // Increment all budgets first
                for (const groupBudget of groupBudgets) {
                    groupBudget.totalTime += 1;
                }
                
                // Store all updated group budgets with their indices
                storeGroupData(groupBudgets, groupBudgetIndices);
                
                // Then check if any need to redirect
                for (const groupBudget of groupBudgets) {
                    if (groupBudget.timeAllowed[dayOfTheWeek] === -1) continue;
                    
                    if (groupBudget.totalTime >= groupBudget.timeAllowed[dayOfTheWeek]) {
                        clearInterval(activeBlockTimer!);
                        redirectToUrl(groupBudget.redirectUrl, tab.id!, "Group Budget", "Time limit reached on Group Budget (" + currentUrl + ")");
                        return;
                    }
                }
            }
            
            // Show badge for the most restrictive time
            const badgeTime = getMostRestrictiveBadgeTime(blockedWebsite, groupBudgets, dayOfTheWeek);
            setBadge(badgeTime === -1 ? "" : timeDisplayFormatBadge(badgeTime));
            
        } else if (groupBudgets && groupBudgets.length > 0 && groupBudgetIndices && groupBudgetIndices.length > 0) {
            // Only group budgets, no blocked website
            // Increment all budgets first
            for (const groupBudget of groupBudgets) {
                groupBudget.totalTime += 1;
            }
            
            // Store the updated times before redirecting
            storeGroupData(groupBudgets, groupBudgetIndices);
            
            // Then check if any need to redirect
            for (const groupBudget of groupBudgets) {
                if (groupBudget.timeAllowed[dayOfTheWeek] === -1) continue;
                
                if (groupBudget.totalTime >= groupBudget.timeAllowed[dayOfTheWeek]) {
                    clearInterval(activeBlockTimer!);
                    redirectToUrl(groupBudget.redirectUrl, tab.id!, "Group Budget", "Time limit reached on Group Budget (" + currentUrl + ")");
                    return;
                }
            }
            
            // Show badge for the most restrictive time
            const badgeTime = getMostRestrictiveBadgeTime(null, groupBudgets, dayOfTheWeek);
            setBadge(badgeTime === -1 ? "" : timeDisplayFormatBadge(badgeTime));
        }

        // Sync time data to backend every 30 seconds
        if (Date.now() - lastTimeSyncTime >= TIME_SYNC_INTERVAL) {
            syncCurrentTime();
        }
    }

    const checkScheduledBlock = (scheduledBlockRanges: Array<{ start: number; end: number, days: boolean[] }>, redirectUrl: string, tab: chrome.tabs.Tab, globalBudget: boolean) => {
        const currentTime = new Date();
        const dayOfTheWeek = (currentTime.getDay() + 6) % 7;
        const currentTimestamp = currentTime.getHours() * 60 + currentTime.getMinutes();

        // exclude the current day if it is not in the scheduled block range
        const filteredScheduledBlockRanges = scheduledBlockRanges.filter((range) => range.days[dayOfTheWeek] == true);

        filteredScheduledBlockRanges.some((range) => {
            if (isWithinScheduledBlock(range, currentTimestamp)) {
                const currentUrl = extractHostnameAndDomain(tab.url!)!;

                if (globalBudget) {
                    redirectToUrl(redirectUrl, tab.id!, currentUrl, "Scheduled block between " + scheduledBlockDisplay(range) + " on Group Budget (" + currentUrl + ")");
                } else {
                    redirectToUrl(redirectUrl, tab.id!, currentUrl, "Scheduled block between " + scheduledBlockDisplay(range) + " on " + currentUrl);
                }

                return true;
            }
            return false;
        });
    }

    function isWithinScheduledBlock(range: { start: number; end: number }, currentTimestamp: number) {
        // Handles crossing midnight by checking if end < start
        if (range.end < range.start) {
            return currentTimestamp >= range.start || currentTimestamp < range.end;
        }
        return currentTimestamp >= range.start && currentTimestamp < range.end;
    }

    const redirectToUrl = (url: string, tabId: number, website: string = "Others", redirectReason: string | null = null) => {
        browser.storage.local.get(['dailyStatistics'], async (data) => {
            if (data.dailyStatistics) {
                const dailyStatistics = data.dailyStatistics;
                dailyStatistics['blockedPerDay'][website] = dailyStatistics['blockedPerDay'][website] || 0;
                dailyStatistics['blockedPerDay'][website] += 1;
                
                await browser.storage.local.set({ dailyStatistics: dailyStatistics });

                // Sync the updated statistics
                syncTimeUpdate({ dailyStatistics });
            }
        });

        if (url == "") {
            if (redirectReason) {
                browser.tabs.update(tabId, { "url": browser.runtime.getURL(`/inspiration.html?reason=${redirectReason}`) });
            } else {
                browser.tabs.update(tabId, { "url": browser.runtime.getURL('/inspiration.html') });
            }
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
        updateHistoricalData();
    }


    const updateHistoricalData = () => {
        browser.storage.local.get(['historicalRestrictedTimePerDay', 'historicalBlockedPerDay', 'dailyStatistics'], (data) => {
          const dailyStatistics = data.dailyStatistics;
          const historicalRestrictedTimePerDay = data.historicalRestrictedTimePerDay;
          const historicalBlockedPerDay = data.historicalBlockedPerDay;
      
          historicalBlockedPerDay[dailyStatistics.day] = dailyStatistics.blockedPerDay;
          historicalRestrictedTimePerDay[dailyStatistics.day] = dailyStatistics.restrictedTimePerDay;
      
          dailyStatistics.blockedPerDay = {};
          dailyStatistics.restrictedTimePerDay = {};
          dailyStatistics.day = new Date().toLocaleDateString('en-CA').slice(0, 10);
          browser.storage.local.set({ dailyStatistics: dailyStatistics, historicalBlockedPerDay: historicalBlockedPerDay, historicalRestrictedTimePerDay: historicalRestrictedTimePerDay });
        });
      }


    const storeData = (websiteName: string, totalTime: number) => {
        browser.storage.local.get(['blockedWebsitesList'], (data) => {
            if (!data.blockedWebsitesList || typeof data.blockedWebsitesList !== 'object') return;
            let blockedWebsitesList = data.blockedWebsitesList

            blockedWebsitesList[websiteName].totalTime = totalTime;

            browser.storage.local.set({ blockedWebsitesList: blockedWebsitesList });
        });
    }

    const storeGroupData = (groupBudgets: GlobalTimeBudget[], groupBudgetIndices: number[]) => {
        browser.storage.local.get(['groupTimeBudgets'], (data) => {
            if (!data.groupTimeBudgets || !Array.isArray(data.groupTimeBudgets)) return;

            // Reconstruct the full array from storage
            let allGroupBudgets = data.groupTimeBudgets.map((b: any) => GlobalTimeBudget.fromJSON(b));

            // Update the budgets at the specified indices
            for (let i = 0; i < groupBudgets.length; i++) {
                const budgetIndex = groupBudgetIndices[i];
                if (budgetIndex >= 0 && budgetIndex < allGroupBudgets.length) {
                    allGroupBudgets[budgetIndex].totalTime = groupBudgets[i].totalTime;
                }
            }

            browser.storage.local.set({ 
                groupTimeBudgets: allGroupBudgets.map(b => b.toJSON()) 
            });
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