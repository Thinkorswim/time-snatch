const BASE_URL = "https://api.groundedmomentum.com";

// Pulled-data freshness throttle (1 minute). Pushes happen on every change.
const PULL_THROTTLE = 1 * 60 * 1000;

export type SyncStatus = "idle" | "syncing" | "success" | "error";
type SyncStatusListener = (status: SyncStatus) => void;

let currentSyncStatus: SyncStatus = "idle";
const syncStatusListeners: Set<SyncStatusListener> = new Set();

export const getSyncStatus = (): SyncStatus => currentSyncStatus;

export const subscribeSyncStatus = (listener: SyncStatusListener): (() => void) => {
  syncStatusListeners.add(listener);
  return () => {
    syncStatusListeners.delete(listener);
  };
};

const setSyncStatus = (status: SyncStatus): void => {
  currentSyncStatus = status;
  syncStatusListeners.forEach((l) => l(status));
};

// Types

export type BlockedWebsiteRecord = {
  website: string; // also the row id (composite PK with userId)
  timeAllowed: Record<string, number>;
  blockIncognito: boolean;
  variableSchedule: boolean;
  redirectUrl: string;
  scheduledBlockRanges: Array<{ start: number; end: number; days: boolean[] }>;
  allowedPaths: string[];
  updatedAt: string; // ISO8601 — full-row LWW
  deletedAt: string | null;
  syncedAt: string | null; // null => unpushed
};

export type GroupBudgetRecord = {
  id: string; // UUID
  name: string;
  websites: string[];
  timeAllowed: Record<string, number>;
  blockIncognito: boolean;
  variableSchedule: boolean;
  redirectUrl: string;
  scheduledBlockRanges: Array<{ start: number; end: number; days: boolean[] }>;
  updatedAt: string;
  deletedAt: string | null;
  syncedAt: string | null;
};

export type QuoteRecord = {
  id: string; // UUID
  quote: string;
  author: string;
  createdAt: string;
  deletedAt: string | null;
  syncedAt: string | null;
};

export type CounterKind =
  | "website_time"
  | "group_time"
  | "blocked_count"
  | "restricted_time";

export type CounterRecord = {
  deviceId: string;
  day: string; // YYYY-MM-DD
  kind: CounterKind;
  target: string; // website hostname OR group budget id
  value: number;
  syncedAt: string | null; // null => this device has unpushed updates
};

export const SETTINGS_EPOCH = "1970-01-01T00:00:00.000Z";

// HTTP helper

const apiFetch = (path: string, authToken: string, opts: RequestInit = {}): Promise<Response> =>
  fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      ...(opts.headers ?? {}),
    },
  });

// DeviceId

export const getDeviceId = async (): Promise<string> => {
  const result = (await browser.storage.local.get("deviceId")) as { deviceId?: string };
  if (result.deviceId) return result.deviceId;
  const id = crypto.randomUUID();
  await browser.storage.local.set({ deviceId: id });
  return id;
};

// Blocked websites

export const syncBlockedWebsites = async (authToken: string): Promise<void> => {
  const { blockedWebsites = [] } = (await browser.storage.local.get("blockedWebsites")) as {
    blockedWebsites?: BlockedWebsiteRecord[];
  };
  const unsynced = blockedWebsites.filter((w) => w.syncedAt === null);

  if (unsynced.length > 0) {
    const pushRes = await apiFetch("/api/timesnatch/blocked-websites", authToken, {
      method: "POST",
      body: JSON.stringify({
        items: unsynced.map((w) => ({
          website: w.website,
          timeAllowed: w.timeAllowed,
          blockIncognito: w.blockIncognito,
          variableSchedule: w.variableSchedule,
          redirectUrl: w.redirectUrl,
          scheduledBlockRanges: w.scheduledBlockRanges,
          allowedPaths: w.allowedPaths,
          updatedAt: w.updatedAt,
          deletedAt: w.deletedAt,
          schemaVersion: 1,
        })),
      }),
    });

    if (pushRes.ok) {
      const now = new Date().toISOString();
      const pushedKeys = new Set(unsynced.map((u) => u.website));
      const { blockedWebsites: fresh = [] } = (await browser.storage.local.get(
        "blockedWebsites"
      )) as { blockedWebsites?: BlockedWebsiteRecord[] };
      await browser.storage.local.set({
        blockedWebsites: fresh.map((w) =>
          pushedKeys.has(w.website) ? { ...w, syncedAt: now } : w
        ),
      });
    }
  }

  const { blockedWebsitesSyncCursor } = (await browser.storage.local.get(
    "blockedWebsitesSyncCursor"
  )) as { blockedWebsitesSyncCursor?: string | null };
  const pullUrl = blockedWebsitesSyncCursor
    ? `/api/timesnatch/blocked-websites?since=${encodeURIComponent(blockedWebsitesSyncCursor)}`
    : "/api/timesnatch/blocked-websites";

  const pullRes = await apiFetch(pullUrl, authToken);
  if (!pullRes.ok) return;

  const { items, cursor } = (await pullRes.json()) as {
    items: Array<Omit<BlockedWebsiteRecord, "syncedAt">>;
    cursor: string;
  };

  const { blockedWebsites: currentLocal = [] } = (await browser.storage.local.get(
    "blockedWebsites"
  )) as { blockedWebsites?: BlockedWebsiteRecord[] };
  const byKey = new Map<string, BlockedWebsiteRecord>(
    currentLocal.map((w) => [w.website, w])
  );
  const now = new Date().toISOString();

  for (const item of items) {
    const existing = byKey.get(item.website);
    if (!existing) {
      byKey.set(item.website, { ...item, syncedAt: now });
      continue;
    }
    // Skip stale incoming row unless it's a tombstone we don't yet have.
    if (existing.updatedAt > item.updatedAt && !item.deletedAt) continue;
    byKey.set(item.website, { ...item, syncedAt: now });
  }

  await browser.storage.local.set({
    blockedWebsites: Array.from(byKey.values()),
    blockedWebsitesSyncCursor: cursor,
  });
};

