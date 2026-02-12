import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n, { getDeviceLocale } from '../i18n';
import {
  LanguageCode,
  getLanguagePreference,
  setLanguagePreference as saveLanguagePreference,
} from '../services/database/languageService';

type LanguageContextType = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string, options?: Record<string, any>) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const LANGUAGE_OPTIONS: { code: LanguageCode; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Espa\u00f1ol' },
  { code: 'zh', label: 'Chinese', nativeLabel: '\u4e2d\u6587' },
  { code: 'hi', label: 'Hindi', nativeLabel: '\u0939\u093f\u0928\u094d\u0926\u0940' },
  { code: 'ar', label: 'Arabic', nativeLabel: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
  { code: 'fr', label: 'French', nativeLabel: 'Fran\u00e7ais' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Portugu\u00eas' },
  { code: 'ru', label: 'Russian', nativeLabel: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
  { code: 'ja', label: 'Japanese', nativeLabel: '\u65e5\u672c\u8a9e' },
  { code: 'ko', label: 'Korean', nativeLabel: '\ud55c\uad6d\uc5b4' },
];

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    getLanguagePreference().then((saved) => {
      const code = saved || (getDeviceLocale() as LanguageCode);
      setLanguageState(code);
      i18n.locale = code;
    });
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    i18n.locale = code;
    saveLanguagePreference(code);
  }, []);

  const t = useCallback((key: string, options?: Record<string, any>) => {
    return i18n.t(key, options);
  }, [language]); // language dependency forces re-render on change

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
