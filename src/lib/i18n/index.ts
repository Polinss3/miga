/* eslint-disable import/no-named-as-default-member -- i18next's default instance API is the documented usage */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_KEY = 'miga.language';

function deviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? (code as AppLanguage) : 'en';
}

/**
 * Initialize i18n SYNCHRONOUSLY at module load.
 *
 * `initAsync: false` (i18next v26; was `initImmediate` before) + inline
 * resources (no async backend) makes init complete synchronously, so
 * translations are ready before the first render and nothing has to await/gate
 * on it. This avoids the startup deadlock where awaiting `i18n.init()` could
 * hang and keep the splash up forever.
 *
 * The user's saved language override is applied afterwards, off the critical
 * path, via `loadStoredLanguage()`.
 */
export function initI18nSync(): void {
  if (i18n.isInitialized) return;
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: deviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
}

/** Apply the persisted language override, if any. Safe to call after init; non-blocking. */
export async function loadStoredLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (
      stored &&
      (SUPPORTED_LANGUAGES as readonly string[]).includes(stored) &&
      stored !== i18n.language
    ) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Keep the device language already set by initI18nSync().
  }
}

/** Change the app language and persist the override. Pass null to follow the device. */
export async function setAppLanguage(language: AppLanguage | null): Promise<void> {
  if (language) {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
    await i18n.changeLanguage(language);
  } else {
    await AsyncStorage.removeItem(LANGUAGE_KEY);
    await i18n.changeLanguage(deviceLanguage());
  }
}

export function currentLanguage(): AppLanguage {
  return (i18n.language as AppLanguage) ?? 'en';
}

export default i18n;
