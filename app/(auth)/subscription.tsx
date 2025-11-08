import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect } from 'react';
import { Check } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';

type StripeHook = {
  initPaymentSheet: (params: any) => Promise<{ error: any }>;
  presentPaymentSheet: () => Promise<{ error: any }>;
};

let StripeProvider: any = null;
let useStripe: () => StripeHook = () => ({
  initPaymentSheet: async () => ({ error: null }),
  presentPaymentSheet: async () => ({ error: null })
});

if (Platform.OS === 'web') {
  const webStub = require('@/lib/stripe-web-stub');
  StripeProvider = webStub.StripeProvider;
  useStripe = webStub.useStripe;
} else {
  try {
    const stripe = require('@stripe/stripe-react-native');
    StripeProvider = stripe.StripeProvider;
    useStripe = stripe.useStripe;
  } catch {
    console.log('[Subscription] Stripe not available on this platform');
  }
}

function SubscriptionContent() {
  const { setSubscription, setUser, setCompany } = useApp();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  
  const params = useLocalSearchParams<{
    name?: string;
    email?: string;
    password?: string;
    companyName?: string;
    employeeCount?: string;
    accountType?: string;
  }>();

  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [paymentReady, setPaymentReady] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const createCompanyMutation = trpc.companies.createCompany.useMutation();
  const createUserMutation = trpc.users.createUser.useMutation();
  const createPaymentIntentMutation = trpc.stripe.createPaymentIntent.useMutation();

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

  useEffect(() => {
    const initializePaymentSheet = async () => {
      if (!params.email || !params.companyName) {
        return;
      }

      if (Platform.OS === 'web') {
        console.log('[Subscription] Web platform - Stripe native not available');
        setPaymentReady(true);
        return;
      }

      try {
        console.log('[Subscription] Initializing payment sheet...');
        
        const paymentIntent = await createPaymentIntentMutation.mutateAsync({
          amount: pricing[selectedPlan],
          currency: 'usd',
          companyName: params.companyName,
          email: params.email,
          subscriptionPlan: selectedPlan,
        });

        const { error } = await initPaymentSheet({
          merchantDisplayName: 'Legacy Prime',
          paymentIntentClientSecret: paymentIntent.clientSecret || '',
          defaultBillingDetails: {
            email: params.email,
            name: params.name,
          },
        });

        if (error) {
          console.error('[Subscription] Payment sheet init error:', error);
          Alert.alert(t('common.error'), error.message);
        } else {
          setPaymentReady(true);
          console.log('[Subscription] Payment sheet ready');
        }
      } catch (error: any) {
        console.error('[Subscription] Payment intent error:', error);
        Alert.alert(t('common.error'), error.message || t('subscription.errorMessage'));
      }
    };

    initializePaymentSheet();
  }, [selectedPlan, params.email, params.companyName, params.name, pricing, createPaymentIntentMutation, initPaymentSheet, t]);

  const handleConfirmSubscription = async () => {
    if (!paymentReady) {
      Alert.alert(t('common.error'), t('subscription.paymentNotReady'));
      return;
    }

    try {
      setIsProcessing(true);
      console.log('[Subscription] Opening payment sheet...');
      
      if (Platform.OS === 'web') {
        Alert.alert(
          t('common.info'),
          'Web payment is not available. Please use the mobile app for payment processing.',
          [{ text: t('common.ok'), onPress: () => setIsProcessing(false) }]
        );
        return;
      }
      
      const { error } = await presentPaymentSheet();

      if (error) {
        console.error('[Subscription] Payment error:', error);
        Alert.alert(t('common.error'), error.message);
        setIsProcessing(false);
        return;
      }

      console.log('[Subscription] Payment successful, creating company...');
      
      const companyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const newCompany = await createCompanyMutation.mutateAsync({
        name: params.companyName || 'New Company',
        subscriptionPlan: selectedPlan === 'premium' ? 'pro' : 'basic',
        subscriptionStatus: 'active',
        settings: {
          features: {
            crm: true,
            estimates: true,
            schedule: selectedPlan === 'premium',
            expenses: true,
            photos: true,
            chat: selectedPlan === 'premium',
            reports: selectedPlan === 'premium',
            clock: selectedPlan === 'premium',
            dashboard: true,
          },
          maxUsers: employeeCount,
          maxProjects: selectedPlan === 'premium' ? 999 : 20,
        },
      });

      console.log('[Subscription] Company created:', newCompany.company.name);
      console.log('[Subscription] Company Code:', companyCode);

      const newUser = await createUserMutation.mutateAsync({
        name: params.name || 'Admin',
        email: params.email || 'admin@example.com',
        password: params.password || 'password',
        role: 'admin',
        companyId: newCompany.company.id,
      });

      console.log('[Subscription] Admin user created:', newUser.user.name);

      try {
        await setCompany({
          ...newCompany.company,
          id: companyCode,
        });

        await setUser(newUser.user);

        await setSubscription({
          type: selectedPlan,
          startDate: new Date().toISOString(),
        });
      } catch (storageError) {
        console.error('[Subscription] Storage error:', storageError);
      }

      Alert.alert(
        t('subscription.success'),
        t('subscription.companyCodeMessage', { code: companyCode }),
        [
          {
            text: t('common.ok'),
            onPress: () => router.replace('/dashboard'),
          },
        ]
      );
    } catch (error: any) {
      console.error('[Subscription] Error:', error);
      Alert.alert(t('common.error'), error.message || t('subscription.errorMessage'));
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
          <Text style={styles.planPrice}>${pricing.basic}/{t('subscription.perMonth')}</Text>
          <Text style={styles.planDescription}>
            ${10} {t('subscription.basePrice')} + ${8} × {employeeCount - 1} {t('subscription.employees')}
          </Text>
          <View style={styles.featuresContainer}>
            <Text style={styles.featureItem}>✓ {t('subscription.dashboardAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.crmAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.expensesAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.photosAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.estimatesAccess')}</Text>
            <Text style={styles.featureItem}>✓ {employeeCount} {t('subscription.teamMembers')}</Text>
            <Text style={styles.featureItem}>✓ 20 {t('subscription.activeProjects')}</Text>
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
          <Text style={styles.planPrice}>${pricing.premium}/{t('subscription.perMonth')}</Text>
          <Text style={styles.planDescription}>
            ${20} {t('subscription.basePrice')} + ${15} × {employeeCount - 1} {t('subscription.employees')}
          </Text>
          <View style={styles.featuresContainer}>
            <Text style={styles.featureItem}>✓ {t('subscription.allBasicFeatures')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.scheduleAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.chatAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.reportsAccess')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.clockAccess')}</Text>
            <Text style={styles.featureItem}>✓ {employeeCount} {t('subscription.teamMembers')}</Text>
            <Text style={styles.featureItem}>✓ {t('subscription.unlimitedProjects')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!paymentReady || isProcessing || createCompanyMutation.isPending || createUserMutation.isPending) &&
              styles.continueButtonDisabled,
          ]}
          onPress={handleConfirmSubscription}
          disabled={!paymentReady || isProcessing || createCompanyMutation.isPending || createUserMutation.isPending}
        >
          {isProcessing || createPaymentIntentMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueButtonText}>
              {!paymentReady
                ? t('subscription.preparingPayment')
                : createCompanyMutation.isPending || createUserMutation.isPending
                ? t('common.loading')
                : t('subscription.proceedToPayment')}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>{t('subscription.disclaimer')}</Text>
      </ScrollView>
    </View>
  );
}

export default function SubscriptionScreen() {
  if (Platform.OS === 'web' || !StripeProvider) {
    return <SubscriptionContent />;
  }
  
  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}>
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
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
  },
});
