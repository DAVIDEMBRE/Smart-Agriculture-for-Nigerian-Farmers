"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { copy, isLocale, localeRegistry, nextLocale, type Dictionary, type Locale } from "@/lib/content";

type Theme = "light" | "dark";
type Preferences = { locale: Locale; theme: Theme };

export const LOCALE_STORAGE_KEY = "sf-locale";
export const THEME_STORAGE_KEY = "sf-theme";

/**
 * Runs before first paint so the saved theme is applied without a flash. The
 * store below reads back whatever this script decided.
 */
export const themeBootstrapScript = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var d=s==="dark"||(!s&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var l=localStorage.getItem("${LOCALE_STORAGE_KEY}");if(l==="pcm"){document.documentElement.lang="pcm-NG";}}catch(e){}})();`;

/**
 * Theme and locale live in `localStorage` and on the document element, which
 * makes them external state. Reading them through `useSyncExternalStore` keeps
 * the hydration render aligned with the server (`serverPreferences`) and then
 * swaps in the viewer's stored choice, without a setState-in-effect cascade.
 */
const serverPreferences: Preferences = { locale: "en", theme: "light" };

let preferences: Preferences = serverPreferences;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The snapshot object is only replaced when a value actually changes. */
function getSnapshot(): Preferences {
  return preferences;
}

function getServerSnapshot(): Preferences {
  return serverPreferences;
}

function readStoredLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

if (typeof document !== "undefined") {
  preferences = {
    locale: readStoredLocale(),
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  };
}

function update(next: Partial<Preferences>) {
  preferences = { ...preferences, ...next };
  emit();
}

type AppContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: Dictionary;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { locale, theme } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLocale = useCallback((next: Locale) => {
    document.documentElement.lang = localeRegistry[next].htmlLang;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* the preference simply does not persist */
    }
    update({ locale: next });
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = preferences.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* the preference simply does not persist */
    }
    update({ theme: next });
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, theme, toggleTheme, t: copy[locale] }),
    [locale, setLocale, theme, toggleTheme],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

export { nextLocale };
