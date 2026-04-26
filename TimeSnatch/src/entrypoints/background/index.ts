import { timeDisplayFormatBadge, extractHostnameAndDomain, extractPathnameAndParams, scheduledBlockDisplay } from "@/lib/utils";
import {
    syncIfNeeded,
    syncCountersBg,
    type BlockedWebsiteRecord,
    type GroupBudgetRecord,
    type CounterRecord,
} from "@/lib/sync";
import { incrementCounter, totalForTarget, todayDateStr } from "@/lib/counters";
import { runLocalMigration, seedFreshInstall } from "@/lib/migrate";

const COUNTER_FLUSH_INTERVAL = 30 * 1000;

export default defineBackground(() => {
    // Run the one-shot migration / fresh-install seed before anything else touches storage. Idempotent.
    runLocalMigration()
        .then(seedFreshInstall)
        .catch((err) => console.error('[TimeSnatch] storage init failed:', err));

    browser.runtime.onInstalled.addListener(async (object) => {
        if (object.reason === 'install') {
            browser.runtime.openOptionsPage();
        }
        await runLocalMigration().catch(() => {});
        await seedFreshInstall().catch(() => {});
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
        stopCurrentBlocking();
        port.onDisconnect.addListener(() => {
            browser.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].url) {
                    debounceCheckUrlBlockStatus(tabs[0]);
                }
            });
        });
    });

    // Periodic counter flush: every 30s while a block timer is running, push
    // this device's unsynced counter rows to the server.
    let lastCounterFlush = 0;
    const maybeFlushCounters = () => {
        const now = Date.now();
        if (now - lastCounterFlush >= COUNTER_FLUSH_INTERVAL) {
            lastCounterFlush = now;
            syncCountersBg().catch(() => {});
        }
    };

    const stopCurrentBlocking = () => {
        if (activeBlockTimer != null) {
            clearInterval(activeBlockTimer);
            activeBlockTimer = null;
            setBadge("");
            // Push counters one last time so partial seconds don't sit unsynced.
            syncCountersBg().catch(() => {});
        }
    };

    let debounceTimer: NodeJS.Timeout | null = null;

    const debounceCheckUrlBlockStatus = (tab: chrome.tabs.Tab) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { checkUrlBlockStatus(tab); }, 200);
    };

    const checkUrlBlockStatus = (tab: chrome.tabs.Tab) => {
        // Evaluate immediately using local data for zero latency
        evaluateUrlBlockStatus(tab);

        // Sync asynchronously. If there is new data, re-evaluate.
        syncIfNeeded().then((didSync) => {
            if (didSync) {
                evaluateUrlBlockStatus(tab);
            }
        }).catch(() => {});
    };

    const evaluateUrlBlockStatus = async (tab: chrome.tabs.Tab) => {
        const data = (await browser.storage.local.get(['blockedWebsites', 'groupBudgets', 'counters'])) as {
            blockedWebsites?: BlockedWebsiteRecord[];
            groupBudgets?: GroupBudgetRecord[];
            counters?: CounterRecord[];
        };

        const blockedWebsites = (data.blockedWebsites ?? []).filter((w) => !w.deletedAt);
        const groupBudgets = (data.groupBudgets ?? []).filter((g) => !g.deletedAt);
        const counters = data.counters ?? [];

        if (blockedWebsites.length === 0 && groupBudgets.length === 0) return;

        const today = todayDateStr();
        const currentTabUrl = extractHostnameAndDomain(tab.url!);
        if (!currentTabUrl) return;
        const currentTabPath = extractPathnameAndParams(tab.url!);

        // Day-of-week: Monday=0 ... Sunday=6 (matches existing `timeAllowed` keys).
        const dayOfTheWeek = (new Date().getDay() + 6) % 7;

        // Find the blocked-website record (if any).
        const currentBlockedWebsite = blockedWebsites.find((w) => w.website === currentTabUrl) ?? null;

        // Find all group budgets that contain this URL.
        const relevantGroupBudgets = groupBudgets.filter((g) => Array.isArray(g.websites) && g.websites.includes(currentTabUrl));

        const isUrlInBlockedList = currentBlockedWebsite != null;
        const isUrlInGroupBudgets = relevantGroupBudgets.length > 0;

        if (!isUrlInBlockedList && !isUrlInGroupBudgets) return;

        if (currentBlockedWebsite) {
            // Allowed paths shortcut.
            if (currentTabPath && currentBlockedWebsite.allowedPaths.includes(currentTabPath)) return;

            // -1 means "unlimited today" for this website.
            const websiteAllowed = currentBlockedWebsite.timeAllowed[String(dayOfTheWeek)];
            const websiteUnlimited = websiteAllowed === -1;

            // Incognito guard.
            if (currentBlockedWebsite.blockIncognito === false && tab.incognito === true) return;

            // Scheduled blocks override time limits.
            if (currentBlockedWebsite.scheduledBlockRanges.length > 0) {
                checkScheduledBlock(currentBlockedWebsite.scheduledBlockRanges, currentBlockedWebsite.redirectUrl, tab, false);
            }

            // True total = sum across all this user's devices for today.
            const websiteUsed = totalForTarget(counters, today, 'website_time', currentTabUrl);
            if (!websiteUnlimited && websiteUsed >= websiteAllowed) {
                redirectToUrl(currentBlockedWebsite.redirectUrl, tab.id!, currentTabUrl, "Time limit reached on " + currentTabUrl);
                return;
            }

            // Group budget checks.
            for (const groupBudget of relevantGroupBudgets) {
                const groupAllowed = groupBudget.timeAllowed[String(dayOfTheWeek)];
                if (groupAllowed === -1) continue;
                if (groupBudget.scheduledBlockRanges.length > 0) {
                    checkScheduledBlock(groupBudget.scheduledBlockRanges, groupBudget.redirectUrl, tab, true);
                }
                const groupUsed = totalForTarget(counters, today, 'group_time', groupBudget.id);
                if (groupUsed >= groupAllowed) {
                    redirectToUrl(groupBudget.redirectUrl, tab.id!, "Group Budget", "Time limit reached on Group Budget (" + currentTabUrl + ")");
                    return;
                }
            }

            if (activeBlockTimer == null) {
                activeBlockTimer = setInterval(() => updateTime(currentBlockedWebsite, relevantGroupBudgets, tab), 1000);
            }

            const badgeTime = getMostRestrictiveBadgeTime(currentBlockedWebsite, relevantGroupBudgets, dayOfTheWeek, counters, today);
            setBadge(badgeTime === -1 ? "" : timeDisplayFormatBadge(badgeTime));
        } else if (isUrlInGroupBudgets) {
            for (const groupBudget of relevantGroupBudgets) {
                const groupAllowed = groupBudget.timeAllowed[String(dayOfTheWeek)];
                if (groupAllowed === -1) continue;
                if (groupBudget.scheduledBlockRanges.length > 0) {
                    checkScheduledBlock(groupBudget.scheduledBlockRanges, groupBudget.redirectUrl, tab, true);
                }
                const groupUsed = totalForTarget(counters, today, 'group_time', groupBudget.id);
                if (groupUsed >= groupAllowed) {
                    redirectToUrl(groupBudget.redirectUrl, tab.id!, "Group Budget", "Time limit reached on Group Budget (" + currentTabUrl + ")");
                    return;
                }
            }

            if (activeBlockTimer == null) {
                activeBlockTimer = setInterval(() => updateTime(null, relevantGroupBudgets, tab), 1000);
            }

            const badgeTime = getMostRestrictiveBadgeTime(null, relevantGroupBudgets, dayOfTheWeek, counters, today);
            setBadge(badgeTime === -1 ? "" : timeDisplayFormatBadge(badgeTime));
        }
    };

    // Lowest time-remaining across the website + all group budgets. -1 = no limit.
    const getMostRestrictiveBadgeTime = (
        blockedWebsite: BlockedWebsiteRecord | null,
        groupBudgets: GroupBudgetRecord[],
        dayOfTheWeek: number,
        counters: CounterRecord[],
        today: string
    ): number => {
        let lowestRemaining = Infinity;

        if (blockedWebsite) {
            const allowed = blockedWebsite.timeAllowed[String(dayOfTheWeek)];
            if (allowed !== -1) {
                const used = totalForTarget(counters, today, 'website_time', blockedWebsite.website);
                lowestRemaining = Math.min(lowestRemaining, allowed - used);
            }
        }

        for (const g of groupBudgets) {
            const allowed = g.timeAllowed[String(dayOfTheWeek)];
            if (allowed === -1) continue;
            const used = totalForTarget(counters, today, 'group_time', g.id);
            lowestRemaining = Math.min(lowestRemaining, allowed - used);
        }

        return lowestRemaining === Infinity ? -1 : lowestRemaining;
    };

    const updateTime = async (
        blockedWebsite: BlockedWebsiteRecord | null,
        groupBudgets: GroupBudgetRecord[],
        tab: chrome.tabs.Tab
    ) => {
        const dayOfTheWeek = (new Date().getDay() + 6) % 7;
        const today = todayDateStr();
        const currentUrl = extractHostnameAndDomain(tab.url!);
        const target = blockedWebsite?.website || currentUrl || null;

        // Increment counters: this device's contribution.
        if (target) {
            incrementCounter('restricted_time', target).catch(() => {});
        }
        if (blockedWebsite) {
            incrementCounter('website_time', blockedWebsite.website).catch(() => {});
        }
        for (const g of groupBudgets) {
            incrementCounter('group_time', g.id).catch(() => {});
        }

        // Push to server periodically.
        maybeFlushCounters();

        // Re-read totals for the limit check and badge display.
        const { counters = [] } = (await browser.storage.local.get('counters')) as {
            counters?: CounterRecord[];
        };

        if (blockedWebsite) {
            const allowed = blockedWebsite.timeAllowed[String(dayOfTheWeek)];
            if (allowed !== -1) {
                const used = totalForTarget(counters, today, 'website_time', blockedWebsite.website);
                if (used >= allowed) {
                    if (activeBlockTimer) { clearInterval(activeBlockTimer); activeBlockTimer = null; }
                    redirectToUrl(blockedWebsite.redirectUrl, tab.id!, blockedWebsite.website, "Time limit reached on " + currentUrl);
                    return;
                }
            }
        }

        for (const g of groupBudgets) {
            const allowed = g.timeAllowed[String(dayOfTheWeek)];
            if (allowed === -1) continue;
            const used = totalForTarget(counters, today, 'group_time', g.id);
            if (used >= allowed) {
                if (activeBlockTimer) { clearInterval(activeBlockTimer); activeBlockTimer = null; }
                redirectToUrl(g.redirectUrl, tab.id!, "Group Budget", "Time limit reached on Group Budget (" + currentUrl + ")");
                return;
            }
        }

        const badgeTime = getMostRestrictiveBadgeTime(blockedWebsite, groupBudgets, dayOfTheWeek, counters, today);
        setBadge(badgeTime === -1 ? "" : timeDisplayFormatBadge(badgeTime));
    };

    const checkScheduledBlock = (
        scheduledBlockRanges: Array<{ start: number; end: number; days: boolean[] }>,
        redirectUrl: string,
        tab: chrome.tabs.Tab,
        isGroupBudget: boolean
    ) => {
        const currentTime = new Date();
        const dayOfTheWeek = (currentTime.getDay() + 6) % 7;
        const currentTimestamp = currentTime.getHours() * 60 + currentTime.getMinutes();

        const filtered = scheduledBlockRanges.filter((range) => range.days[dayOfTheWeek] === true);

        filtered.some((range) => {
            if (isWithinScheduledBlock(range, currentTimestamp)) {
                const currentUrl = extractHostnameAndDomain(tab.url!)!;
                if (isGroupBudget) {
                    redirectToUrl(redirectUrl, tab.id!, currentUrl, "Scheduled block between " + scheduledBlockDisplay(range) + " on Group Budget (" + currentUrl + ")");
                } else {
                    redirectToUrl(redirectUrl, tab.id!, currentUrl, "Scheduled block between " + scheduledBlockDisplay(range) + " on " + currentUrl);
                }
                return true;
            }
            return false;
        });
    };

    function isWithinScheduledBlock(range: { start: number; end: number }, currentTimestamp: number) {
        if (range.end < range.start) {
            return currentTimestamp >= range.start || currentTimestamp < range.end;
        }
        return currentTimestamp >= range.start && currentTimestamp < range.end;
    }

    const redirectToUrl = (url: string, tabId: number, website: string = "Others", redirectReason: string | null = null) => {
        incrementCounter('blocked_count', website)
            .then(() => syncCountersBg().catch(() => {}))
            .catch(() => {});

        if (url === "") {
            if (redirectReason) {
                browser.tabs.update(tabId, { url: browser.runtime.getURL(`/inspiration.html?reason=${redirectReason}`) });
            } else {
                browser.tabs.update(tabId, { url: browser.runtime.getURL('/inspiration.html') });
            }
        } else {
            if (url.includes("https://") || url.includes("http://")) {
                browser.tabs.update(tabId, { url });
            } else {
                browser.tabs.update(tabId, { url: 'https://' + url });
            }
        }
    };

    const setBadge = (text: string) => {
        if (import.meta.env.BROWSER === 'firefox') {
            browser.browserAction.setBadgeBackgroundColor({ color: "#ae0f0f" });
            browser.browserAction.setBadgeText({ text });
        } else {
            browser.action.setBadgeBackgroundColor({ color: "#ae0f0f" });
            browser.action.setBadgeText({ text });
        }
    };
});
