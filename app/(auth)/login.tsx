import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { mockUsers } from '@/mocks/data';
import { Wrench } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const { setUser } = useApp();
  const insets = useSafeAreaInsets();

  const handleLogin = () => {
    const user = mockUsers[0];
    setUser(user);
    router.replace('/(auth)/subscription');
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Login with ${provider}`);
    const user = mockUsers[0];
    setUser(user);
    router.replace('/(auth)/subscription');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        <Wrench size={40} color="#2563EB" strokeWidth={2.5} />
        <Text style={styles.title}>Legacy Prime</Text>
        <Text style={styles.subtitle}>Manage projects easily.</Text>
      </View>

      <View style={styles.form}>
        <TouchableOpacity 
          style={styles.socialButton}
          onPress={() => handleSocialLogin('Google')}
        >
          <Text style={styles.socialButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.socialButton, styles.appleButton]}
          onPress={() => handleSocialLogin('Apple')}
        >
          <Text style={[styles.socialButtonText, styles.appleButtonText]}>Sign in with Apple</Text>
        </TouchableOpacity>

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

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => console.log('Create account')}>
          <Text style={styles.createAccountText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </View>
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
