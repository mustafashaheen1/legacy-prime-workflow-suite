import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Wrench, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const [accountType, setAccountType] = useState<'company' | 'employee' | null>(null);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [employeeCount, setEmployeeCount] = useState<string>('2');
  const [companyCode, setCompanyCode] = useState<string>('');
  const [isLoadingSocial, setIsLoadingSocial] = useState<boolean>(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setUser } = useApp();

  const createUserMutation = trpc.users.createUser.useMutation({
    onSuccess: () => {
      Alert.alert(
        t('signup.successTitle'),
        t('signup.successMessage'),
        [
          {
            text: t('common.ok'),
            onPress: () => router.replace('/(auth)/login'),
          }
        ]
      );
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error.message);
    },
  });

  const getCompaniesMutation = trpc.companies.getCompanies.useQuery();

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { queryParams } = Linking.parse(event.url);
      
      if (queryParams?.provider && queryParams?.success === 'true') {
        console.log(`[Auth] ${queryParams.provider} signup successful`);
        router.replace('/(auth)/subscription');
      } else if (queryParams?.error) {
        Alert.alert(t('common.error'), queryParams.error as string || 'Authentication failed');
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [t]);

  const handleSocialSignup = async (provider: 'google' | 'apple') => {
    try {
      setIsLoadingSocial(true);
      
      if (Platform.OS !== 'web') {
        await Haptics.selectionAsync();
      }

      const redirectUrl = Linking.createURL('auth-callback');
      console.log('[Auth] Redirect URL:', redirectUrl);

      let authUrl = '';
      if (provider === 'google') {
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=YOUR_GOOGLE_CLIENT_ID&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=openid%20profile%20email`;
      } else if (provider === 'apple') {
        authUrl = `https://appleid.apple.com/auth/authorize?response_type=code&client_id=YOUR_APPLE_CLIENT_ID&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=name%20email`;
      }

      console.log(`[Auth] Opening ${provider} OAuth URL...`);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        const { queryParams } = Linking.parse(result.url);
        
        if (queryParams?.code) {
          console.log(`[Auth] ${provider} authorization code received`);
          router.replace('/(auth)/subscription');
        }
      } else if (result.type === 'cancel') {
        console.log(`[Auth] ${provider} signup cancelled`);
      }
    } catch (error) {
      console.error(`[Auth] ${provider} signup error:`, error);
      Alert.alert(t('common.error'), `Failed to sign up with ${provider}. Please try again.`);
    } finally {
      setIsLoadingSocial(false);
    }
  };

  const handleSignup = () => {
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

    if (accountType === 'company') {
      if (!companyName.trim()) {
        Alert.alert(t('common.error'), t('signup.companyNameRequired'));
        return;
      }
      if (!employeeCount || parseInt(employeeCount) < 1) {
        Alert.alert(t('common.error'), t('signup.employeeCountRequired'));
        return;
      }
      router.push({
        pathname: '/(auth)/phone-verification',
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

      const company = getCompaniesMutation.data?.companies.find(
        (c: any) => c.id.toLowerCase() === companyCode.toLowerCase() || 
             c.name.toLowerCase().includes(companyCode.toLowerCase())
      );

      if (!company) {
        Alert.alert(t('common.error'), t('signup.invalidCompanyCode'));
        return;
      }

      createUserMutation.mutate({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: 'field-employee',
        companyId: company.id,
      });
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
          {accountType === 'company' && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Sign up with</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity 
                style={[styles.socialButton, isLoadingSocial && styles.socialButtonDisabled]}
                onPress={() => handleSocialSignup('google')}
                disabled={isLoadingSocial}
              >
                <Text style={styles.socialButtonText}>{isLoadingSocial ? 'Loading...' : 'Sign up with Google'}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.socialButton, styles.appleButton, isLoadingSocial && styles.appleButtonDisabled]}
                onPress={() => handleSocialSignup('apple')}
                disabled={isLoadingSocial}
              >
                <Text style={[styles.socialButtonText, styles.appleButtonText]}>{isLoadingSocial ? 'Loading...' : 'Sign up with Apple'}</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or with email</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}
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
            style={[styles.signupButton, (createUserMutation.isPending || isLoadingSocial) && styles.signupButtonDisabled]} 
            onPress={handleSignup}
            disabled={createUserMutation.isPending || isLoadingSocial}
          >
            <Text style={styles.signupButtonText}>
              {(createUserMutation.isPending || isLoadingSocial) ? t('common.loading') : (accountType === 'company' ? t('signup.continueToPayment') : t('signup.createAccount'))}
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
