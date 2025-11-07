import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Wrench, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';

export default function SignupScreen() {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [companyCode, setCompanyCode] = useState<string>('');
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

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
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
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
          <Text style={styles.subtitle}>{t('signup.subtitle')}</Text>
        </View>

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

          <TouchableOpacity 
            style={[styles.signupButton, createUserMutation.isPending && styles.signupButtonDisabled]} 
            onPress={handleSignup}
            disabled={createUserMutation.isPending}
          >
            <Text style={styles.signupButtonText}>
              {createUserMutation.isPending ? t('common.loading') : t('signup.createAccount')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginText}>{t('signup.alreadyHaveAccount')}</Text>
          </TouchableOpacity>
        </View>
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
});
