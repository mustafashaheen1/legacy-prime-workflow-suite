import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect } from 'react';
import { Check } from 'lucide-react-native';
import { StripeProvider, useStripe } from '@/lib/stripe-provider';
import { StripePaymentForm } from '@/components/StripePaymentForm';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

function SubscriptionContent() {
  const { setSubscription, setUser, setCompany } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const stripe = useStripe();
  
  const params = useLocalSearchParams<{
    name?: string;
    email?: string;
    password?: string;
    companyName?: string;
    employeeCount?: string;
    accountType?: string;
    companyCode?: string;
    companyId?: string;
    address?: string;
    postalCode?: string;
  }>();

  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [showPaymentForm, setShowPaymentForm] = useState<boolean>(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!params.accountType) {
      console.log('[Subscription] No account type provided, redirecting to signup');
      router.replace('/(auth)/signup');
    }
  }, [params.accountType]);

  const employeeCount = parseInt(params.employeeCount || '2');
  
  const pricing = useMemo(() => {
    const basePriceBasic = 10;
    const basePricePremium = 20;
    const pricePerEmployeeBasic = 8;
    const pricePerEmployeePremium = 15;

    return {
      basic: basePriceBasic + (employeeCount - 1) * pricePerEmployeeBasic,
      premium: basePricePremium + (employeeCount - 1) * pricePerEmployeePremium,
    };
  }, [employeeCount]);

  const completeSubscription = async () => {
    console.log('[Subscription] Completing subscription setup...');

    // Update subscription in storage
    await setSubscription({
      type: selectedPlan,
      startDate: new Date().toISOString(),
    });

    console.log('[Subscription] Subscription updated successfully');

    // Load user + company into AppContext now that payment is complete
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && params.companyId) {
        const [{ data: userData }, { data: companyData }] = await Promise.all([
          supabase.from('users').select('*').eq('id', session.user.id).single(),
          supabase.from('companies').select('*').eq('id', params.companyId).single(),
        ]);
        if (userData) {
          setUser({
            id: userData.id, name: userData.name, email: userData.email,
            role: userData.role, companyId: userData.company_id || '',
            isActive: userData.is_active, createdAt: userData.created_at,
            phone: userData.phone || undefined,
            address: userData.address || undefined,
            hourlyRate: userData.hourly_rate || undefined,
            avatar: userData.avatar || undefined,
          } as any);
        }
        if (companyData) {
          setCompany({
            id: companyData.id, name: companyData.name,
            brandColor: companyData.brand_color || '#2563EB',
            subscriptionStatus: companyData.subscription_status,
            subscriptionPlan: companyData.subscription_plan,
            subscriptionStartDate: companyData.subscription_start_date,
            employeeCount: companyData.employee_count,
            companyCode: companyData.company_code || undefined,
            settings: companyData.settings,
            createdAt: companyData.created_at,
            updatedAt: companyData.updated_at,
            logo: companyData.logo || undefined,
            address: companyData.address || undefined,
            postalCode: companyData.postal_code || undefined,
            twilioPhoneNumber: companyData.twilio_phone_number || undefined,
          } as any);
        }
        console.log('[Subscription] User + company loaded into context');
      }
    } catch (err) {
      console.warn('[Subscription] Could not load user/company context (non-fatal):', err);
    }

    // Provision a unique Twilio number for this company based on their location
    if (params.companyId && params.address && params.postalCode) {
      try {
        const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
        console.log('[Subscription] Provisioning Twilio number...');
        const twilioRes = await fetch(`${API_BASE}/api/provision-twilio-number`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: params.companyId,
            address: params.address,
            postalCode: params.postalCode,
          }),
        });
        const twilioData = await twilioRes.json();
        if (twilioData.success) {
          console.log('[Subscription] Twilio number assigned:', twilioData.phoneNumber);
        } else {
          console.warn('[Subscription] Twilio provisioning failed (non-fatal):', twilioData.error);
        }
      } catch (err) {
        console.warn('[Subscription] Twilio provisioning error (non-fatal):', err);
      }
    }

    // Navigate to dashboard
    if (Platform.OS === 'web') {
      router.replace('/(tabs)/dashboard');
    } else {
      Alert.alert(
        'Subscription Activated',
        `Your ${selectedPlan} subscription has been activated successfully!\n\nYou can now access all features.`,
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/(tabs)/dashboard'),
          },
        ]
      );
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    console.log('[Subscription] Payment successful!', paymentIntentId);
    setShowPaymentForm(false);
    setIsProcessing(true);

    try {
      // Activate the Stripe subscription with recurring billing
      console.log('[Subscription] Activating subscription...');
      const activateResponse = await fetch(`${API_BASE}/api/activate-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId,
          companyId: params.companyId || '',
          email: params.email || '',
          companyName: params.companyName || '',
          subscriptionPlan: selectedPlan,
          employeeCount: parseInt(params.employeeCount || '2'),
        }),
      });
      const result = await activateResponse.json();

      if (!activateResponse.ok) {
        throw new Error(result.error || 'Failed to activate subscription');
      }

      console.log('[Subscription] Subscription activated:', result);

      // Complete the signup flow
      await completeSubscription();
    } catch (error: any) {
      console.error('[Subscription] Error activating subscription:', error);
      Alert.alert('Error', `Failed to activate subscription: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const handlePaymentError = (error: string) => {
    console.error('[Subscription] Payment error:', error);
    Alert.alert('Payment Failed', error);
    setShowPaymentForm(false);
    setIsProcessing(false);
  };

  const handleCreateAccount = async () => {
    try {
      setIsProcessing(true);
      console.log('[Subscription] Starting account creation...');

      // On web (Vercel), the API is on the same domain, so we don't need env vars
      const isOnline = Platform.OS === 'web' || (!offlineMode && process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);

      let paymentIntentResult: { clientSecret?: string; paymentIntentId: string } = {
        paymentIntentId: `offline_${Date.now()}`,
      };

      if (isOnline && process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
        console.log('[Subscription] Creating payment intent with Stripe...');
        try {
          const response = await fetch(`${API_BASE}/api/stripe-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: pricing[selectedPlan],
              currency: 'usd',
              companyName: params.companyName || 'New Company',
              email: params.email || 'admin@example.com',
              subscriptionPlan: selectedPlan,
            }),
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Failed to create payment intent');
          }

          paymentIntentResult = {
            clientSecret: result.clientSecret || undefined,
            paymentIntentId: result.paymentIntentId,
          };
          console.log('[Subscription] Payment intent created:', paymentIntentResult.paymentIntentId);
        } catch (error) {
          console.error('[Subscription] Failed to create payment intent:', error);
          // Continue without payment for now
        }
      } else {
        console.log('[Subscription] Skipping Stripe payment (offline mode or no Stripe key)');
      }

      // Handle payment based on platform
      if (Platform.OS === 'web' && paymentIntentResult.clientSecret) {
        // On web, show the payment form instead of auto-completing
        console.log('[Subscription] Web platform - showing payment form');
        setPaymentClientSecret(paymentIntentResult.clientSecret);
        setShowPaymentForm(true);
        setIsProcessing(false);
        return; // Don't navigate yet - wait for payment
      } else if (!offlineMode && Platform.OS !== 'web' && stripe.initPaymentSheet && stripe.presentPaymentSheet && paymentIntentResult.clientSecret) {
        console.log('[Subscription] Initializing payment sheet...');
        const { error: initError } = await stripe.initPaymentSheet({
          paymentIntentClientSecret: paymentIntentResult.clientSecret || '',
          merchantDisplayName: 'Rork App',
          customerId: undefined,
          customerEphemeralKeySecret: undefined,
        });

        if (initError) {
          console.error('[Subscription] Error initializing payment sheet:', initError);
          Alert.alert(t('common.error'), t('subscription.paymentInitError'));
          return;
        }

        console.log('[Subscription] Presenting payment sheet...');
        const { error: presentError } = await stripe.presentPaymentSheet();

        if (presentError) {
          console.error('[Subscription] Error presenting payment sheet:', presentError);
          Alert.alert(t('subscription.paymentCancelled'), presentError.message);
          return;
        }

        console.log('[Subscription] Payment successful!');
      } else if (offlineMode) {
        console.log('[Subscription] Offline mode - Skipping payment');
      }

      // Only navigate if not web or offline mode (web waits for payment form completion)
      if (Platform.OS !== 'web' || offlineMode) {
        await completeSubscription();
      }
    } catch (error: any) {
      console.error('[Subscription] Error:', error);
      console.error('[Subscription] Error name:', error?.name);
      console.error('[Subscription] Error message:', error?.message);
      console.error('[Subscription] Error stack:', error?.stack?.substring(0, 500));

      let errorMessage = t('subscription.accountCreationError');
      let showOfflineOption = false;

      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('failed to fetch')) {
        errorMessage = t('subscription.connectionErrorMessage');
        showOfflineOption = true;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      if (showOfflineOption) {
        Alert.alert(
          t('subscription.connectionError'),
          errorMessage,
          [
            {
              text: t('subscription.configure'),
              onPress: () => {
                Alert.alert(
                  t('subscription.configurationRequired'),
                  t('subscription.configurationInstructions'),
                  [{ text: t('subscription.understood') }]
                );
              },
            },
            {
              text: t('subscription.continueWithoutPayment'),
              style: 'default' as const,
              onPress: () => {
                setOfflineMode(true);
                setTimeout(() => handleCreateAccount(), 100);
              },
            },
            {
              text: t('common.cancel'),
              style: 'cancel' as const,
            },
          ]
        );
      } else {
        Alert.alert(t('common.error'), errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!params.accountType) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('subscription.chooseYourPlan')}</Text>
        <Text style={styles.subtitle}>
          {t('subscription.forEmployees', { count: employeeCount })}
        </Text>

        <TouchableOpacity
          style={[
            styles.planCard,
            selectedPlan === 'basic' && styles.planCardSelected,
          ]}
          onPress={() => setSelectedPlan('basic')}
        >
          {selectedPlan === 'basic' && (
            <View style={styles.checkmark}>
              <Check size={20} color="#FFFFFF" />
            </View>
          )}
          <Text style={styles.planTitle}>{t('subscription.basicPlan')}</Text>
          <Text style={styles.planPrice}>${pricing.basic}{t('subscription.perMonthSuffix')}</Text>
          <Text style={styles.planDescription}>
            {t('subscription.priceDetail', { base: 10, perEmployee: 8, count: employeeCount - 1 })}
          </Text>
          <View style={styles.featuresContainer}>
            <Text style={styles.featureItem}>✓ {t('subscription.dashboardAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.crmAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.expensesAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.photosAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.estimatesAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.teamMembers', { count: employeeCount })}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.activeProjects', { count: 20 })}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.planCard,
            styles.premiumCard,
            selectedPlan === 'premium' && styles.planCardSelected,
          ]}
          onPress={() => setSelectedPlan('premium')}
        >
          {selectedPlan === 'premium' && (
            <View style={styles.checkmark}>
              <Check size={20} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>{t('subscription.mostPopular')}</Text>
          </View>
          <Text style={styles.planTitle}>{t('subscription.premiumPlan')}</Text>
          <Text style={styles.planPrice}>${pricing.premium}{t('subscription.perMonthSuffix')}</Text>
          <Text style={styles.planDescription}>
            {t('subscription.priceDetail', { base: 20, perEmployee: 15, count: employeeCount - 1 })}
          </Text>
          <View style={styles.featuresContainer}>
            <Text style={styles.featureItem}>✓ {t('subscription.allBasicFeatures')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.scheduleAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.chatAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.reportsAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.clockAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.teamMembers', { count: employeeCount })}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.unlimitedProjects')}</Text>
          </View>
        </TouchableOpacity>

        {showPaymentForm && paymentClientSecret && Platform.OS === 'web' ? (
          <StripePaymentForm
            clientSecret={paymentClientSecret}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            amount={pricing[selectedPlan]}
          />
        ) : (
          <TouchableOpacity
            style={[
              styles.continueButton,
              isProcessing && styles.continueButtonDisabled,
            ]}
            onPress={handleCreateAccount}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueButtonText}>
                {t('subscription.createAccount')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimer}>
            {t('subscription.securePayment')}
          </Text>
          <Text style={styles.testMode}>
            {t('subscription.testMode')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export default function SubscriptionScreen() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  // On web, no wrapper needed (StripePaymentForm handles its own Elements wrapper)
  if (Platform.OS === 'web') {
    return <SubscriptionContent />;
  }

  // On native without publishable key
  if (!publishableKey) {
    return <SubscriptionContent />;
  }

  // On native with publishable key
  return (
    <StripeProvider publishableKey={publishableKey}>
      <SubscriptionContent />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    position: 'relative' as const,
  },
  planCardSelected: {
    borderColor: '#2563EB',
  },
  premiumCard: {
    backgroundColor: '#F0F9FF',
  },
  checkmark: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularBadge: {
    position: 'absolute' as const,
    top: -12,
    left: 24,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textTransform: 'uppercase' as const,
  },
  planTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  featuresContainer: {
    gap: 8,
  },
  featureItem: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 4,
  },
  continueButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  continueButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  disclaimerContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  disclaimer: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#059669',
    textAlign: 'center',
    marginBottom: 4,
  },
  testMode: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
});
