import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';

// CRITICAL: must be called at module level (outside component) so it runs
// synchronously when this page is loaded inside ASWebAuthenticationSession on iOS.
// It signals the native browser modal to close and passes the URL back to
// WebBrowser.openAuthSessionAsync in login.tsx.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const { user: currentUser, setUser, setCompany } = useApp();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // If the user is already authenticated, this callback was triggered by a
      // connect-account flow from the profile page (Expo received the deep link
      // in parallel with WebBrowser.openAuthSessionAsync). Do NOT process it as
      // a new login — doConnectGoogle in profile.tsx owns this token exchange.
      if (currentUser) return;
      // Parse hash tokens from URL (web only — native uses deep links handled by Supabase)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const errorCode = params.get('error');
        const errorDescription = params.get('error_description');

        if (errorCode) {
          setErrorMsg(errorDescription || 'Authentication failed. Please try again.');
          setStatus('error');
          return;
        }

        if (accessToken && refreshToken) {
          // ── Web Google-connect flow ──────────────────────────────────────────
          // When the user clicks "Connect Google" from the profile page on web,
          // we store intent in sessionStorage before redirecting to Google.
          // On return, handle the connect logic here BEFORE setting any session.
          const connectIntent = sessionStorage.getItem('profile_connect_intent');
          const connectUserId  = sessionStorage.getItem('profile_connect_userId');

          if (connectIntent === 'google' && connectUserId) {
            sessionStorage.removeItem('profile_connect_intent');
            sessionStorage.removeItem('profile_connect_userId');
            window.history.replaceState(null, '', window.location.pathname);

            // Decode email from JWT WITHOUT calling setSession() so the original
            // user's session in storage is never overwritten on conflict.
            let googleEmail: string | null = null;
            try {
              const payload = JSON.parse(atob(accessToken.split('.')[1]));
              googleEmail = payload.email ?? null;
            } catch {}

            if (!googleEmail) {
              sessionStorage.setItem('google_connect_error', 'Could not read Google account info. Please try again.');
              router.replace('/profile' as any);
              return;
            }

            // Check if this Google email already belongs to a different account.
            const { data: taken } = await supabase
              .from('users')
              .select('id')
              .eq('email', googleEmail)
              .neq('id', connectUserId)
              .maybeSingle();

            if (taken) {
              sessionStorage.setItem(
                'google_connect_error',
                `The Google account "${googleEmail}" is already registered to a different LegacyPrime account. Please choose a different Google account.`,
              );
              router.replace('/profile' as any);
              return;
            }

            // No conflict — safe to establish session, update email, then sign out
            // so the user re-authenticates cleanly with Google.
            const { data: sd } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (!sd?.session) {
              sessionStorage.setItem('google_connect_error', 'Failed to establish session. Please try again.');
              router.replace('/profile' as any);
              return;
            }

            await supabase.from('users').update({ email: googleEmail }).eq('id', connectUserId);
            await supabase.auth.signOut();
            router.replace('/(auth)/login' as any);
            return;
          }
          // ── End web connect flow ─────────────────────────────────────────────

          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError || !sessionData.session) {
            setErrorMsg('Failed to establish session. Please try logging in again.');
            setStatus('error');
            return;
          }

          // Clean the hash from the URL
          window.history.replaceState(null, '', window.location.pathname);

          const authUserId = sessionData.session.user.id;
          await completeLogin(authUserId);
          return;
        }
      }

      // Fallback: check if Supabase already picked up the session (native deep-link flow)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await completeLogin(session.user.id);
        return;
      }

      setErrorMsg('No authentication tokens found. Please try logging in again.');
      setStatus('error');
    } catch (e: any) {
      setErrorMsg(e.message || 'An unexpected error occurred.');
      setStatus('error');
    }
  };

  const completeLogin = async (authUserId: string) => {
    // Get the authenticated user's email to look up in our users table.
    // Google OAuth creates a different Supabase auth UUID than an existing
    // email/password account, so we match by email not by ID.
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const email = authUser?.email;

    if (!email) {
      setErrorMsg('Could not retrieve account email. Please try again.');
      setStatus('error');
      return;
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('*, companies(*)')
      .eq('email', email)
      .single();

    if (!userProfile) {
      // New Google user — keep session active, redirect to signup with
      // email + auth ID so signup can create DB records without calling signUp()
      const googleName = authUser?.user_metadata?.full_name
        || authUser?.user_metadata?.name
        || '';
      router.replace({
        pathname: '/(auth)/signup',
        params: { email, googleAuthId: authUserId, googleName },
      } as any);
      return;
    }

    if (!userProfile.is_active) {
      await supabase.auth.signOut();
      setErrorMsg('Your account is pending approval from your administrator.');
      setStatus('error');
      return;
    }

    // @ts-ignore — companies is a joined object
    const company = userProfile.companies ?? null;

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
    setCompany(company);

    router.replace('/(tabs)/dashboard');
  };

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Text style={styles.link} onPress={() => router.replace('/(auth)/login')}>
          Back to Login
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.loadingText}>Completing sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    gap: 16,
  },
  loadingText: { fontSize: 16, color: '#6B7280' },
  errorText: { fontSize: 16, color: '#DC2626', textAlign: 'center', lineHeight: 24 },
  link: { fontSize: 16, color: '#2563EB', fontWeight: '600' },
});
