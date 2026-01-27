const BASE_URL = "https://api.groundedmomentum.com";

// Sync interval for website data (5 minutes in milliseconds)
const WEBSITE_SYNC_INTERVAL = 5 * 60 * 1000;

// Sync status management
export type SyncStatus = "idle" | "syncing" | "success" | "error";
type SyncStatusListener = (status: SyncStatus) => void;

let currentSyncStatus: SyncStatus = "idle";
const syncStatusListeners: Set<SyncStatusListener> = new Set();

export const getSyncStatus = (): SyncStatus => currentSyncStatus;

export const subscribeSyncStatus = (listener: SyncStatusListener): (() => void) => {
  syncStatusListeners.add(listener);
  return () => syncStatusListeners.delete(listener);
};

const setSyncStatus = (status: SyncStatus): void => {
  currentSyncStatus = status;
  syncStatusListeners.forEach((listener) => listener(status));
};

// Storage keys and their corresponding backend field names
interface SyncFieldMapping {
  localKey: string;
  backendKey: string;
  transform?: {
    toBackend: (localData: any) => any;
    toLocal: (backendData: any) => any;
  };
}

// Helper: Convert object { website: value } to array [{ website, value }]
const statsObjectToArray = (obj: Record<string, number>): Array<{ website: string; value: number }> => {
  if (!obj) return [];
  return Object.entries(obj).map(([website, value]) => ({ website, value }));
};

// Helper: Convert array [{ website, value }] to object { website: value }
const statsArrayToObject = (arr: Array<{ website: string; value: number }>): Record<string, number> => {
  if (!arr || !Array.isArray(arr)) return {};
  const result: Record<string, number> = {};
  arr.forEach((item) => {
    if (item?.website) result[item.website] = item.value;
  });
  return result;
};

// Helper: Convert local historical { date: { website: value } } to backend [{ date, data: [{ website, value }] }]
const historicalToBackend = (obj: Record<string, Record<string, number>> | null): Array<{ date: string; data: Array<{ website: string; value: number }> }> => {
  if (!obj || Array.isArray(obj)) return [];
  return Object.entries(obj).map(([date, data]) => ({ 
    date, 
    data: statsObjectToArray(data) 
  }));
};

// Helper: Convert backend [{ date, data: [{ website, value }] }] to local { date: { website: value } }
const historicalToLocal = (arr: Array<{ date: string; data: Array<{ website: string; value: number }> }> | null): Record<string, Record<string, number>> => {
  if (!arr || !Array.isArray(arr)) return {};
  const result: Record<string, Record<string, number>> = {};
  arr.forEach((item) => {
    if (item.date && item.data !== undefined) {
      result[item.date] = statsArrayToObject(item.data);
    }
  });
  return result;
};

// Helper: Merge two historical data objects (date -> website -> value)
// Later values (localData) take precedence over earlier values (backendData)
const mergeHistoricalData = (
  backendData: Record<string, Record<string, number>>,
  localData: Record<string, Record<string, number>>
): Record<string, Record<string, number>> => {
  const merged: Record<string, Record<string, number>> = { ...backendData };
  
  // For each date in local data
  Object.entries(localData).forEach(([date, websiteData]) => {
    if (!merged[date]) {
      // Date doesn't exist in backend, just add it
      merged[date] = { ...websiteData };
    } else {
      // Date exists, merge website data
      merged[date] = { ...merged[date], ...websiteData };
    }
  });
  
  return merged;
};

// Helper: Merge two statistics objects (website -> value)
const mergeStatsObjects = (
  backendStats: Record<string, number>,
  localStats: Record<string, number>
): Record<string, number> => {
  return { ...backendStats, ...localStats };
};

