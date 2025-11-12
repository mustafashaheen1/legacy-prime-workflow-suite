import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { mockUsers } from '@/mocks/data';
import { Wrench } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { setUser } = useApp();
  const insets = useSafeAreaInsets();

  const handleLogin = () => {
    const user = mockUsers[0];
    setUser(user);
    router.replace('/dashboard');
  };

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { queryParams } = Linking.parse(event.url);
      
      if (queryParams?.provider && queryParams?.success === 'true') {
        console.log(`[Auth] ${queryParams.provider} login successful`);
        const user = mockUsers[0];
        setUser(user);
        router.replace('/dashboard');
      } else if (queryParams?.error) {
        Alert.alert('Error', queryParams.error as string || 'Authentication failed');
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [setUser]);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    try {
      setIsLoading(true);
      
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
          const user = mockUsers[0];
          setUser(user);
          router.replace('/dashboard');
        }
      } else if (result.type === 'cancel') {
        console.log(`[Auth] ${provider} login cancelled`);
      }
    } catch (error) {
      console.error(`[Auth] ${provider} login error:`, error);
      Alert.alert('Error', `Failed to sign in with ${provider}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        <Wrench size={40} color="#2563EB" strokeWidth={2.5} />
        <Text style={styles.title}>Legacy Prime</Text>
        <Text style={styles.subtitle}>Manage projects easily.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity 
          style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
          onPress={() => handleSocialLogin('google')}
          disabled={isLoading}
        >
          <Text style={styles.socialButtonText}>{isLoading ? 'Loading...' : 'Sign in with Google'}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.socialButton, styles.appleButton, isLoading && styles.appleButtonDisabled]}
          onPress={() => handleSocialLogin('apple')}
          disabled={isLoading}
        >
          <Text style={[styles.socialButtonText, styles.appleButtonText]}>{isLoading ? 'Loading...' : 'Sign in with Apple'}</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or with email</Text>
          <View style={styles.dividerLine} />
        </View>

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
          <Text style={styles.loginButtonText}>{isLoading ? 'Loading...' : 'Login'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
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
