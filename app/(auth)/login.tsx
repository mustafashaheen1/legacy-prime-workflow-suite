import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { auth } from '@/lib/supabase';
import { Wrench } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { setUser, setCompany } = useApp();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    // Validation
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      console.log('[Login] Attempting login for:', email);

      const result = await auth.signIn(email.toLowerCase().trim(), password);

      if (!result.success) {
        Alert.alert('Login Failed', result.error || 'Invalid email or password');
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

      // Navigate to dashboard
      router.replace('/dashboard');
    } catch (error: any) {
      console.error('[Login] Error:', error);
      Alert.alert('Login Error', error.message || 'An unexpected error occurred');
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
        <View style={styles.header}>
          <Wrench size={40} color="#2563EB" strokeWidth={2.5} />
          <Text style={styles.title}>Legacy Prime</Text>
          <Text style={styles.subtitle}>Manage projects easily.</Text>
        </View>

        <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
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
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.createAccountText}>Create Account</Text>
        </TouchableOpacity>
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
  createAccountText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2563EB',
    textAlign: 'center',
  },
});
