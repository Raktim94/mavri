import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import de from './de.json';
import en from './en.json';
import fr from './fr.json';
import lt from './lt.json';
import pt from './pt.json';

const DEFAULT_LOCALE = 'en';

const resources = {
  en: { translation: en },
  lt: { translation: lt },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt }
};

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      escapeValue: false
    }
  });

export default i18next;
