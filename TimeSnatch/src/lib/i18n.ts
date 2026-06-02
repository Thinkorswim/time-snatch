import { useEffect, useSyncExternalStore } from "react";
import { createI18n } from "@wxt-dev/i18n";
import type { GeneratedI18nStructure } from "../../.wxt/i18n/structure";

const wxtI18n = createI18n<GeneratedI18nStructure>();

export type LocaleCode =
  | "en"
  | "es"
  | "pt_BR"
  | "de"
  | "fr"
  | "it"
  | "ru"
  | "ja"
  | "tr"
  | "nl"
  | "pl"
  | "ko";

export const SUPPORTED_LOCALES: { code: LocaleCode; nativeName: string }[] = [
  { code: "en", nativeName: "English" },
  { code: "es", nativeName: "Español" },
  { code: "pt_BR", nativeName: "Português (Brasil)" },
  { code: "de", nativeName: "Deutsch" },
  { code: "fr", nativeName: "Français" },
  { code: "it", nativeName: "Italiano" },
  { code: "ru", nativeName: "Русский" },
  { code: "ja", nativeName: "日本語" },
  { code: "tr", nativeName: "Türkçe" },
  { code: "nl", nativeName: "Nederlands" },
  { code: "pl", nativeName: "Polski" },
  { code: "ko", nativeName: "한국어" },
];

const STORAGE_KEY = "userLocale";

type I18nKey = keyof GeneratedI18nStructure;

type OverrideEntry = { message: string };
type OverrideMap = Record<string, OverrideEntry>;

const overrideCache = new Map<LocaleCode, OverrideMap>();

let activeOverride: LocaleCode | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

async function loadOverride(locale: LocaleCode): Promise<OverrideMap> {
  const cached = overrideCache.get(locale);
  if (cached) return cached;
  const getURL = browser.runtime.getURL as (path: string) => string;
  const res = await fetch(getURL(`/_locales/${locale}/messages.json`));
  const json = (await res.json()) as OverrideMap;
  overrideCache.set(locale, json);
  return json;
}

async function applyStoredLocale() {
  const { [STORAGE_KEY]: stored } = (await browser.storage.local.get(
    STORAGE_KEY,
  )) as { [STORAGE_KEY]?: LocaleCode | null };

  if (!stored) {
    activeOverride = null;
    notify();
    return;
  }
  await loadOverride(stored);
  activeOverride = stored;
  notify();
}

void applyStoredLocale();
browser.storage.local.onChanged.addListener((changes) => {
  if (STORAGE_KEY in changes) void applyStoredLocale();
});

function substitute(message: string, args: (string | number)[]): string {
  if (args.length === 0) return message;
  return message.replace(/\$(\d+)/g, (_, idx) => {
    const i = Number(idx) - 1;
    return i >= 0 && i < args.length ? String(args[i]) : "";
  });
}

export function t(key: I18nKey, substitutions?: (string | number)[]): string {
  if (activeOverride) {
    const flatKey = String(key).replaceAll(".", "_");
    const map = overrideCache.get(activeOverride);
    const entry = map?.[flatKey];
    if (entry) return substitute(entry.message, substitutions ?? []);
  }
  const fn = wxtI18n.t as (key: string, subs?: unknown) => string;
  return substitutions ? fn(key, substitutions.map(String)) : fn(key);
}

export function getActiveLocale(): LocaleCode | null {
  return activeOverride;
}

// Localized weekday labels. Index 0 = Monday (matches the app's day ordering).
export function weekdaysShort(): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map(
    (i) => t(`days.short.d${i}` as I18nKey),
  );
}

export function dayNameFull(i: number): string {
  return t(`days.full.d${i}` as I18nKey);
}

export async function setActiveLocale(locale: LocaleCode | null): Promise<void> {
  if (locale === null) {
    await browser.storage.local.remove(STORAGE_KEY);
  } else {
    await browser.storage.local.set({ [STORAGE_KEY]: locale });
  }
}

export function useLocale(): LocaleCode | null {
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  const getSnapshot = () => activeOverride;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEnsureLocaleLoaded(): void {
  useEffect(() => {
    void applyStoredLocale();
  }, []);
}
