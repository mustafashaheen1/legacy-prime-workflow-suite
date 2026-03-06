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
      // Native only: if user is already authenticated, this callback was triggered
      // by a connect-account deep link firing in parallel with openAuthSessionAsync.
      // doConnectGoogle in profile.tsx owns that token exchange — skip here.
      // On web we always proceed: the original session loads from localStorage fast
      // enough that currentUser is already set, but we still need to run the
      // sessionStorage connect-intent check below.
      if (Platform.OS !== 'web' && currentUser) return;
      // Web OAuth callback handling
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // ── Step 1: check for profile connect intent BEFORE touching any session ──
        // This must come first — Supabase may have already auto-set the Google
        // session internally by the time this code runs, so we cannot rely on
        // "no session yet" as a signal that we're in the normal login flow.
        const connectIntent = sessionStorage.getItem('profile_connect_intent');
        const connectUserId  = sessionStorage.getItem('profile_connect_userId');
        const origAt = sessionStorage.getItem('profile_orig_at');
        const origRt = sessionStorage.getItem('profile_orig_rt');

        if (connectIntent === 'google' && connectUserId) {
          // Clean up all connect-flow sessionStorage keys
          ['profile_connect_intent', 'profile_connect_userId', 'profile_orig_at', 'profile_orig_rt']
            .forEach(k => sessionStorage.removeItem(k));
          window.history.replaceState(null, '', window.location.pathname);

          // abort: the original user's session was NEVER touched — detectSessionInUrl:false
          // means Supabase ignores the hash tokens on page load. So we just store
          // the error in sessionStorage and redirect back to /profile where the
          // original user is still active and the Google card will show the message.
          const abort = async (msg: string) => {
            sessionStorage.setItem('google_connect_error', msg);
            router.replace('/profile' as any);
          };

          // Get Google email: try hash → query params → already-set session
          // (Supabase PKCE auto-exchanges the code before our code runs, so the
          // access_token may no longer be in the URL — read from session instead)
          const hp = new URLSearchParams(window.location.hash.substring(1));
          const qp = new URLSearchParams(window.location.search.substring(1));
          const accessToken = hp.get('access_token') || qp.get('access_token');

          let googleEmail: string | null = null;
          if (accessToken) {
            try { googleEmail = JSON.parse(atob(accessToken.split('.')[1])).email ?? null; } catch {}
          }
          if (!googleEmail) {
            const { data: { session: s } } = await supabase.auth.getSession();
            googleEmail = s?.user?.email ?? null;
          }

          if (!googleEmail) {
            await abort('Could not read Google account info. Please try again.');
            return;
          }

          // Conflict check
          const { data: taken } = await supabase
            .from('users').select('id')
            .eq('email', googleEmail).neq('id', connectUserId)
            .maybeSingle();

          if (taken) {
            await abort(
              `The Google account "${googleEmail}" is already registered to a different LegacyPrime account. Please go back to login and sign in with your original account.`,
            );
            return;
          }

          // No conflict — establish session if needed, update email, sign out to re-auth
          if (accessToken) {
            const refreshToken = hp.get('refresh_token') || qp.get('refresh_token');
            if (refreshToken) {
              await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            }
          }
          await supabase.from('users').update({ email: googleEmail }).eq('id', connectUserId);
          await supabase.auth.signOut();
          router.replace('/(auth)/login' as any);
          return;
        }
        // ── End connect flow ─────────────────────────────────────────────────

        // Normal login flow — parse tokens from URL hash
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
