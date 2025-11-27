import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Wrench, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTranslation } from 'react-i18next';
import { useApp } from '@/contexts/AppContext';

export default function SignupScreen() {
  const [accountType, setAccountType] = useState<'company' | 'employee' | null>(null);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [employeeCount, setEmployeeCount] = useState<string>('2');
  const [companyCode, setCompanyCode] = useState<string>('');
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setUser } = useApp();

  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false);





  const handleSignup = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('signup.nameRequired'));
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert(t('common.error'), t('signup.validEmail'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), t('signup.passwordLength'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('signup.passwordMatch'));
      return;
    }

    try {
      setIsCreatingAccount(true);
      console.log('[Signup] Starting account creation...');

      if (accountType === 'company') {
        if (!companyName.trim()) {
          Alert.alert(t('common.error'), t('signup.companyNameRequired'));
          return;
        }
        if (!employeeCount || parseInt(employeeCount) < 1) {
          Alert.alert(t('common.error'), t('signup.employeeCountRequired'));
          return;
        }
        
        console.log('[Signup] Redirecting to subscription page...');
        router.push({
          pathname: '/(auth)/subscription',
          params: {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            companyName: companyName.trim(),
            employeeCount: employeeCount,
            accountType: 'company',
          },
        });
      } else {
        if (!companyCode.trim()) {
          Alert.alert(t('common.error'), t('signup.companyCodeRequired'));
          return;
        }

        console.log('[Signup] Validating company code...');
        
        const storedCompany = await AsyncStorage.getItem('company');
        if (!storedCompany) {
          Alert.alert(
            t('common.error'),
            'No se encontró ninguna empresa con este código. Por favor, verifica el código o contacta con tu empleador.'
          );
          return;
        }

        let company;
        try {
          company = JSON.parse(storedCompany);
        } catch (error) {
          console.error('[Signup] Error parsing company:', error);
          Alert.alert(t('common.error'), 'Error al validar el código de empresa.');
          return;
        }

        if (company.companyCode !== companyCode.toUpperCase()) {
          Alert.alert(
            t('common.error'),
            'El código de empresa no es válido. Por favor, verifica el código con tu empleador.'
          );
          return;
        }

        if (company.subscriptionStatus !== 'active' && company.subscriptionStatus !== 'trial') {
          Alert.alert(
            'Empresa Inactiva',
            'La empresa asociada con este código no tiene una suscripción activa. Contacta con el administrador de la empresa.'
          );
          return;
        }

        console.log('[Signup] Company code validated successfully');
        console.log('[Signup] Creating employee account...');
        
        const newUser = {
          id: `user-${Date.now()}`,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role: 'employee' as const,
          companyId: company.id,
          avatar: undefined,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        await setUser(newUser);

        console.log('[Signup] Employee account created successfully');

        Alert.alert(
          t('signup.successTitle'),
          `Tu cuenta de empleado ha sido creada exitosamente y vinculada a ${company.name}.`,
          [
            {
              text: t('common.ok'),
              onPress: () => router.replace('/dashboard'),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('[Signup] Error:', error);
      Alert.alert(t('common.error'), error?.message || 'Error al crear la cuenta');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(auth)/login');
          }
        }}
      >
        <ArrowLeft size={24} color="#2563EB" />
      </TouchableOpacity>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Wrench size={40} color="#2563EB" strokeWidth={2.5} />
          <Text style={styles.title}>{t('signup.title')}</Text>
          <Text style={styles.subtitle}>{accountType ? (accountType === 'company' ? t('signup.subtitleCompany') : t('signup.subtitleEmployee')) : t('signup.subtitle')}</Text>
        </View>

        {!accountType ? (
          <View style={styles.form}>
            <Text style={styles.accountTypeTitle}>{t('signup.accountTypeTitle')}</Text>
            <Text style={styles.accountTypeSubtitle}>{t('signup.accountTypeSubtitle')}</Text>
            
            <TouchableOpacity 
              style={styles.accountTypeButton}
              onPress={() => setAccountType('company')}
            >
              <View style={styles.accountTypeContent}>
                <Text style={styles.accountTypeButtonTitle}>{t('signup.companyAccount')}</Text>
                <Text style={styles.accountTypeButtonText}>{t('signup.companyAccountDesc')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.accountTypeButton}
              onPress={() => setAccountType('employee')}
            >
              <View style={styles.accountTypeContent}>
                <Text style={styles.accountTypeButtonTitle}>{t('signup.employeeAccount')}</Text>
                <Text style={styles.accountTypeButtonText}>{t('signup.employeeAccountDesc')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
        <View style={styles.form}>
          <Text style={styles.label}>{t('signup.fullName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('signup.namePlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>{t('signup.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('signup.emailPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t('signup.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('signup.passwordPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>{t('signup.confirmPassword')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('signup.confirmPasswordPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {accountType === 'company' && (
            <>
              <Text style={styles.label}>{t('signup.companyName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('signup.companyNamePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={companyName}
                onChangeText={setCompanyName}
                autoCapitalize="words"
              />

              <Text style={styles.label}>{t('signup.employeeCount')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('signup.employeeCountPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={employeeCount}
                onChangeText={setEmployeeCount}
                keyboardType="number-pad"
              />
              <Text style={styles.hint}>{t('signup.employeeCountHint')}</Text>
            </>
          )}

          {accountType === 'employee' && (
            <>
              <Text style={styles.label}>{t('signup.companyCode')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('signup.companyCodePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={companyCode}
                onChangeText={setCompanyCode}
                autoCapitalize="characters"
              />
              <Text style={styles.hint}>{t('signup.companyCodeHint')}</Text>
            </>
          )}

          <TouchableOpacity 
            style={[styles.signupButton, isCreatingAccount && styles.signupButtonDisabled]} 
            onPress={handleSignup}
            disabled={isCreatingAccount}
          >
            <Text style={styles.signupButtonText}>
              {isCreatingAccount ? t('common.loading') : t('signup.createAccount')}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomLinks}>
            <TouchableOpacity onPress={() => setAccountType(null)}>
              <Text style={styles.backToTypeText}>{t('signup.backToAccountType')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.loginText}>{t('signup.alreadyHaveAccount')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginBottom: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: -12,
    marginBottom: 16,
  },
  signupButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  signupButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  loginText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2563EB',
    textAlign: 'center',
  },
  accountTypeTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  accountTypeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  accountTypeButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  accountTypeContent: {
    alignItems: 'center',
  },
  accountTypeButtonTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  accountTypeButtonText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  bottomLinks: {
    gap: 8,
  },
  backToTypeText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
    textAlign: 'center',
  },
  socialButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
  socialButtonDisabled: {
    opacity: 0.5,
  },
  appleButtonDisabled: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
});
