import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Phone, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '@/lib/trpc';
import * as Haptics from 'expo-haptics';

export default function PhoneVerificationScreen() {
  const params = useLocalSearchParams<{
    name: string;
    email: string;
    password: string;
    companyName?: string;
    employeeCount?: string;
    accountType: 'company' | 'employee';
    companyCode?: string;
  }>();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [, setExpiresAt] = useState<string>('');
  
  const insets = useSafeAreaInsets();

  const sendCodeMutation = trpc.auth.sendVerificationCode.useMutation({
    onSuccess: (data) => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setExpiresAt(data.expiresAt);
      setStep('code');
      Alert.alert(
        'Code Sent',
        `We have sent a verification code to ${phoneNumber}`
      );
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const verifyCodeMutation = trpc.auth.verifyCode.useMutation({
    onSuccess: () => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      if (params.accountType === 'company') {
        router.push({
          pathname: '/(auth)/subscription',
          params: {
            ...params,
            phoneNumber,
            phoneVerified: 'true',
          },
        });
      } else {
        router.push({
          pathname: '/(auth)/subscription',
          params: {
            ...params,
            phoneNumber,
            phoneVerified: 'true',
          },
        });
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleSendCode = () => {
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    sendCodeMutation.mutate({ phoneNumber: formattedPhone });
  };

  const handleVerifyCode = () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    verifyCodeMutation.mutate({
      phoneNumber: formattedPhone,
      code: verificationCode,
    });
  };

  const handleResendCode = () => {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    sendCodeMutation.mutate({ phoneNumber: formattedPhone });
  };

  const handleSkip = () => {
    if (params.accountType === 'company') {
      router.push({
        pathname: '/(auth)/subscription',
        params: {
          ...params,
          phoneVerified: 'false',
        },
      });
    } else {
      router.push({
        pathname: '/(auth)/subscription',
        params: {
          ...params,
          phoneVerified: 'false',
        },
      });
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (step === 'code') {
              setStep('phone');
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)/signup');
            }
          }}
        >
          <ArrowLeft size={24} color="#2563EB" />
        </TouchableOpacity>

        <View style={styles.content}>
        <View style={styles.header}>
          {step === 'phone' ? (
            <Phone size={48} color="#2563EB" strokeWidth={2} />
          ) : (
            <Shield size={48} color="#2563EB" strokeWidth={2} />
          )}
          <Text style={styles.title}>
            {step === 'phone' ? 'Verify Phone' : 'Enter Code'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'We will send a verification code to your phone for added security'
              : `Enter the 6-digit code we sent to ${phoneNumber}`}
          </Text>
        </View>

        <View style={styles.form}>
          {step === 'phone' ? (
            <>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 (555) 123-4567"
                placeholderTextColor="#9CA3AF"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoFocus
              />
              <Text style={styles.hint}>
                Include country code (e.g., +1 for USA, +52 for Mexico)
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, sendCodeMutation.isPending && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={sendCodeMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {sendCodeMutation.isPending ? 'Sending...' : 'Send Code'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResendCode}
                disabled={sendCodeMutation.isPending}
              >
                <Text style={styles.resendText}>
                  {sendCodeMutation.isPending ? 'Resending...' : "Didn't receive the code? Resend"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, verifyCodeMutation.isPending && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={verifyCodeMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {verifyCodeMutation.isPending ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
            style={styles.skipButton}
            onPress={handleSkip}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
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
    flexGrow: 1,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  form: {
    width: '100%',
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  resendButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#2563EB',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
});
