import type {
  BlockedWebsiteRecord,
  GroupBudgetRecord,
  QuoteRecord,
  CounterRecord,
} from "@/lib/sync";
import { SETTINGS_EPOCH, getDeviceId } from "@/lib/sync";
import { defaultQuotes } from "@/entrypoints/inspiration/quotes";

const LOCAL_SCHEMA_VERSION = 2;

const todayDateStr = (): string =>
  new Date().toLocaleDateString("en-CA").slice(0, 10);

// One-shot in-place migration from the old TimeSnatch storage shape to the new
// per-record / per-counter shape. Idempotent via `localSchemaVersion`.
export const runLocalMigration = async (): Promise<void> => {
  const { localSchemaVersion } = (await browser.storage.local.get("localSchemaVersion")) as {
    localSchemaVersion?: number;
  };
  if ((localSchemaVersion ?? 0) >= LOCAL_SCHEMA_VERSION) return;

  const data = (await browser.storage.local.get([
    "blockedWebsitesList",
    "groupTimeBudgets",
    "quotes",
    "settings",
    "dailyStatistics",
    "historicalRestrictedTimePerDay",
    "historicalBlockedPerDay",
  ])) as {
    blockedWebsitesList?: Record<string, any>;
    groupTimeBudgets?: any[];
    quotes?: Array<{ quote: string; author: string }>;
    settings?: Record<string, any>;
    dailyStatistics?: { day?: string; blockedPerDay?: Record<string, number>; restrictedTimePerDay?: Record<string, number> };
    historicalRestrictedTimePerDay?: Record<string, Record<string, number>>;
    historicalBlockedPerDay?: Record<string, Record<string, number>>;
  };

  const deviceId = await getDeviceId();
  const now = new Date().toISOString();
  const today = todayDateStr();

  // Blocked websites 
  const blockedWebsites: BlockedWebsiteRecord[] = [];
  const counters: CounterRecord[] = [];

  if (data.blockedWebsitesList && typeof data.blockedWebsitesList === "object") {
    for (const [website, raw] of Object.entries(data.blockedWebsitesList)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as any;
      blockedWebsites.push({
        website,
        timeAllowed: r.timeAllowed ?? {},
        blockIncognito: r.blockIncognito ?? true,
        variableSchedule: r.variableSchedule ?? false,
        redirectUrl: r.redirectUrl ?? "",
        scheduledBlockRanges: Array.isArray(r.scheduledBlockRanges) ? r.scheduledBlockRanges : [],
        allowedPaths: Array.isArray(r.allowedPaths) ? r.allowedPaths : [],
        updatedAt: now,
        deletedAt: null,
        syncedAt: null,
      });

      // Peel totalTime + lastAccessedDate into a counter row.
      const totalTime = Number(r.totalTime) || 0;
      const day = typeof r.lastAccessedDate === "string" && r.lastAccessedDate.length > 0
        ? r.lastAccessedDate
        : today;
      if (totalTime > 0) {
        counters.push({
          deviceId,
          day,
          kind: "website_time",
          target: website,
          value: totalTime,
          syncedAt: null,
        });
      }
    }
  }

  // Group budgets
  const groupBudgets: GroupBudgetRecord[] = [];
  if (Array.isArray(data.groupTimeBudgets)) {
    for (const g of data.groupTimeBudgets) {
      if (!g || typeof g !== "object") continue;
      const id = crypto.randomUUID();
      const websites: string[] = Array.isArray(g.websites) ? g.websites : [];
      groupBudgets.push({
        id,
        name: typeof g.name === "string" ? g.name : "",
        websites,
        timeAllowed: g.timeAllowed ?? {},
        blockIncognito: g.blockIncognito ?? true,
        variableSchedule: g.variableSchedule ?? false,
        redirectUrl: g.redirectUrl ?? "",
        scheduledBlockRanges: Array.isArray(g.scheduledBlockRanges) ? g.scheduledBlockRanges : [],
        updatedAt: now,
        deletedAt: null,
        syncedAt: null,
      });

      const totalTime = Number(g.totalTime) || 0;
      const day = typeof g.lastAccessedDate === "string" && g.lastAccessedDate.length > 0
        ? g.lastAccessedDate
        : today;
      if (totalTime > 0) {
        counters.push({
          deviceId,
          day,
          kind: "group_time",
          target: id,
          value: totalTime,
          syncedAt: null,
        });
      }
    }
  }

  // dailyStatistics into counters
  if (data.dailyStatistics && typeof data.dailyStatistics === "object") {
    const day = typeof data.dailyStatistics.day === "string" ? data.dailyStatistics.day : today;
    const blocked = data.dailyStatistics.blockedPerDay ?? {};
    for (const [target, value] of Object.entries(blocked)) {
      if (Number(value) > 0) {
        counters.push({ deviceId, day, kind: "blocked_count", target, value: Number(value), syncedAt: null });
      }
    }
    const restricted = data.dailyStatistics.restrictedTimePerDay ?? {};
    for (const [target, value] of Object.entries(restricted)) {
      if (Number(value) > 0) {
        counters.push({ deviceId, day, kind: "restricted_time", target, value: Number(value), syncedAt: null });
      }
    }
  }

  // historical*PerDay into counters
  if (data.historicalBlockedPerDay && typeof data.historicalBlockedPerDay === "object") {
    for (const [day, websites] of Object.entries(data.historicalBlockedPerDay)) {
      if (!websites || typeof websites !== "object") continue;
      for (const [target, value] of Object.entries(websites)) {
        if (Number(value) > 0) {
          counters.push({ deviceId, day, kind: "blocked_count", target, value: Number(value), syncedAt: null });
        }
      }
    }
  }

  if (data.historicalRestrictedTimePerDay && typeof data.historicalRestrictedTimePerDay === "object") {
    for (const [day, websites] of Object.entries(data.historicalRestrictedTimePerDay)) {
      if (!websites || typeof websites !== "object") continue;
      for (const [target, value] of Object.entries(websites)) {
        if (Number(value) > 0) {
          counters.push({ deviceId, day, kind: "restricted_time", target, value: Number(value), syncedAt: null });
        }
      }
    }
  }

  // Quotes
  const quotes: QuoteRecord[] = [];
  const seedQuotes = Array.isArray(data.quotes) && data.quotes.length > 0 ? data.quotes : defaultQuotes;
  for (const q of seedQuotes) {
    if (!q || typeof q !== "object") continue;
    const quote = typeof q.quote === "string" ? q.quote : "";
    const author = typeof q.author === "string" ? q.author : "";
    if (!quote.trim()) continue;
    quotes.push({
      id: crypto.randomUUID(),
      quote,
      author,
      createdAt: now,
      deletedAt: null,
      syncedAt: null,
    });
  }

  // Settings (add per-field UpdatedAt)
  const oldSettings = data.settings ?? {};
  const settings: Record<string, any> = {
    password: typeof oldSettings.password === "string" ? oldSettings.password : "",
    passwordUpdatedAt: SETTINGS_EPOCH,
    whiteListPathsEnabled: oldSettings.whiteListPathsEnabled === true,
    whiteListPathsEnabledUpdatedAt: SETTINGS_EPOCH,
  };

  // Commit 
  await browser.storage.local.set({
    blockedWebsites,
    groupBudgets,
    quotes,
    settings,
    counters,
    blockedWebsitesSyncCursor: null,
    groupBudgetsSyncCursor: null,
    quotesSyncCursor: null,
    countersSyncCursor: null,
    localSchemaVersion: LOCAL_SCHEMA_VERSION,
  });
};