const SYNC_FIELD_MAPPINGS: SyncFieldMapping[] = [
  {
    localKey: "blockedWebsitesList",
    backendKey: "blockedWebsites",
    transform: {
      // Local: object keyed by website, Backend: array
      toBackend: (obj: Record<string, any>) => (obj ? Object.values(obj) : []),
      toLocal: (arr: any[]) => {
        if (!arr) return {};
        const result: Record<string, any> = {};
        arr.forEach((item) => {
          if (item.website) result[item.website] = item;
        });
        return result;
      },
    },
  },
  {
    localKey: "groupTimeBudgets",
    backendKey: "groupTimeBudgets",
    transform: {
      // Local may have Set for websites, backend expects array
      toBackend: (arr: any[]) =>
        arr?.map((item) => ({
          ...item,
          websites: item.websites instanceof Set ? Array.from(item.websites) : item.websites,
        })) || [],
      toLocal: (arr: any[]) => arr || [],
    },
  },
  { localKey: "settings", backendKey: "settings" },
  { localKey: "quotes", backendKey: "quotes" },
  {
    localKey: "dailyStatistics",
    backendKey: "dailyStatistics",
    transform: {
      toBackend: (stats: any) => {
        if (!stats) return stats;
        return {
          ...stats,
          blockedPerDay: statsObjectToArray(stats.blockedPerDay || {}),
          restrictedTimePerDay: statsObjectToArray(stats.restrictedTimePerDay || {}),
        };
      },
      toLocal: (stats: any) => {
        if (!stats) return stats;
        return {
          ...stats,
          blockedPerDay: statsArrayToObject(stats.blockedPerDay || []),
          restrictedTimePerDay: statsArrayToObject(stats.restrictedTimePerDay || []),
        };
      },
    },
  },
  {
    localKey: "historicalRestrictedTimePerDay",
    backendKey: "historicalRestrictedTimePerDay",
    transform: { toBackend: historicalToBackend, toLocal: historicalToLocal },
  },
  {
    localKey: "historicalBlockedPerDay",
    backendKey: "historicalBlockedPerDay",
    transform: { toBackend: historicalToBackend, toLocal: historicalToLocal },
  },
];

// Fetch sync data from backend
const fetchSyncData = async (authToken: string): Promise<any | null> => {
  try {
    const response = await fetch(`${BASE_URL}/api/timesnatch`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 403) return null; // Not Pro
      throw new Error("Failed to fetch sync data");
    }

    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error("Error fetching sync data:", error);
    return null;
  }
};

// Push local data to backend
const pushSyncData = async (authToken: string, data: Record<string, any>): Promise<boolean> => {
  try {
    const response = await fetch(`${BASE_URL}/api/timesnatch`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error("Error pushing sync data:", error);
    return false;
  }
};

// Get all local data for syncing
const getLocalSyncData = async (): Promise<Record<string, any>> => {
  const keys = SYNC_FIELD_MAPPINGS.map((m) => m.localKey);
  const localData = await browser.storage.local.get(keys);

  const syncData: Record<string, any> = {};

  for (const mapping of SYNC_FIELD_MAPPINGS) {
    const localValue = localData[mapping.localKey];
    if (localValue !== undefined) {
      const transformedValue = mapping.transform
        ? mapping.transform.toBackend(localValue)
        : localValue;
      syncData[mapping.backendKey] = transformedValue;
    }
  }

  return syncData;
};

// Apply backend data to local storage
const applyBackendData = async (backendData: Record<string, any>): Promise<void> => {
  const localUpdates: Record<string, any> = {};

  for (const mapping of SYNC_FIELD_MAPPINGS) {
    const value = backendData[mapping.backendKey];
    if (value !== undefined) {
      localUpdates[mapping.localKey] = mapping.transform?.toLocal
        ? mapping.transform.toLocal(value)
        : value;
    }
  }

  await browser.storage.local.set(localUpdates);
};

// Helper to get auth token and check if user is Pro
const getAuthTokenAndCheckPro = async (): Promise<string | null> => {
  try {
    const data = await browser.storage.local.get(["user"]);
    if (data.user?.isPro && data.user?.authToken) {
      return data.user.authToken;
    }
    return null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

// Helper function to make sync API calls
const makeSyncRequest = async (
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: any,
  errorContext?: string
): Promise<void> => {
  const authToken = await getAuthTokenAndCheckPro();
  if (!authToken) return;

  setSyncStatus("syncing");

  try {
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);

    if (response.ok) {
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } else {
      setSyncStatus("error");
    }
  } catch (error) {
    console.error(errorContext || "Error syncing data:", error);
    setSyncStatus("error");
  }
};

// Main sync function - syncs all data with backend
// Always uses backend data if it exists, otherwise pushes local data
export const syncAll = async (authToken: string): Promise<void> => {
  setSyncStatus("syncing");

  try {
    const backendData = await fetchSyncData(authToken);

    if (backendData === null) {
      // No backend data - push local data
      const localData = await getLocalSyncData();
      const success = await pushSyncData(authToken, localData);
      if (success) {
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 2000);
      } else {
        setSyncStatus("error");
      }
    } else {
      // Backend has data - apply it locally
      await applyBackendData(backendData);
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }
  } catch (error) {
    console.error("Sync error:", error);
    setSyncStatus("error");
  }
};

// Sync only website data (blockedWebsites and groupTimeBudgets) - lightweight sync for popup
export const syncWebsites = async (authToken: string): Promise<void> => {
  try {
    const response = await fetch(`${BASE_URL}/api/timesnatch/websites`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 403) return; // Not Pro
      throw new Error("Failed to fetch website data");
    }

    const result = await response.json();
    if (result.success && result.data) {
      // Reuse existing mappings and transform functions
      const localUpdates: Record<string, any> = {};
      const websiteMappings = SYNC_FIELD_MAPPINGS.filter(m => 
        m.backendKey === 'blockedWebsites' || m.backendKey === 'groupTimeBudgets'
      );

      for (const mapping of websiteMappings) {
        const value = result.data[mapping.backendKey];
        if (value !== undefined) {
          localUpdates[mapping.localKey] = mapping.transform?.toLocal
            ? mapping.transform.toLocal(value)
            : value;
        }
      }

      await browser.storage.local.set(localUpdates);
    }
  } catch (error) {
    console.error("Error syncing website data:", error);
  }
};

