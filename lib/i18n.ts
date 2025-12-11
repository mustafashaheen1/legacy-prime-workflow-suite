import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

// Initialize i18n
const initI18n = async () => {
  // Try to get saved language preference
  const savedLanguage = await AsyncStorage.getItem('userLanguage');
  const defaultLanguage = savedLanguage || Localization.getLocales()[0]?.languageCode || 'en';

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        es: { translation: es },
      },
      lng: defaultLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      compatibilityJSON: 'v4',
    });
};

// Initialize immediately
initI18n();

export default i18n;