export const seedFreshInstall = async (): Promise<void> => {
  const data = (await browser.storage.local.get([
    "deviceId",
    "blockedWebsites",
    "groupBudgets",
    "quotes",
    "settings",
    "counters",
  ])) as Record<string, any>;

  const updates: Record<string, any> = {};
  if (!data.deviceId) updates.deviceId = await getDeviceId();
  if (!Array.isArray(data.blockedWebsites)) updates.blockedWebsites = [];
  if (!Array.isArray(data.groupBudgets)) updates.groupBudgets = [];
  if (!Array.isArray(data.counters)) updates.counters = [];

  if (!Array.isArray(data.quotes)) {
    const now = new Date().toISOString();
    updates.quotes = defaultQuotes
      .filter((q) => q && typeof q.quote === "string" && q.quote.trim().length > 0)
      .map((q) => ({
        id: crypto.randomUUID(),
        quote: q.quote,
        author: typeof q.author === "string" ? q.author : "",
        createdAt: now,
        deletedAt: null,
        syncedAt: null,
      }));
  }

  if (!data.settings || typeof data.settings !== "object") {
    updates.settings = {
      password: "",
      passwordUpdatedAt: SETTINGS_EPOCH,
      whiteListPathsEnabled: false,
      whiteListPathsEnabledUpdatedAt: SETTINGS_EPOCH,
    };
  }

  if (Object.keys(updates).length > 0) {
    await browser.storage.local.set(updates);
  }
};