// Group budgets

export const syncGroupBudgets = async (authToken: string): Promise<void> => {
  const { groupBudgets = [] } = (await browser.storage.local.get("groupBudgets")) as {
    groupBudgets?: GroupBudgetRecord[];
  };
  const unsynced = groupBudgets.filter((g) => g.syncedAt === null);

  if (unsynced.length > 0) {
    const pushRes = await apiFetch("/api/timesnatch/group-budgets", authToken, {
      method: "POST",
      body: JSON.stringify({
        items: unsynced.map((g) => ({
          id: g.id,
          name: g.name,
          websites: g.websites,
          timeAllowed: g.timeAllowed,
          blockIncognito: g.blockIncognito,
          variableSchedule: g.variableSchedule,
          redirectUrl: g.redirectUrl,
          scheduledBlockRanges: g.scheduledBlockRanges,
          updatedAt: g.updatedAt,
          deletedAt: g.deletedAt,
          schemaVersion: 1,
        })),
      }),
    });

    if (pushRes.ok) {
      const now = new Date().toISOString();
      const pushedIds = new Set(unsynced.map((u) => u.id));
      const { groupBudgets: fresh = [] } = (await browser.storage.local.get(
        "groupBudgets"
      )) as { groupBudgets?: GroupBudgetRecord[] };
      await browser.storage.local.set({
        groupBudgets: fresh.map((g) => (pushedIds.has(g.id) ? { ...g, syncedAt: now } : g)),
      });
    }
  }

  const { groupBudgetsSyncCursor } = (await browser.storage.local.get(
    "groupBudgetsSyncCursor"
  )) as { groupBudgetsSyncCursor?: string | null };
  const pullUrl = groupBudgetsSyncCursor
    ? `/api/timesnatch/group-budgets?since=${encodeURIComponent(groupBudgetsSyncCursor)}`
    : "/api/timesnatch/group-budgets";

  const pullRes = await apiFetch(pullUrl, authToken);
  if (!pullRes.ok) return;

  const { items, cursor } = (await pullRes.json()) as {
    items: Array<Omit<GroupBudgetRecord, "syncedAt">>;
    cursor: string;
  };

  const { groupBudgets: currentLocal = [] } = (await browser.storage.local.get(
    "groupBudgets"
  )) as { groupBudgets?: GroupBudgetRecord[] };
  const byId = new Map<string, GroupBudgetRecord>(currentLocal.map((g) => [g.id, g]));
  const now = new Date().toISOString();

  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, { ...item, syncedAt: now });
      continue;
    }
    if (existing.updatedAt > item.updatedAt && !item.deletedAt) continue;
    byId.set(item.id, { ...item, syncedAt: now });
  }

  await browser.storage.local.set({
    groupBudgets: Array.from(byId.values()),
    groupBudgetsSyncCursor: cursor,
  });
};

// Quotes

