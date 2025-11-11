import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect } from 'react';
import { Check } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';

function SubscriptionContent() {
  const { setSubscription, setUser, setCompany } = useApp();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const params = useLocalSearchParams<{
    name?: string;
    email?: string;
    password?: string;
    companyName?: string;
    employeeCount?: string;
    accountType?: string;
  }>();

  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const createCompanyMutation = trpc.companies.createCompany.useMutation();
  const createUserMutation = trpc.users.createUser.useMutation();

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

  const handleConfirmSubscription = async () => {
    try {
      setIsProcessing(true);
      console.log('[Subscription] Creating company (Payment disabled for testing)...');
      
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
            (isProcessing || createCompanyMutation.isPending || createUserMutation.isPending) &&
              styles.continueButtonDisabled,
          ]}
          onPress={handleConfirmSubscription}
          disabled={isProcessing || createCompanyMutation.isPending || createUserMutation.isPending}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueButtonText}>
              {createCompanyMutation.isPending || createUserMutation.isPending
                ? t('common.loading')
                : t('subscription.createAccount')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={async () => {
            try {
              setIsProcessing(true);
              console.log('[Subscription] Skipping payment, creating company...');
              
              const companyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              
              const newCompany = await createCompanyMutation.mutateAsync({
                name: params.companyName || 'New Company',
                subscriptionPlan: 'basic',
                subscriptionStatus: 'trial',
                settings: {
                  features: {
                    crm: true,
                    estimates: true,
                    schedule: true,
                    expenses: true,
                    photos: true,
                    chat: true,
                    reports: true,
                    clock: true,
                    dashboard: true,
                  },
                  maxUsers: parseInt(params.employeeCount || '2'),
                  maxProjects: 999,
                },
              });

              console.log('[Subscription] Company created:', newCompany.company.name);

              const newUser = await createUserMutation.mutateAsync({
                name: params.name || 'Admin',
                email: params.email || 'admin@example.com',
                password: params.password || 'password',
                role: 'admin',
                companyId: newCompany.company.id,
              });

              console.log('[Subscription] Admin user created:', newUser.user.name);

              await setCompany({
                ...newCompany.company,
                id: companyCode,
              });

              await setUser(newUser.user);

              await setSubscription({
                type: 'basic',
                startDate: new Date().toISOString(),
              });

              Alert.alert(
                'Cuenta Creada',
                `Tu cuenta ha sido creada exitosamente. Código de compañía: ${companyCode}`,
                [
                  {
                    text: t('common.ok'),
                    onPress: () => router.replace('/dashboard'),
                  },
                ]
              );
            } catch (error: any) {
              console.error('[Subscription] Error:', error);
              Alert.alert(t('common.error'), error.message || 'Error al crear la cuenta');
            } finally {
              setIsProcessing(false);
            }
          }}
          disabled={isProcessing || createCompanyMutation.isPending || createUserMutation.isPending}
        >
          <Text style={styles.skipButtonText}>Crear Cuenta Sin Pago (Por Ahora)</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {t('subscription.testMode')} - Payment integration disabled for testing
        </Text>
      </ScrollView>
    </View>
  );
}

export default function SubscriptionScreen() {
  return <SubscriptionContent />;
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
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
});
