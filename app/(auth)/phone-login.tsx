import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { ArrowLeft, Phone, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';

export default function PhoneLoginScreen() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setUser, setCompany } = useApp();
  const insets = useSafeAreaInsets();

  const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      setStep('code');
      Alert.alert('Code Sent', `We sent a 6-digit code to ${formattedPhone}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: 'sms',
      });

      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('expired') || msg.includes('invalid') || msg.includes('not found')) {
          setCode('');
          Alert.alert('Code Expired', 'This code has expired or is invalid. Please request a new one.');
        } else {
          Alert.alert('Verification Failed', error.message || 'Failed to verify code');
        }
        return;
      }
      if (!data.user) throw new Error('Authentication failed');

      // Load user profile by phone number (phone OTP creates a new auth user,
      // so we match by phone field rather than auth UUID)
      // @ts-ignore - phone column exists but may not be in generated types
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*, companies(*)')
        .eq('phone', formattedPhone)
        .single();

      if (profileError || !userProfile) {
        // No account linked to this phone — sign out OTP session and go to signup
        await supabase.auth.signOut();
        router.push({
          pathname: '/(auth)/signup',
          params: { phone: formattedPhone },
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
      });

      // @ts-ignore - companies is joined
      if (userProfile.companies) {
        // @ts-ignore
        const c = userProfile.companies;
        setCompany({
          id: c.id, name: c.name, brandColor: c.brand_color,
          subscriptionStatus: c.subscription_status, subscriptionPlan: c.subscription_plan,
          subscriptionStartDate: c.subscription_start_date, employeeCount: c.employee_count,
          companyCode: c.company_code, settings: c.settings, createdAt: c.created_at,
          updatedAt: c.updated_at, logo: c.logo || undefined,
          licenseNumber: c.license_number || undefined, officePhone: c.office_phone || undefined,
          cellPhone: c.cell_phone || undefined, address: c.address || undefined,
          email: c.email || undefined, website: c.website || undefined,
          slogan: c.slogan || undefined, estimateTemplate: c.estimate_template || undefined,
          subscriptionEndDate: c.subscription_end_date || undefined,
          stripeCustomerId: c.stripe_customer_id || undefined,
          stripeSubscriptionId: c.stripe_subscription_id || undefined,
          stripePaymentIntentId: c.stripe_payment_intent_id || undefined,
        });
      }

      if (Platform.OS === 'web') {
        window.location.href = '/(tabs)/dashboard';
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => step === 'code' ? setStep('phone') : router.back()}
        >
          <ArrowLeft size={24} color="#2563EB" />
        </TouchableOpacity>

        <View style={styles.header}>
          {step === 'phone' ? (
            <Phone size={48} color="#2563EB" strokeWidth={2} />
          ) : (
            <Shield size={48} color="#2563EB" strokeWidth={2} />
          )}
          <Text style={styles.title}>
            {step === 'phone' ? 'Login with Phone' : 'Enter Code'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'Enter your phone number to receive a login code'
              : `Enter the 6-digit code sent to ${formattedPhone}`}
          </Text>
        </View>

        {step === 'phone' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoFocus
            />
            <Text style={styles.hint}>Include country code (e.g., +1 for US, +52 for Mexico)</Text>
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSendOTP}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              placeholderTextColor="#9CA3AF"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity style={styles.resendButton} onPress={handleSendOTP} disabled={isLoading}>
              <Text style={styles.resendText}>{isLoading ? 'Resending...' : "Didn't get it? Resend code"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleVerifyOTP}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify & Login</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  backButton: { marginBottom: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginTop: 20, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', marginTop: 10, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16,
    fontSize: 16, color: '#1F2937', marginBottom: 8,
  },
  codeInput: { fontSize: 24, fontWeight: '600', letterSpacing: 8, textAlign: 'center', marginBottom: 20 },
  hint: { fontSize: 12, color: '#6B7280', marginBottom: 24 },
  button: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  resendButton: { alignItems: 'center', marginBottom: 20 },
  resendText: { fontSize: 14, fontWeight: '500', color: '#2563EB' },
});