export const syncQuotes = async (authToken: string): Promise<void> => {
  const { quotes = [] } = (await browser.storage.local.get("quotes")) as {
    quotes?: QuoteRecord[];
  };
  const unsynced = quotes.filter((q) => q.syncedAt === null);

  if (unsynced.length > 0) {
    const pushRes = await apiFetch("/api/timesnatch/quotes", authToken, {
      method: "POST",
      body: JSON.stringify({
        items: unsynced.map((q) => ({
          id: q.id,
          quote: q.quote,
          author: q.author,
          createdAt: q.createdAt,
          deletedAt: q.deletedAt,
          schemaVersion: 1,
        })),
      }),
    });

    if (pushRes.ok) {
      const now = new Date().toISOString();
      const pushedIds = new Set(unsynced.map((u) => u.id));
      const { quotes: fresh = [] } = (await browser.storage.local.get("quotes")) as {
        quotes?: QuoteRecord[];
      };
      await browser.storage.local.set({
        quotes: fresh.map((q) => (pushedIds.has(q.id) ? { ...q, syncedAt: now } : q)),
      });
    }
  }

  const { quotesSyncCursor } = (await browser.storage.local.get("quotesSyncCursor")) as {
    quotesSyncCursor?: string | null;
  };
  const pullUrl = quotesSyncCursor
    ? `/api/timesnatch/quotes?since=${encodeURIComponent(quotesSyncCursor)}`
    : "/api/timesnatch/quotes";

  const pullRes = await apiFetch(pullUrl, authToken);
  if (!pullRes.ok) return;

  const { items, cursor } = (await pullRes.json()) as {
    items: Array<Omit<QuoteRecord, "syncedAt">>;
    cursor: string;
  };

  const { quotes: currentLocal = [] } = (await browser.storage.local.get("quotes")) as {
    quotes?: QuoteRecord[];
  };
  const byId = new Map<string, QuoteRecord>(currentLocal.map((q) => [q.id, q]));
  const now = new Date().toISOString();

  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, { ...item, syncedAt: now });
    } else if (item.deletedAt && !existing.deletedAt) {
      byId.set(item.id, { ...existing, deletedAt: item.deletedAt, syncedAt: now });
    }
  }

  await browser.storage.local.set({
    quotes: Array.from(byId.values()),
    quotesSyncCursor: cursor,
  });
};

// Settings

const SETTING_FIELDS = ["password", "whiteListPathsEnabled"] as const;

export const syncSettings = async (authToken: string): Promise<void> => {
  const { settings: localRaw } = (await browser.storage.local.get("settings")) as {
    settings?: Record<string, any>;
  };
  const local = localRaw ?? {};

  const getRes = await apiFetch("/api/timesnatch/settings", authToken);
  if (!getRes.ok) return;

  const { settings: server } = (await getRes.json()) as {
    settings: Record<string, any> | null;
  };

  const pushPayload: Record<string, any> = { schemaVersion: 1 };
  const localUpdates: Record<string, any> = {};

  for (const field of SETTING_FIELDS) {
    const tsField = `${field}UpdatedAt`;
    const localValue = local[field];
    const localTs: string | undefined = local[tsField];
    const serverValue = server ? server[field] : undefined;
    const serverTs: string | undefined = server ? server[tsField] : undefined;

    if (localValue === undefined && serverValue !== undefined && serverTs) {
      localUpdates[field] = serverValue;
      localUpdates[tsField] = serverTs;
      continue;
    }

    if (localValue === undefined) continue;

    const effectiveLocalTs = localTs ?? SETTINGS_EPOCH;
    if (!serverTs || effectiveLocalTs >= serverTs) {
      pushPayload[field] = localValue;
      pushPayload[tsField] = effectiveLocalTs;
    } else {
      localUpdates[field] = serverValue;
      localUpdates[tsField] = serverTs;
    }
  }

  if (Object.keys(pushPayload).length > 1) {
    await apiFetch("/api/timesnatch/settings", authToken, {
      method: "PUT",
      body: JSON.stringify(pushPayload),
    });
  }

  if (Object.keys(localUpdates).length > 0) {
    const merged = { ...local, ...localUpdates };
    await browser.storage.local.set({ settings: merged });
  }
};

// Counters

const counterKey = (c: { deviceId: string; day: string; kind: string; target: string }): string =>
  `${c.deviceId}::${c.day}::${c.kind}::${c.target}`;

