import { useEffect, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from '@/lib/i18n';

const LANGUAGE_STORAGE_KEY = '@app:language';

type Language = 'en' | 'es';

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(
    (Localization.getLocales()[0]?.languageCode === 'es' ? 'es' : 'en') as Language
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedLanguage && (storedLanguage === 'en' || storedLanguage === 'es')) {
        setCurrentLanguage(storedLanguage);
        i18n.changeLanguage(storedLanguage);
      }
    } catch (error) {
      console.error('[Language] Error loading language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguage = async (language: Language) => {
    try {
      setCurrentLanguage(language);
      i18n.changeLanguage(language);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      console.log('[Language] Changed to:', language);
    } catch (error) {
      console.error('[Language] Error saving language:', error);
    }
  };

  return {
    currentLanguage,
    changeLanguage,
    isLoading,
  };
});
