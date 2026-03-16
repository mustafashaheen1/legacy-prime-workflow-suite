import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { compressImage } from '@/lib/upload-utils';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path } from 'react-native-svg';
import { useApp } from '@/contexts/AppContext';
import { getRoleDisplayName } from '@/lib/permissions';
import { auth, supabase } from '@/lib/supabase';
import { Camera, Mail, Briefcase, Building2, LogOut, Phone, KeyRound, ChevronRight, CheckCircle, Link } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const { user, company, setUser, logout } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  // Local URI for instant preview — shown immediately after pick, before S3 URL resolves
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);
  const [resetCooldown, setResetCooldown] = useState<number>(0);
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState<boolean>(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean>(false);

  // Phone connect flow: idle → enter-phone → enter-otp → success | unlink-phone
  const [phoneStep, setPhoneStep] = useState<'idle' | 'enter-phone' | 'enter-otp' | 'success' | 'unlink-phone'>('idle');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [phoneLoading, setPhoneLoading] = useState<boolean>(false);
  const [phoneError, setPhoneError] = useState<string>('');

  // Google connect inline confirmation
  const [showGoogleConfirm, setShowGoogleConfirm] = useState<boolean>(false);
  const [googleConnectError, setGoogleConnectError] = useState<string>('');
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState<boolean>(false);
  const [googleUnlinkError, setGoogleUnlinkError] = useState<string>('');

  // Apple
  const [isAppleLinked, setIsAppleLinked] = useState<boolean>(false);
  const [showAppleConfirm, setShowAppleConfirm] = useState<boolean>(false);
  const [isConnectingApple, setIsConnectingApple] = useState<boolean>(false);
  const [appleConnectError, setAppleConnectError] = useState<string>('');
  const [isUnlinkingApple, setIsUnlinkingApple] = useState<boolean>(false);
  const [appleUnlinkError, setAppleUnlinkError] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const providers: string[] = data?.user?.app_metadata?.providers ?? [];
      setIsGoogleLinked(providers.includes('google'));
      setIsAppleLinked(providers.includes('apple'));
    });

    // On web, auth/callback.tsx stores any connect-flow error in sessionStorage
    // (the page fully reloads during OAuth, so we can't pass state directly).
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const err = sessionStorage.getItem('google_connect_error');
      if (err) {
        sessionStorage.removeItem('google_connect_error');
        setGoogleConnectError(err);
        setShowGoogleConfirm(true); // open the card so the error is visible
      }
    }
  }, []);

  if (!user) {
    return null;
  }

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

  const doUpload = async (imageUri: string, errorKey: string = 'profile.photoUploadError') => {
    setIsUploadingPhoto(true);
    // Show local image instantly — don't wait for S3 round-trip
    setLocalAvatarUri(imageUri);
    try {
      console.log('[Profile] Uploading profile picture to S3...');

      let imageData: string;
      if (Platform.OS === 'web') {
        // Resolve to a raw data URL first (handles both data: and blob: inputs)
        let rawDataUrl: string;
        if (imageUri.startsWith('data:')) {
          rawDataUrl = imageUri;
        } else {
          // blob: URL — fetch and convert (only used when allowsEditing is off)
          const response = await fetch(imageUri);
          const blob = await response.blob();
          rawDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }

        // Compress via canvas to JPEG 400×400 @ 0.85 quality
        // Raw data URLs from the browser picker can be 5–20 MB — must reduce
        // before hitting the API's 10 MB body limit
        imageData = await new Promise<string>((resolve, reject) => {
          const img = new (window as any).Image();
          img.onload = () => {
            const MAX = 400;
            const scale = Math.min(MAX / img.width, MAX / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas unavailable')); return; }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = () => reject(new Error('Failed to load image for compression'));
          img.src = rawDataUrl;
        });
      } else {
        // Native: compress to JPEG, get raw base64, wrap in data URL
        const { base64 } = await compressImage(imageUri, { maxWidth: 400, maxHeight: 400, quality: 0.85 });
        imageData = `data:image/jpeg;base64,${base64}`;
      }

      const uploadResponse = await fetch(`${API_BASE}/api/upload-profile-picture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, userId: user.id }),
      });

      // Guard against non-JSON error responses (e.g. 413 "Request Entity Too Large")
      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Upload failed (${uploadResponse.status}): ${errText}`);
      }

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload profile picture');
      }

      console.log('[Profile] Profile picture uploaded successfully:', uploadResult.url);
      // Replace local preview with the permanent S3 URL
      setLocalAvatarUri(uploadResult.url);
      setUser({ ...user, avatar: uploadResult.url });
      Alert.alert(t('common.success'), t('profile.photoUpdated'));
    } catch (error: any) {
      console.error('[Profile] Error uploading profile picture:', error);
      // Revert local preview on failure
      setLocalAvatarUri(null);
      Alert.alert(t('common.error'), error.message || t(errorKey));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('profile.photoPermissionRequired'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]) {
        await doUpload(result.assets[0].uri, 'profile.photoUploadError');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('profile.photoUploadError'));
      setIsUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('profile.cameraPermissionRequired'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]) {
        await doUpload(result.assets[0].uri, 'profile.photoTakeError');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error'), t('profile.photoTakeError'));
      setIsUploadingPhoto(false);
    }
  };

  const handleChangePhoto = () => {
    if (Platform.OS === 'web') {
      // Alert.alert with multiple buttons is a no-op on web (falls back to window.alert).
      // Only gallery is available on web anyway — go straight to the picker.
      handlePickImage();
      return;
    }

    Alert.alert(
      t('profile.changePhotoTitle'),
      t('profile.selectOption'),
      [
        { text: t('profile.takePhoto'), onPress: handleTakePhoto },
        { text: t('profile.selectFromGallery'), onPress: handlePickImage },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const startResetCooldown = (seconds: number) => {
    setResetCooldown(seconds);
    const interval = setInterval(() => {
      setResetCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResetPassword = async () => {
    if (resetCooldown > 0) return;
    setIsSendingReset(true);
    try {
      const result = await auth.resetPassword(user.email);
      if (result.success) {
        setResetEmailSent(true);
        startResetCooldown(60);
      } else {
        // Parse "you can only request this after X seconds" from Supabase
        const match = result.error?.match(/after (\d+) second/);
        if (match) {
          const secs = parseInt(match[1], 10);
          startResetCooldown(secs);
          Alert.alert('Please Wait', `You can request another reset link in ${secs} seconds.`);
        } else {
          Alert.alert('Error', result.error || 'Failed to send reset email. Please try again.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleConnectGoogle = () => {
    setGoogleConnectError('');
    setGoogleUnlinkError('');
    setShowGoogleConfirm(prev => !prev);
  };

  const handleUnlinkGoogle = async () => {
    setIsUnlinkingGoogle(true);
    setGoogleUnlinkError('');
    try {
      const { data: identitiesData, error: idError } = await supabase.auth.getUserIdentities();
      if (idError) throw idError;
      const identities = identitiesData?.identities ?? [];
      if (identities.length <= 1) {
        setGoogleUnlinkError('Add another sign-in method (password or phone) before unlinking Google.');
        return;
      }
      const googleIdentity = identities.find(i => i.provider === 'google');
      if (!googleIdentity) { setGoogleUnlinkError('No Google identity found.'); return; }
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(googleIdentity);
      if (unlinkError) throw unlinkError;
      setIsGoogleLinked(false);
      setShowGoogleConfirm(false);
    } catch (e: any) {
      setGoogleUnlinkError(e.message || 'Failed to unlink Google account.');
    } finally {
      setIsUnlinkingGoogle(false);
    }
  };

  const handleUnlinkApple = async () => {
    setIsUnlinkingApple(true);
    setAppleUnlinkError('');
    try {
      const { data: identitiesData, error: idError } = await supabase.auth.getUserIdentities();
      if (idError) throw idError;
      const identities = identitiesData?.identities ?? [];
      if (identities.length <= 1) {
        setAppleUnlinkError('Add another sign-in method before unlinking Apple ID.');
        return;
      }
      const appleIdentity = identities.find(i => i.provider === 'apple');
      if (!appleIdentity) { setAppleUnlinkError('No Apple identity found.'); return; }
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(appleIdentity);
      if (unlinkError) throw unlinkError;
      setIsAppleLinked(false);
      setShowAppleConfirm(false);
    } catch (e: any) {
      setAppleUnlinkError(e.message || 'Failed to unlink Apple ID.');
    } finally {
      setIsUnlinkingApple(false);
    }
  };

  const doConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    setGoogleConnectError('');
    try {
      // Snapshot the current session BEFORE opening the browser.
      // Supabase may auto-process the incoming deep link and replace the active
      // session with the Google user's session before we can validate anything.
      // If validation fails we use these tokens to restore the original session.
      const { data: { session: originalSession } } = await supabase.auth.getSession();

      const redirectTo = Platform.OS === 'web' ? undefined : 'legacyprime://auth/callback';
      const result = await auth.signInWithOAuth('google', redirectTo);
      if (!result.success || !result.url) {
        setGoogleConnectError(result.error || 'Could not start Google sign-in.');
        return;
      }

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          // Save the original session so auth/callback.tsx can restore it on conflict.
          // The page will fully reload during OAuth so we must persist this here.
          const { data: { session: origSession } } = await supabase.auth.getSession();
          sessionStorage.setItem('profile_connect_intent', 'google');
          sessionStorage.setItem('profile_connect_userId', user.id);
          if (origSession) {
            sessionStorage.setItem('profile_orig_at', origSession.access_token);
            sessionStorage.setItem('profile_orig_rt', origSession.refresh_token);
          }
        }
        window.location.href = result.url;
        return;
      }

      const browserResult = await WebBrowser.openAuthSessionAsync(result.url, 'legacyprime://auth/callback');
      if (browserResult.type !== 'success') {
        setIsConnectingGoogle(false);
        return;
      }

      const urlStr = (browserResult as any).url as string;
      const sepIdx = urlStr.indexOf('#') !== -1 ? urlStr.indexOf('#') : urlStr.indexOf('?');
      if (sepIdx === -1) { setGoogleConnectError('No tokens returned. Please try again.'); return; }

      const params = new URLSearchParams(urlStr.substring(sepIdx + 1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) { setGoogleConnectError('Missing tokens. Please try again.'); return; }

      // Decode the email from the JWT payload WITHOUT calling setSession() yet.
      // Even so, Supabase may have already auto-swapped the internal session via
      // deep-link handling — so we also restore the original session on any abort.
      let googleEmail: string | null = null;
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        googleEmail = payload.email ?? null;
      } catch {
        if (originalSession) await supabase.auth.setSession({ access_token: originalSession.access_token, refresh_token: originalSession.refresh_token });
        setGoogleConnectError('Could not read Google account info. Please try again.');
        return;
      }

      if (!googleEmail) {
        if (originalSession) await supabase.auth.setSession({ access_token: originalSession.access_token, refresh_token: originalSession.refresh_token });
        setGoogleConnectError('Could not retrieve Google account email.');
        return;
      }

      // Check if this Google email is already tied to a different account — BEFORE touching the session.
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', googleEmail)
        .neq('id', user.id)
        .maybeSingle();

      if (existingUser) {
        // Restore the original user's session — Supabase may have replaced it internally.
        if (originalSession) {
          await supabase.auth.setSession({ access_token: originalSession.access_token, refresh_token: originalSession.refresh_token });
        }
        setGoogleConnectError(
          `The Google account "${googleEmail}" is already registered to a different LegacyPrime account. ` +
          `Please choose a different Google account.`
        );
        return;
      }

      // Validation passed — safe to establish the Google session now.
      const { data: sessionData } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (!sessionData?.session) { setGoogleConnectError('Failed to establish Google session. Please try again.'); return; }

      const { error: updateError } = await supabase.from('users').update({ email: googleEmail }).eq('id', user.id);
      if (updateError) { setGoogleConnectError('Failed to link Google account. Please try again.'); return; }

      setIsGoogleLinked(true);
      setShowGoogleConfirm(false);
      // Sign out so user re-authenticates with Google
      await logout();
      router.replace('/(auth)/login');
    } catch (e: any) {
      setGoogleConnectError(e.message || 'Something went wrong.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const doConnectApple = async () => {
    setIsConnectingApple(true);
    setAppleConnectError('');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken } = credential;
      if (!identityToken) {
        setAppleConnectError('No identity token from Apple. Please try again.');
        return;
      }

      // Decode email from the identity token payload (Apple JWT always includes it)
      let appleEmail: string | null = null;
      try {
        const base64 = identityToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        appleEmail = JSON.parse(atob(base64)).email ?? null;
      } catch {}

      // Fallback: establish session to read email from Supabase
      if (!appleEmail) {
        const { data: { session: origSession } } = await supabase.auth.getSession();
        const { data: sessionData } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: identityToken,
        });
        appleEmail = sessionData?.session?.user?.email ?? null;
        // Restore original user session
        if (origSession) {
          await supabase.auth.setSession({
            access_token: origSession.access_token,
            refresh_token: origSession.refresh_token,
          });
        }
      }

      if (!appleEmail) {
        setAppleConnectError('Could not read Apple account email. Please try again.');
        return;
      }

      // Conflict check — make sure this Apple email isn't used by another account
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', appleEmail)
        .neq('id', user.id)
        .maybeSingle();

      if (existingUser) {
        setAppleConnectError(
          `The Apple ID "${appleEmail}" is already registered to a different LegacyPrime account. ` +
          `Please choose a different Apple ID.`
        );
        return;
      }

      // No conflict — establish Apple session, update email, sign out to re-auth
      await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken });
      await supabase.from('users').update({ email: appleEmail }).eq('id', user.id);
      setIsAppleLinked(true);
      setShowAppleConfirm(false);
      await logout();
      router.replace('/(auth)/login');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setAppleConnectError(e.message || 'Something went wrong.');
      }
    } finally {
      setIsConnectingApple(false);
    }
  };

  const handleConnectPhone = () => {
    setPhoneError('');
    if (phoneStep !== 'idle') {
      setPhoneStep('idle');
    } else if (user.phone) {
      // Already linked — show unlink confirmation
      setPhoneStep('unlink-phone');
    } else {
      setPhoneInput('');
      setOtpInput('');
      setPhoneStep('enter-phone');
    }
  };

  const handleUnlinkPhone = async () => {
    setPhoneLoading(true);
    setPhoneError('');
    try {
      const { error } = await supabase.from('users').update({ phone: null }).eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, phone: undefined });
      setPhoneStep('idle');
    } catch (e: any) {
      setPhoneError(e.message || 'Failed to unlink phone number.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length !== 10) {
      setPhoneError('Please enter a valid 10-digit US phone number.');
      return;
    }
    const e164 = `+1${digits}`;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) { setPhoneError(error.message); return; }
      setPhoneStep('enter-otp');
    } catch (e: any) {
      setPhoneError(e.message || 'Failed to send code.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpInput.length < 4) { setPhoneError('Please enter the verification code.'); return; }
    const e164 = `+1${phoneInput.replace(/\D/g, '')}`;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otpInput, type: 'sms' });
      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('expired') || msg.includes('invalid')) {
          setPhoneError('Code expired or invalid. Please request a new one.');
          setPhoneStep('enter-phone');
        } else {
          setPhoneError(error.message);
        }
        return;
      }
      // @ts-ignore
      await supabase.from('users').update({ phone: e164 }).eq('id', user.id);
      setUser({ ...user, phone: e164 });
      setPhoneStep('success');
    } catch (e: any) {
      setPhoneError(e.message || 'Verification failed.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
      <Stack.Screen
        options={{
          title: t('profile.title'),
          headerStyle: {
            backgroundColor: '#2563EB',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '700' as const,
          },
        }}
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.headerSection}>
          <View style={styles.avatarContainer}>
            {(localAvatarUri || user.avatar) ? (
              Platform.OS === 'web' ? (
                // expo-image on web doesn't reliably render data: URLs or freshly
                // uploaded S3 URLs — use a native <img> element which always works
                // @ts-ignore – HTML element valid in React Native Web context
                <img
                  src={localAvatarUri || user.avatar}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    border: '4px solid #FFFFFF',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <Image
                  key={localAvatarUri || user.avatar}
                  source={{ uri: localAvatarUri || user.avatar }}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="none"
                />
              )
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editPhotoButton}
              onPress={handleChangePhoto}
              disabled={isUploadingPhoto}
            >
              <Camera size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{user.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{getRoleDisplayName(user.role)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Mail size={20} color="#2563EB" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('profile.email')}</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Briefcase size={20} color="#2563EB" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('profile.role')}</Text>
                <Text style={styles.infoValue}>{getRoleDisplayName(user.role)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Building2 size={20} color="#2563EB" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('profile.company')}</Text>
                <Text style={styles.infoValue}>{company?.name || 'N/A'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account & Security</Text>
          <View style={styles.infoCard}>

            {/* Change Password */}
            <TouchableOpacity style={styles.actionItem} onPress={handleResetPassword} disabled={isSendingReset || resetCooldown > 0}>
              <View style={[styles.infoIcon, { backgroundColor: '#FFF7ED' }]}>
                {isSendingReset ? <ActivityIndicator size="small" color="#EA580C" /> : <KeyRound size={20} color="#EA580C" />}
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.actionLabel}>Change Password</Text>
                <Text style={styles.actionSub}>
                  {resetCooldown > 0
                    ? `Resend available in ${resetCooldown}s`
                    : `Send a reset link to ${user.email}`}
                </Text>
              </View>
              {resetCooldown > 0
                ? <Text style={styles.cooldownText}>{resetCooldown}s</Text>
                : <ChevronRight size={18} color="#9CA3AF" />}
            </TouchableOpacity>

            {/* Inbox guidance — shown after reset email sent */}
            {resetEmailSent && (
              <View style={styles.inboxCard}>
                <CheckCircle size={20} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inboxTitle}>Check your inbox</Text>
                  <Text style={styles.inboxSub}>
                    We sent a password reset link to{'\n'}
                    <Text style={styles.inboxEmail}>{user.email}</Text>
                  </Text>
                  <Text style={styles.inboxHint}>
                    {resetCooldown > 0
                      ? `Didn't receive it? Resend in ${resetCooldown}s`
                      : "Didn't receive it?"}
                  </Text>
                  {resetCooldown === 0 && (
                    <TouchableOpacity onPress={handleResetPassword} disabled={isSendingReset}>
                      <Text style={styles.inboxResend}>
                        {isSendingReset ? 'Sending...' : 'Resend email'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => setResetEmailSent(false)}>
                  <Text style={styles.inboxDismiss}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider} />

            {/* Connect Phone */}
            <TouchableOpacity style={styles.actionItem} onPress={handleConnectPhone} disabled={phoneLoading}>
              <View style={[styles.infoIcon, { backgroundColor: user.phone ? '#F0FDF4' : '#F9FAFB' }]}>
                <Phone size={20} color={user.phone ? '#16A34A' : '#6B7280'} />
              </View>
              <View style={styles.infoContent}>
                <View style={styles.actionLabelRow}>
                  <Text style={styles.actionLabel}>Phone Number</Text>
                  {user.phone && (
                    <View style={styles.linkedBadge}>
                      <CheckCircle size={12} color="#16A34A" />
                      <Text style={styles.linkedBadgeText}>Linked</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionSub}>
                  {user.phone ? user.phone : 'Not linked — tap to connect'}
                </Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Inline phone connect / unlink form */}
            {phoneStep !== 'idle' && (
              <View style={styles.connectForm}>
                {phoneStep === 'unlink-phone' && (
                  <>
                    <Text style={styles.connectFormTitle}>Unlink phone number</Text>
                    <Text style={styles.connectFormSub}>
                      {'Current: '}<Text style={{ fontWeight: '600', color: '#111827' }}>{user.phone}</Text>
                      {'\nRemoving this will prevent SMS sign-in with this number.'}
                    </Text>
                    {!!phoneError && <Text style={styles.connectError}>{phoneError}</Text>}
                    <View style={styles.connectActions}>
                      <TouchableOpacity style={styles.connectCancelBtn} onPress={() => setPhoneStep('idle')}>
                        <Text style={styles.connectCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.connectConfirmBtn, { backgroundColor: '#DC2626' }]} onPress={handleUnlinkPhone} disabled={phoneLoading}>
                        {phoneLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.connectConfirmText}>Unlink</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {phoneStep === 'enter-phone' && (
                  <>
                    <Text style={styles.connectFormTitle}>Enter your phone number</Text>
                    <Text style={styles.connectFormSub}>We'll send a 6-digit verification code via SMS.</Text>
                    <TextInput
                      style={[styles.connectInput, !!phoneError && styles.connectInputError]}
                      placeholder="10-digit US number (e.g. 5551234567)"
                      placeholderTextColor="#9CA3AF"
                      value={phoneInput}
                      onChangeText={(t) => { setPhoneError(''); setPhoneInput(t.replace(/\D/g, '').slice(0, 10)); }}
                      keyboardType="number-pad"
                      maxLength={10}
                      autoFocus
                    />
                    {!!phoneError && <Text style={styles.connectError}>{phoneError}</Text>}
                    <View style={styles.connectActions}>
                      <TouchableOpacity style={styles.connectCancelBtn} onPress={() => setPhoneStep('idle')}>
                        <Text style={styles.connectCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.connectConfirmBtn} onPress={handleSendOtp} disabled={phoneLoading}>
                        {phoneLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.connectConfirmText}>Send Code</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {phoneStep === 'enter-otp' && (
                  <>
                    <Text style={styles.connectFormTitle}>Enter verification code</Text>
                    <Text style={styles.connectFormSub}>Code sent to +1{phoneInput.replace(/\D/g, '')} via SMS.</Text>
                    <TextInput
                      style={[styles.connectInput, !!phoneError && styles.connectInputError]}
                      placeholder="6-digit code"
                      placeholderTextColor="#9CA3AF"
                      value={otpInput}
                      onChangeText={(t) => { setPhoneError(''); setOtpInput(t.replace(/\D/g, '').slice(0, 6)); }}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                    {!!phoneError && <Text style={styles.connectError}>{phoneError}</Text>}
                    <View style={styles.connectActions}>
                      <TouchableOpacity style={styles.connectCancelBtn} onPress={() => setPhoneStep('enter-phone')}>
                        <Text style={styles.connectCancelText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.connectConfirmBtn} onPress={handleVerifyOtp} disabled={phoneLoading}>
                        {phoneLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.connectConfirmText}>Verify & Link</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {phoneStep === 'success' && (
                  <View style={styles.connectSuccess}>
                    <CheckCircle size={20} color="#16A34A" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.connectSuccessTitle}>Phone number linked!</Text>
                      <Text style={styles.connectSuccessSub}>You can now sign in using +1{phoneInput.replace(/\D/g, '')}.</Text>
                    </View>
                    <TouchableOpacity onPress={() => setPhoneStep('idle')}>
                      <Text style={styles.inboxDismiss}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <View style={styles.divider} />

            {/* Connect Google */}
            <TouchableOpacity style={styles.actionItem} onPress={handleConnectGoogle} disabled={isConnectingGoogle}>
              <View style={[styles.infoIcon, { backgroundColor: isGoogleLinked ? '#F0FDF4' : '#F8FAFF' }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </Svg>
              </View>
              <View style={styles.infoContent}>
                <View style={styles.actionLabelRow}>
                  <Text style={styles.actionLabel}>Google Account</Text>
                  {isGoogleLinked && (
                    <View style={styles.linkedBadge}>
                      <CheckCircle size={12} color="#16A34A" />
                      <Text style={styles.linkedBadgeText}>Linked</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionSub}>
                  {isGoogleLinked ? 'Connected — tap for details' : 'Not linked — tap to connect'}
                </Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Inline Google confirmation / info card */}
            {showGoogleConfirm && (
              <View style={styles.connectForm}>
                {isGoogleLinked ? (
                  <>
                    <Text style={styles.connectFormTitle}>Google account is linked</Text>
                    <Text style={styles.connectFormSub}>You can sign in using "Continue with Google" on the login screen.</Text>
                    {!!googleUnlinkError && <Text style={styles.connectError}>{googleUnlinkError}</Text>}
                    <View style={styles.connectActions}>
                      <TouchableOpacity style={styles.connectCancelBtn} onPress={() => setShowGoogleConfirm(false)}>
                        <Text style={styles.connectCancelText}>Close</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.connectConfirmBtn, { backgroundColor: '#DC2626' }]} onPress={handleUnlinkGoogle} disabled={isUnlinkingGoogle}>
                        {isUnlinkingGoogle ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.connectConfirmText}>Unlink Google</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.connectFormTitle}>Connect Google Account</Text>
                    <Text style={styles.connectFormSub}>
                      You'll be asked to sign in with Google. Your account email will be updated to your Google email, and you'll be signed out to re-login with Google.{'\n\n'}Your existing data is preserved.
                    </Text>
                    {!!googleConnectError && <Text style={styles.connectError}>{googleConnectError}</Text>}
                    <View style={styles.connectActions}>
                      <TouchableOpacity style={styles.connectCancelBtn} onPress={() => setShowGoogleConfirm(false)}>
                        <Text style={styles.connectCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.connectConfirmBtn} onPress={doConnectGoogle} disabled={isConnectingGoogle}>
                        {isConnectingGoogle
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={styles.connectConfirmText}>Connect Google</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Apple — iOS only */}
            {Platform.OS === 'ios' && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    setAppleUnlinkError('');
                    setAppleConnectError('');
                    setShowAppleConfirm(prev => !prev);
                  }}
                  disabled={isConnectingApple}
                >
                  <View style={[styles.infoIcon, { backgroundColor: isAppleLinked ? '#F0FDF4' : '#F9FAFB' }]}>
                    <Svg width={18} height={20} viewBox="0 0 24 24">
                      <Path fill={isAppleLinked ? '#16A34A' : '#111827'} d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.3.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </Svg>
                  </View>
                  <View style={styles.infoContent}>
                    <View style={styles.actionLabelRow}>
                      <Text style={styles.actionLabel}>Apple ID</Text>
                      {isAppleLinked && (
                        <View style={styles.linkedBadge}>
                          <CheckCircle size={12} color="#16A34A" />
                          <Text style={styles.linkedBadgeText}>Linked</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.actionSub}>
                      {isAppleLinked ? 'Connected — tap to manage' : 'Not linked — tap to connect'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {showAppleConfirm && (
                  <View style={styles.connectForm}>
                    {isAppleLinked ? (
                      <>
                        <Text style={styles.connectFormTitle}>Apple ID is linked</Text>
                        <Text style={styles.connectFormSub}>You can sign in using "Continue with Apple" on the login screen.</Text>
                        {!!appleUnlinkError && <Text style={styles.connectError}>{appleUnlinkError}</Text>}
                        <View style={styles.connectActions}>
                          <TouchableOpacity style={styles.connectCancelBtn} onPress={() => setShowAppleConfirm(false)}>
                            <Text style={styles.connectCancelText}>Close</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.connectConfirmBtn, { backgroundColor: '#DC2626' }]} onPress={handleUnlinkApple} disabled={isUnlinkingApple}>
                            {isUnlinkingApple ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.connectConfirmText}>Unlink Apple</Text>}
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.connectFormTitle}>Connect Apple ID</Text>
                        <Text style={styles.connectFormSub}>
                          You'll be asked to sign in with Apple. Your account email will be updated to your Apple ID email, and you'll be signed out to re-login with Apple.{'\n\n'}Your existing data is preserved.
                        </Text>
                        {!!appleConnectError && <Text style={styles.connectError}>{appleConnectError}</Text>}
                        <View style={styles.connectActions}>
                          <TouchableOpacity style={styles.connectCancelBtn} onPress={() => setShowAppleConfirm(false)}>
                            <Text style={styles.connectCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.connectConfirmBtn, { backgroundColor: '#000000' }]}
                            onPress={doConnectApple}
                            disabled={isConnectingApple}
                          >
                            {isConnectingApple
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.connectConfirmText}>Connect Apple</Text>}
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <LogOut size={20} color="#DC2626" />
                <Text style={styles.logoutText}>{t('settings.logout')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#2563EB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    backgroundColor: '#2563EB',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarInitials: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#16A34A',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  inboxCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 12,
  },
  inboxTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#15803D',
    marginBottom: 3,
  },
  inboxSub: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 6,
  },
  inboxEmail: {
    fontWeight: '600' as const,
    color: '#111827',
  },
  inboxHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  inboxResend: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#2563EB',
    marginTop: 2,
  },
  inboxDismiss: {
    fontSize: 14,
    color: '#9CA3AF',
    padding: 4,
  },
  cooldownText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    minWidth: 32,
    textAlign: 'right',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#111827',
  },
  actionSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  linkedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#16A34A',
  },
  connectForm: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  connectFormTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  connectFormSub: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  connectInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  connectActions: {
    flexDirection: 'row',
    gap: 8,
  },
  connectCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  connectCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  connectConfirmBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  connectConfirmText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  connectInputError: {
    borderColor: '#EF4444',
  },
  connectError: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: -8,
    marginBottom: 8,
  },
  connectSuccess: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  connectSuccessTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#15803D',
    marginBottom: 2,
  },
  connectSuccessSub: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 17,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
});
