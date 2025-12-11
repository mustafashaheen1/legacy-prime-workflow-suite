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
        style={[styles.flagButton, currentLanguage === 'en' && styles.activeFlag]}
        onPress={() => changeLanguage('en')}
      >
        <Text style={styles.flag}>🇺🇸</Text>
        <Text style={[styles.label, currentLanguage === 'en' && styles.activeLabel]}>EN</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.flagButton, currentLanguage === 'es' && styles.activeFlag]}
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
    gap: 12,
  },
  flagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeFlag: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  flag: {
    fontSize: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeLabel: {
    color: '#2563EB',
  },
});
