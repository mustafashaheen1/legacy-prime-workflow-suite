import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language;

  const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem('userLanguage', lang);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.option, currentLanguage === 'en' && styles.activeOption]}
        onPress={() => changeLanguage('en')}
      >
        <Text style={styles.flag}>🇺🇸</Text>
        <Text style={[styles.label, currentLanguage === 'en' && styles.activeLabel]}>EN</Text>
      </TouchableOpacity>

      <View style={styles.separator} />

      <TouchableOpacity
        style={[styles.option, currentLanguage === 'es' && styles.activeOption]}
        onPress={() => changeLanguage('es')}
      >
        <Text style={styles.flag}>🇪🇸</Text>
        <Text style={[styles.label, currentLanguage === 'es' && styles.activeLabel]}>ES</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 3,
    paddingVertical: 3,
    gap: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 11,
  },
  activeOption: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  separator: {
    width: 1,
    height: 10,
    backgroundColor: '#D1D5DB',
  },
  flag: {
    fontSize: 11,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeLabel: {
    color: '#1F2937',
  },
});
