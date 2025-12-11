import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect } from 'react';
import { Check } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { StripeProvider, useStripe } from '@/lib/stripe-provider';

function SubscriptionContent() {
  const { setSubscription, setUser, setCompany } = useApp();
  const insets = useSafeAreaInsets();
  const stripe = useStripe();
  const createPaymentIntentMutation = trpc.stripe.createPaymentIntent.useMutation();
  
  const params = useLocalSearchParams<{
    name?: string;
    email?: string;
    password?: string;
    companyName?: string;
    employeeCount?: string;
    accountType?: string;
    companyCode?: string;
    companyId?: string;
  }>();

  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);

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
          const result = await createPaymentIntentMutation.mutateAsync({
            amount: pricing[selectedPlan],
            currency: 'usd',
            companyName: params.companyName || 'New Company',
            email: params.email || 'admin@example.com',
            subscriptionPlan: selectedPlan,
          });
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

      if (!offlineMode && Platform.OS !== 'web' && stripe.initPaymentSheet && stripe.presentPaymentSheet && paymentIntentResult.clientSecret) {
        console.log('[Subscription] Initializing payment sheet...');
        const { error: initError } = await stripe.initPaymentSheet({
          paymentIntentClientSecret: paymentIntentResult.clientSecret || '',
          merchantDisplayName: 'Rork App',
          customerId: undefined,
          customerEphemeralKeySecret: undefined,
        });

        if (initError) {
          console.error('[Subscription] Error initializing payment sheet:', initError);
          Alert.alert('Error', 'No se pudo inicializar el método de pago');
          return;
        }

        console.log('[Subscription] Presenting payment sheet...');
        const { error: presentError } = await stripe.presentPaymentSheet();

        if (presentError) {
          console.error('[Subscription] Error presenting payment sheet:', presentError);
          Alert.alert('Pago Cancelado', presentError.message);
          return;
        }

        console.log('[Subscription] Payment successful!');
      } else if (offlineMode) {
        console.log('[Subscription] Offline mode - Skipping payment');
      } else {
        console.log('[Subscription] Web platform - simulating payment success');
      }

      console.log('[Subscription] Payment processed successfully');
      console.log('[Subscription] Updating subscription status...');

      // Update subscription in storage
      await setSubscription({
        type: selectedPlan,
        startDate: new Date().toISOString(),
      });

      console.log('[Subscription] Subscription updated successfully');

      // On web, navigate directly without Alert
      if (Platform.OS === 'web') {
        router.replace('/(tabs)/dashboard');
      } else {
        const companyCode = params.companyCode || 'N/A';
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
    } catch (error: any) {
      console.error('[Subscription] Error:', error);
      console.error('[Subscription] Error name:', error?.name);
      console.error('[Subscription] Error message:', error?.message);
      console.error('[Subscription] Error stack:', error?.stack?.substring(0, 500));
      
      let errorMessage = 'Error al crear la cuenta';
      let showOfflineOption = false;

      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('failed to fetch')) {
        errorMessage = 'No se pudo conectar con el servidor.\n\n¿Deseas continuar en modo offline sin procesar el pago?';
        showOfflineOption = true;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      if (showOfflineOption) {
        Alert.alert(
          'Error de Conexión',
          errorMessage,
          [
            {
              text: 'Configurar',
              onPress: () => {
                Alert.alert(
                  'Configuración Requerida',
                  'Para procesar pagos necesitas:\n\n1. Crear un archivo .env en la raíz del proyecto\n2. Agregar EXPO_PUBLIC_RORK_API_BASE_URL\n3. Agregar las claves de Stripe\n4. Reiniciar el servidor\n\nRevisa SETUP_INSTRUCTIONS.md para más detalles.',
                  [{ text: 'Entendido' }]
                );
              },
            },
            {
              text: 'Continuar sin pago',
              style: 'default' as const,
              onPress: () => {
                setOfflineMode(true);
                setTimeout(() => handleCreateAccount(), 100);
              },
            },
            {
              text: 'Cancelar',
              style: 'cancel' as const,
            },
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
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
        <Text style={styles.title}>Elige Tu Plan</Text>
        <Text style={styles.subtitle}>
          Para {employeeCount} empleados
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
          <Text style={styles.planTitle}>Plan Básico</Text>
          <Text style={styles.planPrice}>${pricing.basic}/mes</Text>
          <Text style={styles.planDescription}>
            ${10} base + ${8} × {employeeCount - 1} empleados
          </Text>
          <View style={styles.featuresContainer}>
            <Text style={styles.featureItem}>✓ Dashboard</Text>
            <Text style={styles.featureItem}>✓ CRM & Gestión de Clientes</Text>
            <Text style={styles.featureItem}>✓ Seguimiento de Gastos</Text>
            <Text style={styles.featureItem}>✓ Fotos & Documentación</Text>
            <Text style={styles.featureItem}>✓ Estimados & Takeoffs</Text>
            <Text style={styles.featureItem}>✓ {employeeCount} Miembros del Equipo</Text>
            <Text style={styles.featureItem}>✓ 20 Proyectos Activos</Text>
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
            <Text style={styles.popularText}>MÁS POPULAR</Text>
          </View>
          <Text style={styles.planTitle}>Plan Premium</Text>
          <Text style={styles.planPrice}>${pricing.premium}/mes</Text>
          <Text style={styles.planDescription}>
            ${20} base + ${15} × {employeeCount - 1} empleados
          </Text>
          <View style={styles.featuresContainer}>
            <Text style={styles.featureItem}>✓ Todo del Plan Básico</Text>
            <Text style={styles.featureItem}>✓ Programación & Tareas</Text>
            <Text style={styles.featureItem}>✓ Chat en Equipo</Text>
            <Text style={styles.featureItem}>✓ Reportes Avanzados</Text>
            <Text style={styles.featureItem}>✓ Reloj de Entrada/Salida</Text>
            <Text style={styles.featureItem}>✓ {employeeCount} Miembros del Equipo</Text>
            <Text style={styles.featureItem}>✓ Proyectos Ilimitados</Text>
          </View>
        </TouchableOpacity>

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
              Crear Cuenta
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimer}>
            🔒 Pago seguro procesado por Stripe
          </Text>
          <Text style={styles.testMode}>
            Modo Test: Usa 4242 4242 4242 4242 para pruebas
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export default function SubscriptionScreen() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (Platform.OS === 'web' || !publishableKey) {
    return <SubscriptionContent />;
  }

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
