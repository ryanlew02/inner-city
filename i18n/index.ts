import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

const i18n = new I18n({
  en,
  es,
  zh,
  hi,
  ar,
  fr,
  pt,
  ru,
  ja,
  ko,
});

i18n.defaultLocale = 'en';
i18n.enableFallback = true;

export function getDeviceLocale(): string {
  const locales = Localization.getLocales();
  if (locales && locales.length > 0) {
    const code = locales[0].languageCode;
    if (code && ['en', 'es', 'zh', 'hi', 'ar', 'fr', 'pt', 'ru', 'ja', 'ko'].includes(code)) {
      return code;
    }
  }
  return 'en';
}

export default i18n;
