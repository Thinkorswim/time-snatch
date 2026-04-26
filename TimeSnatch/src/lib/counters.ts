import type { CounterRecord, CounterKind } from "@/lib/sync";
import { getDeviceId, syncCountersBg } from "@/lib/sync";

export const todayDateStr = (): string =>
  new Date().toLocaleDateString("en-CA").slice(0, 10);

const counterKey = (deviceId: string, day: string, kind: string, target: string): string =>
  `${deviceId}::${day}::${kind}::${target}`;


let writeLock: Promise<void> = Promise.resolve();

export const incrementCounter = (
  kind: CounterKind,
  target: string,
  delta: number = 1
): Promise<void> => {
  const next = writeLock.then(async () => {
    const deviceId = await getDeviceId();
    const day = todayDateStr();

    const { counters = [] } = (await browser.storage.local.get("counters")) as {
      counters?: CounterRecord[];
    };

    const key = counterKey(deviceId, day, kind, target);
    const idx = counters.findIndex(
      (c) => counterKey(c.deviceId, c.day, c.kind, c.target) === key
    );

    let updated: CounterRecord[];
    if (idx === -1) {
      updated = [
        ...counters,
        { deviceId, day, kind, target, value: delta, syncedAt: null },
      ];
    } else {
      const incremented = { ...counters[idx], value: counters[idx].value + delta, syncedAt: null };
      updated = counters.slice();
      updated[idx] = incremented;
    }

    await browser.storage.local.set({ counters: updated });
  });

  // Swallow errors in the chain so a single failure doesn't poison subsequent calls.
  writeLock = next.catch(() => {});
  return next;
};

// Sum across all deviceIds for (day, kind, target). The "true total".
export const totalForTarget = (
  counters: CounterRecord[],
  day: string,
  kind: CounterKind,
  target: string
): number => {
  let total = 0;
  for (const c of counters) {
    if (c.day === day && c.kind === kind && c.target === target) {
      total += c.value;
    }
  }
  return total;
};

// Sum across all deviceIds for (day, kind), grouped by target. Used by charts
// and the Options stats view.
export const totalsForKind = (
  counters: CounterRecord[],
  day: string,
  kind: CounterKind
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const c of counters) {
    if (c.day === day && c.kind === kind) {
      out[c.target] = (out[c.target] || 0) + c.value;
    }
  }
  return out;
};

// Sum across all deviceIds for a kind, grouped by day. Each day -> { target -> value }.
export const totalsByDayForKind = (
  counters: CounterRecord[],
  kind: CounterKind
): Record<string, Record<string, number>> => {
  const out: Record<string, Record<string, number>> = {};
  for (const c of counters) {
    if (c.kind !== kind) continue;
    if (!out[c.day]) out[c.day] = {};
    out[c.day][c.target] = (out[c.day][c.target] || 0) + c.value;
  }
  return out;
};

// Read-and-aggregate convenience for the background tick: returns the current
// total for (today, kind, target) including this device's freshest local value.
export const totalForTargetToday = async (
  kind: CounterKind,
  target: string
): Promise<number> => {
  const { counters = [] } = (await browser.storage.local.get("counters")) as {
    counters?: CounterRecord[];
  };
  return totalForTarget(counters, todayDateStr(), kind, target);
};

// Trigger a background sync soon. Cheap to call repeatedly (the bg wrapper
// dedupes via the in-flight promise).
export const flushCounters = (): void => {
  syncCountersBg();
};