// Sync website data if enough time has passed since last sync
// Used by background script before blocking checks
export const syncWebsitesIfNeeded = async (): Promise<void> => {
  try {
    // Check if user is Pro and has auth token
    const authToken = await getAuthTokenAndCheckPro();
    if (!authToken) return;

    // Check if enough time has passed since last sync
    const data = await browser.storage.local.get(["lastWebsiteSyncTime"]);
    const lastSyncTime = data.lastWebsiteSyncTime || 0;
    const now = Date.now();

    if (now - lastSyncTime < WEBSITE_SYNC_INTERVAL) {
      return; // Not enough time has passed
    }

    // Perform sync and update last sync time
    await syncWebsites(authToken);
    await browser.storage.local.set({ lastWebsiteSyncTime: now });
  } catch (error) {
    // On error, just continue with local data
    console.error("Error in syncWebsitesIfNeeded:", error);
  }
};

// Sync when adding a new blocked website
export const syncAddWebsite = async (websiteData: any): Promise<void> => {
  await makeSyncRequest("/api/timesnatch/blocked-website", "POST", websiteData, "Error syncing new website");
};

// Sync when updating a blocked website
export const syncUpdateWebsite = async (websiteData: any): Promise<void> => {
  await makeSyncRequest("/api/timesnatch/blocked-website", "PUT", websiteData, "Error syncing website update");
};

// Sync when deleting a blocked website
export const syncDeleteWebsite = async (website: string): Promise<void> => {
  await makeSyncRequest("/api/timesnatch/blocked-website", "DELETE", { website }, "Error syncing website deletion");
};

// Sync when adding a new group time budget
export const syncAddGroupBudget = async (budgetData: any): Promise<void> => {
  await makeSyncRequest("/api/timesnatch/group-budget", "POST", budgetData, "Error syncing new group budget");
};

// Sync when updating a group time budget
export const syncUpdateGroupBudget = async (index: number, budgetData: any): Promise<void> => {
  await makeSyncRequest(`/api/timesnatch/group-budget/${index}`, "PUT", budgetData, "Error syncing group budget update");
};

// Sync when deleting a group time budget
export const syncDeleteGroupBudget = async (index: number): Promise<void> => {
  await makeSyncRequest(`/api/timesnatch/group-budget/${index}`, "DELETE", undefined, "Error syncing group budget deletion");
};

// Sync when adding a new quote
export const syncAddQuote = async (quoteData: { author: string; quote: string }): Promise<void> => {
  await makeSyncRequest("/api/timesnatch/quote", "POST", quoteData, "Error syncing new quote");
};

// Sync when deleting a quote
export const syncDeleteQuote = async (index: number): Promise<void> => {
  await makeSyncRequest(`/api/timesnatch/quote/${index}`, "DELETE", undefined, "Error syncing quote deletion");
};

