import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Wrench, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';
import { useApp } from '@/contexts/AppContext';
import { auth } from '@/lib/supabase';

export default function SignupScreen() {
  const [accountType, setAccountType] = useState<'company' | 'employee' | null>(null);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [employeeCount, setEmployeeCount] = useState<string>('2');
  const [companyCode, setCompanyCode] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setUser, setCompany } = useApp();

  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false);





  const handleSignup = async () => {
    // Helper function for showing alerts
    const showAlert = (title: string, message: string) => {
      if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
      } else {
        Alert.alert(title, message);
      }
    };

    // Common validation
    if (!name.trim()) {
      showAlert('Error', 'Please enter your full name');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    // Account-type specific validation BEFORE setting loading state
    if (accountType === 'company') {
      if (!companyName.trim()) {
        showAlert('Error', 'Please enter your company name');
        return;
      }
      if (!employeeCount || parseInt(employeeCount) < 1) {
        showAlert('Error', 'Please enter number of employees (at least 1)');
        return;
      }
    } else if (accountType === 'employee') {
      if (!companyCode.trim()) {
        showAlert('Error', 'Please enter your company code');
        return;
      }

      if (!phone.trim()) {
        showAlert('Error', 'Please enter your phone number');
        return;
      }

      // Validate US phone number format (exactly 10 digits)
      if (phone.length !== 10) {
        showAlert('Error', 'Please enter exactly 10 digits for your phone number');
        return;
      }

      if (!address.trim()) {
        showAlert('Error', 'Please enter your address');
        return;
      }
    }

    setIsCreatingAccount(true);

    try {
      console.log('[Signup] Starting account creation...');

      if (accountType === 'company') {

        console.log('[Signup] Creating company account...');

        const result = await auth.signUpCompany({
          email: email.toLowerCase().trim(),
          password,
          name: name.trim(),
          companyName: companyName.trim(),
          employeeCount: parseInt(employeeCount),
          subscriptionPlan: 'basic', // Default to basic plan
        });

        if (!result.success) {
          showAlert('Signup Failed', result.error || 'Failed to create company account');
          return;
        }

        console.log('[Signup] Company account created successfully');
        console.log('[Signup] Company Code:', result.companyCode);

        // Update app context with user and company data
        if (result.user && result.company) {
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
          });

          setCompany({
            id: result.company.id,
            name: result.company.name,
            brandColor: result.company.brand_color,
            subscriptionStatus: result.company.subscription_status,
            subscriptionPlan: result.company.subscription_plan,
            subscriptionStartDate: result.company.subscription_start_date,
            employeeCount: result.company.employee_count,
            companyCode: result.company.company_code || undefined,
            settings: result.company.settings,
            createdAt: result.company.created_at,
            updatedAt: result.company.updated_at,
            logo: result.company.logo || undefined,
            licenseNumber: result.company.license_number || undefined,
            officePhone: result.company.office_phone || undefined,
            cellPhone: result.company.cell_phone || undefined,
            address: result.company.address || undefined,
            email: result.company.email || undefined,
            website: result.company.website || undefined,
            slogan: result.company.slogan || undefined,
            estimateTemplate: result.company.estimate_template || undefined,
            subscriptionEndDate: result.company.subscription_end_date || undefined,
            stripePaymentIntentId: result.company.stripe_payment_intent_id || undefined,
            stripeCustomerId: result.company.stripe_customer_id || undefined,
            stripeSubscriptionId: result.company.stripe_subscription_id || undefined,
          });
        }

        // On web, navigate directly. On native, show alert first.
        if (Platform.OS === 'web') {
          console.log('[Signup] Navigating to subscription page (web)');
          router.push({
            pathname: '/(auth)/subscription',
            params: {
              accountType: 'company',
              companyId: result.company!.id,
              companyName: result.company!.name,
              companyCode: result.companyCode,
            },
          });
        } else {
          // Show company code in alert on native
          Alert.alert(
            'Company Created!',
            `Your company has been created successfully!\n\nYour Company Code: ${result.companyCode}\n\nShare this code with your employees so they can join your company.`,
            [
              {
                text: 'Continue to Subscription',
                onPress: () => {
                  // Redirect to subscription page with params
                  router.push({
                    pathname: '/(auth)/subscription',
                    params: {
                      accountType: 'company',
                      companyId: result.company!.id,
                      companyName: result.company!.name,
                      companyCode: result.companyCode,
                    },
                  });
                },
              },
            ]
          );
        }
      } else {
        // Employee signup (validation already done above)
        console.log('[Signup] Creating employee account...');

        const result = await auth.signUpEmployee({
          email: email.toLowerCase().trim(),
          password,
          name: name.trim(),
          companyCode: companyCode.toUpperCase().trim(),
          phone: phone.trim(),
          address: address.trim(),
        });

        if (!result.success) {
          showAlert('Signup Failed', result.error || 'Failed to create employee account');
          return;
        }

        console.log('[Signup] Employee account created successfully');

        // Update app context with user data
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
          });

          // Set company data if available
          if (result.company) {
            setCompany({
              id: result.company.id,
              name: result.company.name,
              brandColor: result.company.brand_color,
              subscriptionStatus: result.company.subscription_status,
              subscriptionPlan: result.company.subscription_plan,
              subscriptionStartDate: result.company.subscription_start_date,
              employeeCount: result.company.employee_count,
              companyCode: result.company.company_code || undefined,
              settings: result.company.settings,
              createdAt: result.company.created_at,
              updatedAt: result.company.updated_at,
              logo: result.company.logo || undefined,
              licenseNumber: result.company.license_number || undefined,
              officePhone: result.company.office_phone || undefined,
              cellPhone: result.company.cell_phone || undefined,
              address: result.company.address || undefined,
              email: result.company.email || undefined,
              website: result.company.website || undefined,
              slogan: result.company.slogan || undefined,
              estimateTemplate: result.company.estimate_template || undefined,
              subscriptionEndDate: result.company.subscription_end_date || undefined,
              stripePaymentIntentId: result.company.stripe_payment_intent_id || undefined,
              stripeCustomerId: result.company.stripe_customer_id || undefined,
              stripeSubscriptionId: result.company.stripe_subscription_id || undefined,
            });
          }
        }

        // Show pending approval message
        if (result.pendingApproval) {
          if (Platform.OS === 'web') {
            // On web, alert doesn't support callbacks, so redirect immediately
            window.alert('Account Created\n\nYour employee account has been created and is pending approval from your company administrator. You will receive a notification once your account is approved.');
            router.replace('/(auth)/login');
          } else {
            // On native, use Alert with callback
            Alert.alert(
              'Account Created',
              `Your employee account has been created and is pending approval from your company administrator. You will receive a notification once your account is approved.`,
              [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(auth)/login'),
                },
              ]
            );
          }
        } else {
          // If not pending approval, go to dashboard
          router.replace('/dashboard');
        }
      }
    } catch (error: any) {
      console.error('[Signup] Error:', error);
      if (Platform.OS === 'web') {
        window.alert(`Error\n\n${error?.message || 'An unexpected error occurred'}`);
      } else {
        Alert.alert('Error', error?.message || 'An unexpected error occurred');
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
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
              <Text style={styles.label}>{t('signup.phone')}</Text>
              <TextInput
                style={styles.input}
                placeholder="5551234567"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={(text) => {
                  // Only allow digits and limit to 10 characters
                  const filtered = text.replace(/[^0-9]/g, '').slice(0, 10);
                  setPhone(filtered);
                }}
                keyboardType="number-pad"
                maxLength={10}
              />
              <Text style={styles.hint}>Enter 10-digit US phone number (digits only)</Text>

              <Text style={styles.label}>{t('signup.address')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('signup.addressPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
              />

              <Text style={styles.label}>{t('signup.hourlyRate')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('signup.hourlyRatePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={hourlyRate}
                onChangeText={(text) => {
                  // Only allow digits
                  const filtered = text.replace(/[^0-9]/g, '');
                  setHourlyRate(filtered);
                }}
                keyboardType="number-pad"
              />
              <Text style={styles.hint}>{t('signup.hourlyRateHint')}</Text>

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
            {isCreatingAccount ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signupButtonText}>{t('signup.createAccount')}</Text>
            )}
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
    </KeyboardAvoidingView>
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
