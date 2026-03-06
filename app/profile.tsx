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
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
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
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);
  const [resetCooldown, setResetCooldown] = useState<number>(0);
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState<boolean>(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean>(false);

  // Phone connect flow: idle → enter-phone → enter-otp
  const [phoneStep, setPhoneStep] = useState<'idle' | 'enter-phone' | 'enter-otp'>('idle');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [phoneLoading, setPhoneLoading] = useState<boolean>(false);

  useEffect(() => {
    // Check if the current session is linked to Google
    supabase.auth.getUser().then(({ data }) => {
      const providers: string[] = data?.user?.app_metadata?.providers ?? [];
      setIsGoogleLinked(providers.includes('google'));
    });
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

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          t('common.error'),
          t('profile.photoPermissionRequired')
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setIsUploadingPhoto(true);
        const imageUri = result.assets[0].uri;

        try {
          console.log('[Profile] Uploading profile picture to S3...');

          // Convert image to base64
          let base64Image: string;
          if (Platform.OS === 'web') {
            // Web: Fetch and convert to base64
            const response = await fetch(imageUri);
            const blob = await response.blob();
            base64Image = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } else {
            // Mobile: Read file as base64
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            // Determine file extension
            const fileExtension = imageUri.split('.').pop() || 'jpg';
            base64Image = `data:image/${fileExtension};base64,${base64}`;
          }

          // Upload to S3 and update database
          const uploadResponse = await fetch('/api/upload-profile-picture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: base64Image,
              userId: user.id,
            }),
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload profile picture');
          }

          console.log('[Profile] Profile picture uploaded successfully:', uploadResult.url);

          // Update local user state with S3 URL
          const updatedUser = { ...user, avatar: uploadResult.url };
          await setUser(updatedUser);

          Alert.alert(t('common.success'), t('profile.photoUpdated'));
        } catch (error: any) {
          console.error('[Profile] Error uploading profile picture:', error);
          Alert.alert(t('common.error'), error.message || t('profile.photoUploadError'));
        } finally {
          setIsUploadingPhoto(false);
        }
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
        Alert.alert(
          t('common.error'),
          t('profile.cameraPermissionRequired')
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setIsUploadingPhoto(true);
        const imageUri = result.assets[0].uri;

        try {
          console.log('[Profile] Uploading profile picture to S3...');

          // Convert image to base64
          let base64Image: string;
          if (Platform.OS === 'web') {
            // Web: Fetch and convert to base64
            const response = await fetch(imageUri);
            const blob = await response.blob();
            base64Image = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } else {
            // Mobile: Read file as base64
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            // Determine file extension
            const fileExtension = imageUri.split('.').pop() || 'jpg';
            base64Image = `data:image/${fileExtension};base64,${base64}`;
          }

          // Upload to S3 and update database
          const uploadResponse = await fetch('/api/upload-profile-picture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: base64Image,
              userId: user.id,
            }),
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload profile picture');
          }

          console.log('[Profile] Profile picture uploaded successfully:', uploadResult.url);

          // Update local user state with S3 URL
          const updatedUser = { ...user, avatar: uploadResult.url };
          await setUser(updatedUser);

          Alert.alert(t('common.success'), t('profile.photoUpdated'));
        } catch (error: any) {
          console.error('[Profile] Error uploading profile picture:', error);
          Alert.alert(t('common.error'), error.message || t('profile.photoTakeError'));
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error'), t('profile.photoTakeError'));
      setIsUploadingPhoto(false);
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(
      t('profile.changePhotoTitle'),
      t('profile.selectOption'),
      [
        {
          text: t('profile.takePhoto'),
          onPress: handleTakePhoto,
        },
        {
          text: t('profile.selectFromGallery'),
          onPress: handlePickImage,
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
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
    Alert.alert(
      isGoogleLinked ? 'Google Account Linked' : 'Connect Google Account',
      isGoogleLinked
        ? 'Your account is already connected to Google. You can sign in using your Google account.'
        : `Your account email (${user.email}) will be updated to the email of the Google account you select. You will be signed out and must sign back in using Google.\n\nThis cannot be undone. Continue?`,
      isGoogleLinked
        ? [{ text: 'OK' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Connect', style: 'destructive', onPress: doConnectGoogle },
          ]
    );
  };

  const doConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const redirectTo = Platform.OS === 'web' ? undefined : 'legacyprime://auth/callback';
      const result = await auth.signInWithOAuth('google', redirectTo);
      if (!result.success || !result.url) {
        Alert.alert('Error', result.error || 'Could not start Google sign-in.');
        return;
      }

      let googleEmail: string | null = null;
      let googleAuthId: string | null = null;

      if (Platform.OS === 'web') {
        // Store intent then redirect — callback page will handle the update
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('profile_connect_intent', 'google');
          sessionStorage.setItem('profile_connect_userId', user.id);
        }
        window.location.href = result.url;
        return;
      } else {
        const browserResult = await WebBrowser.openAuthSessionAsync(result.url, 'legacyprime://auth/callback');
        if (browserResult.type !== 'success') return;

        const urlStr = (browserResult as any).url as string;
        const sepIdx = urlStr.indexOf('#') !== -1 ? urlStr.indexOf('#') : urlStr.indexOf('?');
        if (sepIdx === -1) return;

        const params = new URLSearchParams(urlStr.substring(sepIdx + 1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (!accessToken || !refreshToken) return;

        const { data: sessionData } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        googleEmail = sessionData?.session?.user?.email ?? null;
        googleAuthId = sessionData?.session?.user?.id ?? null;
      }

      if (!googleEmail) {
        Alert.alert('Error', 'Could not retrieve Google account email.');
        return;
      }

      // Update the users table email to the Google email
      const { error: updateError } = await supabase
        .from('users')
        .update({ email: googleEmail })
        .eq('id', user.id);

      if (updateError) {
        Alert.alert('Error', 'Failed to link Google account. Please try again.');
        return;
      }

      setIsGoogleLinked(true);
      Alert.alert(
        'Google Account Connected',
        `Your account is now linked to ${googleEmail}. You will be signed out. Sign back in using "Continue with Google".`,
        [{ text: 'Sign Out Now', onPress: () => { logout(); router.replace('/(auth)/login'); } }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleConnectPhone = () => {
    if (user.phone) {
      Alert.alert(
        'Phone Number Linked',
        `Your account is connected to ${user.phone}. To change it, tap "Update" below.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Update', onPress: () => { setPhoneInput(''); setOtpInput(''); setPhoneStep('enter-phone'); } },
        ]
      );
    } else {
      Alert.alert(
        'Connect Phone Number',
        'Link a phone number to your account so you can sign in using SMS verification. Your existing login stays unchanged.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => { setPhoneInput(''); setOtpInput(''); setPhoneStep('enter-phone'); } },
        ]
      );
    }
  };

  const handleSendOtp = async () => {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit US phone number.');
      return;
    }
    const e164 = `+1${digits}`;
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) { Alert.alert('Error', error.message); return; }
      setPhoneStep('enter-otp');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpInput.length < 4) { Alert.alert('Invalid Code', 'Please enter the verification code.'); return; }
    const e164 = `+1${phoneInput.replace(/\D/g, '')}`;
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otpInput, type: 'sms' });
      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('expired') || msg.includes('invalid')) {
          Alert.alert('Code Expired', 'This code has expired or is invalid. Please request a new one.');
          setPhoneStep('enter-phone');
        } else {
          Alert.alert('Error', error.message);
        }
        return;
      }
      // Update phone on the users table
      // @ts-ignore
      await supabase.from('users').update({ phone: e164 }).eq('id', user.id);
      setUser({ ...user, phone: e164 });
      setPhoneStep('idle');
      Alert.alert('Phone Linked', `Your account is now connected to ${e164}. You can sign in using phone verification.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
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
            {user.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                style={styles.avatar}
                contentFit="cover"
              />
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

            {/* Inline phone connect form */}
            {phoneStep !== 'idle' && (
              <View style={styles.connectForm}>
                {phoneStep === 'enter-phone' ? (
                  <>
                    <Text style={styles.connectFormTitle}>Enter your phone number</Text>
                    <Text style={styles.connectFormSub}>We'll send a 6-digit verification code via SMS.</Text>
                    <TextInput
                      style={styles.connectInput}
                      placeholder="10-digit US number"
                      placeholderTextColor="#9CA3AF"
                      value={phoneInput}
                      onChangeText={(t) => setPhoneInput(t.replace(/\D/g, '').slice(0, 10))}
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                    <View style={styles.connectActions}>
                      <TouchableOpacity style={styles.connectCancelBtn} onPress={() => setPhoneStep('idle')}>
                        <Text style={styles.connectCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.connectConfirmBtn} onPress={handleSendOtp} disabled={phoneLoading}>
                        {phoneLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.connectConfirmText}>Send Code</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.connectFormTitle}>Enter verification code</Text>
                    <Text style={styles.connectFormSub}>Sent to +1{phoneInput.replace(/\D/g, '')}</Text>
                    <TextInput
                      style={styles.connectInput}
                      placeholder="6-digit code"
                      placeholderTextColor="#9CA3AF"
                      value={otpInput}
                      onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
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
              </View>
            )}

            <View style={styles.divider} />

            {/* Connect Google */}
            <TouchableOpacity style={styles.actionItem} onPress={handleConnectGoogle} disabled={isConnectingGoogle}>
              <View style={[styles.infoIcon, { backgroundColor: isGoogleLinked ? '#F0FDF4' : '#F8FAFF' }]}>
                {isConnectingGoogle ? <ActivityIndicator size="small" color="#4285F4" /> : (
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </Svg>
                )}
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
                  {isGoogleLinked ? 'Your account is connected to Google' : 'Not linked — tap to connect'}
                </Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Apple — iOS only */}
            {Platform.OS === 'ios' && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.actionItem} disabled>
                  <View style={[styles.infoIcon, { backgroundColor: '#F9FAFB' }]}>
                    <Svg width={18} height={20} viewBox="0 0 24 24">
                      <Path fill="#111827" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.3.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </Svg>
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.actionLabel}>Apple ID</Text>
                    <Text style={styles.actionSub}>Coming soon</Text>
                  </View>
                </TouchableOpacity>
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
