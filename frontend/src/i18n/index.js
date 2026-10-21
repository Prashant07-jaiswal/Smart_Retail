import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';

const STORAGE_KEY = 'smart_retail_lang';
const savedLang = localStorage.getItem(STORAGE_KEY) || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes output
});

// Persist the choice so it survives a refresh/new session.
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