// Sync when updating settings
export const syncUpdateSettings = async (settingsData: any): Promise<void> => {
  await makeSyncRequest("/api/timesnatch/settings", "PUT", settingsData, "Error syncing settings update");
};

// Push all local data to backend (used on day reset)
// IMPORTANT: Fetches backend data first and merges with local to prevent data loss
export const syncPushAll = async (): Promise<void> => {
  const authToken = await getAuthTokenAndCheckPro();
  if (!authToken) return;

  try {
    // Fetch current backend data
    const backendData = await fetchSyncData(authToken);
    const localData = await getLocalSyncData();

    // If no backend data exists, just push local data
    if (!backendData) {
      await pushSyncData(authToken, localData);
      return;
    }

    // Merge critical data that could have updates from multiple devices
    const mergedData = { ...localData };

    // Merge historical data
    if (backendData.historicalRestrictedTimePerDay || localData.historicalRestrictedTimePerDay) {
      const backendHistoricalRestricted = historicalToLocal(backendData.historicalRestrictedTimePerDay || []);
      const localHistoricalRestricted = historicalToLocal(localData.historicalRestrictedTimePerDay || []);
      const mergedHistoricalRestricted = mergeHistoricalData(backendHistoricalRestricted, localHistoricalRestricted);
      mergedData.historicalRestrictedTimePerDay = historicalToBackend(mergedHistoricalRestricted);
    }

    if (backendData.historicalBlockedPerDay || localData.historicalBlockedPerDay) {
      const backendHistoricalBlocked = historicalToLocal(backendData.historicalBlockedPerDay || []);
      const localHistoricalBlocked = historicalToLocal(localData.historicalBlockedPerDay || []);
      const mergedHistoricalBlocked = mergeHistoricalData(backendHistoricalBlocked, localHistoricalBlocked);
      mergedData.historicalBlockedPerDay = historicalToBackend(mergedHistoricalBlocked);
    }

    // Merge daily statistics
    if (backendData.dailyStatistics && localData.dailyStatistics) {
      const backendBlockedPerDay = statsArrayToObject(backendData.dailyStatistics.blockedPerDay || []);
      const localBlockedPerDay = statsArrayToObject(localData.dailyStatistics.blockedPerDay || []);
      const mergedBlockedPerDay = mergeStatsObjects(backendBlockedPerDay, localBlockedPerDay);

      const backendRestrictedTimePerDay = statsArrayToObject(backendData.dailyStatistics.restrictedTimePerDay || []);
      const localRestrictedTimePerDay = statsArrayToObject(localData.dailyStatistics.restrictedTimePerDay || []);
      const mergedRestrictedTimePerDay = mergeStatsObjects(backendRestrictedTimePerDay, localRestrictedTimePerDay);

      mergedData.dailyStatistics = {
        ...localData.dailyStatistics,
        blockedPerDay: statsObjectToArray(mergedBlockedPerDay),
        restrictedTimePerDay: statsObjectToArray(mergedRestrictedTimePerDay),
      };
    }

    // Push merged data
    await pushSyncData(authToken, mergedData);
  } catch (error) {
    console.error("Error pushing all data:", error);
  }
};

// Time update sync interval (30 seconds in milliseconds)
export const TIME_SYNC_INTERVAL = 30 * 1000;

// Sync time data to backend - silent sync without status updates
export const syncTimeUpdate = async (data: {
  website?: string;
  blockedWebsite?: { totalTime: number; lastAccessedDate: string };
  groupBudgetIndex?: number;
  groupBudget?: { totalTime: number; lastAccessedDate: string };
  dailyStatistics?: { blockedPerDay: Record<string, number>; restrictedTimePerDay: Record<string, number>; day: string };
}): Promise<void> => {
  const authToken = await getAuthTokenAndCheckPro();
  if (!authToken) return;

  try {
    // Convert dailyStatistics to backend format (arrays)
    const payload: any = { ...data };
    if (payload.dailyStatistics) {
      payload.dailyStatistics = {
        ...payload.dailyStatistics,
        blockedPerDay: statsObjectToArray(payload.dailyStatistics.blockedPerDay),
        restrictedTimePerDay: statsObjectToArray(payload.dailyStatistics.restrictedTimePerDay),
      };
    }

    await fetch(`${BASE_URL}/api/timesnatch/time-update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Error syncing time update:", error);
  }
};
