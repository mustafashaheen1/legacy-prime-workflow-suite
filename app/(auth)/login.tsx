import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { auth } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const { setUser, setCompany } = useApp();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Listen to keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const handleLogin = async () => {
    // Validation
    if (!email.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Error\n\nPlease enter your email address');
      } else {
        Alert.alert('Error', 'Please enter your email address');
      }
      return;
    }

    if (!password) {
      if (Platform.OS === 'web') {
        window.alert('Error\n\nPlease enter your password');
      } else {
        Alert.alert('Error', 'Please enter your password');
      }
      return;
    }

    setIsLoading(true);

    try {
      console.log('[Login] Attempting login for:', email);

      const result = await auth.signIn(email.toLowerCase().trim(), password);

      if (!result.success) {
        if (Platform.OS === 'web') {
          window.alert(`Login Failed\n\n${result.error || 'Invalid email or password'}`);
        } else {
          Alert.alert('Login Failed', result.error || 'Invalid email or password');
        }
        return;
      }

      console.log('[Login] Login successful');
      console.log('[Login] User:', result.user?.name);
      console.log('[Login] Company:', result.user?.companies?.name);

      // Update app context with user and company data
      if (result.user) {
        setUser({
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          companyId: result.user.company_id || '',
          isActive: result.user.is_active,
          createdAt: result.user.created_at,
          phone: result.user.phone || undefined,
          address: result.user.address || undefined,
          hourlyRate: result.user.hourly_rate || undefined,
          avatar: result.user.avatar || undefined,
          customPermissions: result.user.custom_permissions || undefined,
        });

        // @ts-ignore - companies is joined in the query
        if (result.user.companies) {
          // @ts-ignore
          const companyData = result.user.companies;
          setCompany({
            id: companyData.id,
            name: companyData.name,
            brandColor: companyData.brand_color,
            subscriptionStatus: companyData.subscription_status,
            subscriptionPlan: companyData.subscription_plan,
            subscriptionStartDate: companyData.subscription_start_date,
            employeeCount: companyData.employee_count,
            companyCode: companyData.company_code,
            settings: companyData.settings,
            createdAt: companyData.created_at,
            updatedAt: companyData.updated_at,
            logo: companyData.logo || undefined,
            licenseNumber: companyData.license_number || undefined,
            officePhone: companyData.office_phone || undefined,
            cellPhone: companyData.cell_phone || undefined,
            address: companyData.address || undefined,
            email: companyData.email || undefined,
            website: companyData.website || undefined,
            slogan: companyData.slogan || undefined,
            estimateTemplate: companyData.estimate_template || undefined,
            subscriptionEndDate: companyData.subscription_end_date || undefined,
            stripePaymentIntentId: companyData.stripe_payment_intent_id || undefined,
            stripeCustomerId: companyData.stripe_customer_id || undefined,
            stripeSubscriptionId: companyData.stripe_subscription_id || undefined,
          });
        }
      }

      // On web, reload the page to trigger data loading with the new company
      // This fixes the issue where tRPC dynamic imports don't work in production builds
      if (Platform.OS === 'web') {
        console.log('[Login] Reloading page to load company data...');
        window.location.href = '/(tabs)/dashboard';
      } else {
        // Navigate to dashboard on native
        router.replace('/(tabs)/dashboard');
      }
    } catch (error: any) {
      console.error('[Login] Error:', error);
      if (Platform.OS === 'web') {
        window.alert(error.message || 'An unexpected error occurred');
      } else {
        Alert.alert(t('common.error'), error.message || 'An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        {!isKeyboardVisible && (
          <View style={styles.languageSwitcherContainer}>
            <LanguageSwitcher />
          </View>
        )}

        <View style={styles.header}>
          <Logo size={100} />
          <Text style={styles.title}>Legacy Prime</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        </View>

        <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder={t('login.emailPlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder={t('login.passwordPlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>{t('login.loginButton')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.signupContainer}>
          <Text style={styles.noAccountText}>{t('login.noAccount')} </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupText}>{t('login.signUp')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  languageSwitcherContainer: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  socialButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
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
  loginButtonDisabled: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
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
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
  },
  loginButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAccountText: {
    fontSize: 15,
    color: '#6B7280',
  },
  signupText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  createAccountText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2563EB',
    textAlign: 'center',
  },
});
