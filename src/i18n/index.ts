import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
const frTranslations = require('./locales/fr.json');
const enTranslations = require('./locales/en.json');

const resources = {
  fr: {
    translation: frTranslations,
  },
  en: {
    translation: enTranslations,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr', // Français forcé par défaut
    fallbackLng: 'fr',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;