export const syncCounters = async (authToken: string): Promise<void> => {
  const { counters = [] } = (await browser.storage.local.get("counters")) as {
    counters?: CounterRecord[];
  };
  const unsynced = counters.filter((c) => c.syncedAt === null);

  if (unsynced.length > 0) {
    const pushRes = await apiFetch("/api/timesnatch/counters", authToken, {
      method: "POST",
      body: JSON.stringify({
        items: unsynced.map((c) => ({
          deviceId: c.deviceId,
          day: c.day,
          kind: c.kind,
          target: c.target,
          value: c.value,
        })),
      }),
    });

    if (pushRes.ok) {
      const now = new Date().toISOString();
      const pushedKeys = new Set(unsynced.map(counterKey));
      const { counters: fresh = [] } = (await browser.storage.local.get("counters")) as {
        counters?: CounterRecord[];
      };
      await browser.storage.local.set({
        counters: fresh.map((c) =>
          pushedKeys.has(counterKey(c)) ? { ...c, syncedAt: now } : c
        ),
      });
    }
  }

  const { countersSyncCursor } = (await browser.storage.local.get("countersSyncCursor")) as {
    countersSyncCursor?: string | null;
  };
  const pullUrl = countersSyncCursor
    ? `/api/timesnatch/counters?since=${encodeURIComponent(countersSyncCursor)}`
    : "/api/timesnatch/counters";

  const pullRes = await apiFetch(pullUrl, authToken);
  if (!pullRes.ok) return;

  const { items, cursor } = (await pullRes.json()) as {
    items: Array<{ deviceId: string; day: string; kind: CounterKind; target: string; value: number }>;
    cursor: string;
  };

  const { counters: currentLocal = [] } = (await browser.storage.local.get("counters")) as {
    counters?: CounterRecord[];
  };
  const ourDeviceId = await getDeviceId();

  const byKey = new Map<string, CounterRecord>(currentLocal.map((c) => [counterKey(c), c]));
  const now = new Date().toISOString();

  for (const item of items) {
    const key = counterKey(item);
    const existing = byKey.get(key);

    if (existing && item.deviceId === ourDeviceId && existing.syncedAt === null) continue;
    byKey.set(key, {
      deviceId: item.deviceId,
      day: item.day,
      kind: item.kind,
      target: item.target,
      value: item.value,
      syncedAt: now,
    });
  }

  await browser.storage.local.set({
    counters: Array.from(byKey.values()),
    countersSyncCursor: cursor,
  });
};

// Orchestration

let pending: Promise<void> | null = null;

export const syncAll = async (authToken: string): Promise<void> => {
  if (!authToken) return;
  if (pending) return pending;

  setSyncStatus("syncing");

  pending = (async () => {
    try {
      await syncSettings(authToken);
      await syncBlockedWebsites(authToken);
      await syncGroupBudgets(authToken);
      await syncQuotes(authToken);
      await syncCounters(authToken);
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (err) {
      console.error("syncAll error:", err);
      setSyncStatus("error");
    } finally {
      pending = null;
    }
  })();

  return pending;
};

// Background wrappers

const getProAuthToken = async (): Promise<string | null> => {
  try {
    const data = (await browser.storage.local.get("user")) as {
      user?: { authToken?: string; extensionsPlus?: boolean };
    };
    if (data.user?.extensionsPlus && data.user?.authToken) return data.user.authToken;
    return null;
  } catch {
    return null;
  }
};

const bgSync = async (fn: (token: string) => Promise<void>): Promise<void> => {
  const token = await getProAuthToken();
  if (!token) return;
  setSyncStatus("syncing");
  try {
    await fn(token);
    setSyncStatus("success");
    setTimeout(() => setSyncStatus("idle"), 2000);
  } catch (err) {
    console.error("bgSync error:", err);
    setSyncStatus("error");
  }
};

export const syncBlockedWebsitesBg = (): Promise<void> => bgSync(syncBlockedWebsites);
export const syncGroupBudgetsBg = (): Promise<void> => bgSync(syncGroupBudgets);
export const syncQuotesBg = (): Promise<void> => bgSync(syncQuotes);
export const syncSettingsBg = (): Promise<void> => bgSync(syncSettings);
export const syncCountersBg = (): Promise<void> => bgSync(syncCounters);


export const syncIfNeeded = async (): Promise<boolean> => {
  const token = await getProAuthToken();
  if (!token) return false;

  const data = (await browser.storage.local.get("lastPullTime")) as { lastPullTime?: number };
  const last = data.lastPullTime || 0;
  const now = Date.now();
  if (now - last < PULL_THROTTLE) return false;

  try {
    await syncBlockedWebsites(token);
    await syncGroupBudgets(token);
    await syncCounters(token);
    await browser.storage.local.set({ lastPullTime: now });
    return true;
  } catch (err) {
    console.error("syncIfNeeded error:", err);
    return false;
  }
};
