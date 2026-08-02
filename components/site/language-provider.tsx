"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import type { Language } from "@/lib/contracts";

const storageKey = "benebot-language";
const languageListeners = new Set<() => void>();

function readStoredLanguage(): Language {
  const stored = window.localStorage.getItem(storageKey);
  return stored === "en" ? "en" : "es";
}

function subscribeToLanguage(onStoreChange: () => void): () => void {
  languageListeners.add(onStoreChange);
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === storageKey) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    languageListeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore<Language>(subscribeToLanguage, readStoredLanguage, () => "es");
  const setLanguage = useCallback((nextLanguage: Language): void => {
    window.localStorage.setItem(storageKey, nextLanguage);
    languageListeners.forEach((listener) => listener());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
