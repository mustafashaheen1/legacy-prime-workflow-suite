import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { auth, supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Phone, Eye, EyeOff } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSocialLoading, setIsSocialLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
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



  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setIsSocialLoading(true);
    try {
      // Native uses a custom scheme so ASWebAuthenticationSession closes the modal.
      // Web uses the HTTPS callback page.
      const redirectTo = Platform.OS === 'web'
        ? undefined // defaults to https://.../auth/callback in signInWithOAuth
        : 'legacyprime://auth/callback';
      const result = await auth.signInWithOAuth(provider, redirectTo);
      if (!result.success || !result.url) {
        Alert.alert('Error', result.error || 'OAuth login failed');
        return;
      }
      if (Platform.OS === 'web') {
        window.location.href = result.url;
      } else {
        // Use custom URL scheme so ASWebAuthenticationSession closes the modal
        // when Google redirects back (HTTPS redirects don't close the modal on iOS).
        const redirectUrl = 'legacyprime://auth/callback';

        const browserResult = await WebBrowser.openAuthSessionAsync(result.url, redirectUrl);
        console.log('[OAuth] browserResult type:', browserResult.type);

        if (browserResult.type === 'success') {
          const urlStr = (browserResult as any).url as string;
          console.log('[OAuth] returned URL:', urlStr);

          // Parse tokens — Supabase puts them in hash or query params
          const separatorIndex = urlStr.indexOf('#') !== -1 ? urlStr.indexOf('#') : urlStr.indexOf('?');
          if (separatorIndex === -1) {
            Alert.alert('Sign-in Failed', 'No tokens returned. Please try again.');
            return;
          }

          const params = new URLSearchParams(urlStr.substring(separatorIndex + 1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          console.log('[OAuth] accessToken present:', !!accessToken, 'refreshToken present:', !!refreshToken);

          if (!accessToken || !refreshToken) {
            Alert.alert('Sign-in Failed', 'Missing tokens in callback. Please try again.');
            return;
          }

          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError || !sessionData.session) {
            Alert.alert('Sign-in Failed', sessionError?.message || 'Could not establish session. Please try again.');
            return;
          }

          // Look up by email — Google auth creates a different Supabase auth UUID
          // than an existing email/password account, so we must match by email.
          const googleEmail = sessionData.session.user.email;
          console.log('[OAuth] Looking up user by email:', googleEmail);

          const { data: userProfile } = await supabase
            .from('users')
            .select('*, companies(*)')
            .eq('email', googleEmail)
            .single();

          if (!userProfile) {
            // New Google user — no users table entry yet.
            // Keep the OAuth session active (don't sign out) and redirect to
            // signup with email + auth ID pre-filled so signup can create app-level
            // DB records without calling supabase.auth.signUp() again.
            const googleName = sessionData.session.user.user_metadata?.full_name
              || sessionData.session.user.user_metadata?.name
              || '';
            router.push({
              pathname: '/(auth)/signup',
              params: {
                email: googleEmail,
                googleAuthId: sessionData.session.user.id,
                googleName,
              },
            });
            return;
          }

          // Map snake_case DB row to camelCase User shape expected by AppContext
          setUser({
            id: userProfile.id,
            name: userProfile.name,
            email: userProfile.email,
            role: userProfile.role,
            companyId: userProfile.company_id || '',
            isActive: userProfile.is_active,
            createdAt: userProfile.created_at,
            phone: userProfile.phone || undefined,
            address: userProfile.address || undefined,
            hourlyRate: userProfile.hourly_rate || undefined,
            avatar: userProfile.avatar || undefined,
            customPermissions: userProfile.custom_permissions || undefined,
          } as any);

          // @ts-ignore — companies is a joined object
          setCompany(userProfile.companies ?? null);

          // Navigation is handled by the auth guard in _layout.tsx reacting to
          // the user state update — no manual router.replace() needed here.
        } else {
          console.log('[OAuth] Not successful, type was:', browserResult.type);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred');
    } finally {
      setIsSocialLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsSocialLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName } = credential;
      if (!identityToken) {
        Alert.alert('Error', 'Apple Sign In failed: no identity token received.');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });

      if (sessionError || !sessionData.session) {
        Alert.alert('Sign-in Failed', sessionError?.message || 'Could not establish session. Please try again.');
        return;
      }

      const appleEmail = sessionData.session.user.email;
      const appleName = fullName?.givenName
        ? `${fullName.givenName}${fullName.familyName ? ' ' + fullName.familyName : ''}`
        : (sessionData.session.user.user_metadata?.full_name || '');

      const { data: userProfile } = await supabase
        .from('users')
        .select('*, companies(*)')
        .eq('email', appleEmail)
        .single();

      if (!userProfile) {
        // New Apple user — no users table entry yet, redirect to signup
        router.push({
          pathname: '/(auth)/signup',
          params: {
            email: appleEmail,
            googleAuthId: sessionData.session.user.id,
            googleName: appleName,
          },
        });
        return;
      }

      if (!userProfile.is_active) {
        await supabase.auth.signOut();
        Alert.alert('Account Pending', 'Your account is pending approval from your administrator.');
        return;
      }

      setUser({
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        companyId: userProfile.company_id || '',
        isActive: userProfile.is_active,
        createdAt: userProfile.created_at,
        phone: userProfile.phone || undefined,
        address: userProfile.address || undefined,
        hourlyRate: userProfile.hourly_rate || undefined,
        avatar: userProfile.avatar || undefined,
        customPermissions: userProfile.custom_permissions || undefined,
      } as any);

      // @ts-ignore — companies is a joined object
      setCompany(userProfile.companies ?? null);
    } catch (e: any) {
      // ERR_REQUEST_CANCELED = user dismissed the Apple sheet — not an error
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', e.message || 'An unexpected error occurred');
      }
    } finally {
      setIsSocialLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
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

          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeButton}>
              {showPassword ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

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

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Phone Login */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => router.push('/(auth)/phone-login')}
            disabled={isSocialLoading}
          >
            <View style={styles.socialButtonInner}>
              <Phone size={20} color="#1F2937" strokeWidth={2} />
              <Text style={styles.socialButtonText}>Continue with Phone</Text>
            </View>
          </TouchableOpacity>

          {/* Google Login */}
          <TouchableOpacity
            style={[styles.socialButton, isSocialLoading && styles.socialButtonDisabled]}
            onPress={() => handleOAuthLogin('google')}
            disabled={isSocialLoading}
          >
            {isSocialLoading ? (
              <ActivityIndicator color="#1F2937" />
            ) : (
              <View style={styles.socialButtonInner}>
                {/* Google G mark — clean 24×24 paths */}
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </Svg>
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Apple Login — iOS only */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton, isSocialLoading && styles.appleButtonDisabled]}
              onPress={handleAppleLogin}
              disabled={isSocialLoading}
            >
              {isSocialLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.socialButtonInner}>
                  {/* Apple logo — clean 24×24 paths */}
                  <Svg width={18} height={20} viewBox="0 0 24 24">
                    <Path
                      fill="#FFFFFF"
                      d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.3.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
                    />
                  </Svg>
                  <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continue with Apple</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.signupContainer}>
            <Text style={styles.noAccountText}>{t('login.noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.signupText}>{t('login.signUp')}</Text>
            </TouchableOpacity>
          </View>

          {!isKeyboardVisible && (
            <View style={styles.languageSwitcherContainer}>
              <LanguageSwitcher />
            </View>
          )}
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
    alignItems: 'center',
    marginTop: 16,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  socialButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeButton: {
    padding: 4,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 4,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#2563EB',
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
    marginTop: 16,
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
