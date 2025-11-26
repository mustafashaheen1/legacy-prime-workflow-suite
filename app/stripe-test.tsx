import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { trpcClient } from '@/lib/trpc';
import { Check, CreditCard, ArrowLeft } from 'lucide-react-native';

export default function StripeTestScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const plans = {
    basic: {
      name: 'Plan Básico',
      price: 29.99,
      features: ['Dashboard', 'CRM', 'Estimados', 'Fotos', 'Gastos'],
    },
    premium: {
      name: 'Plan Premium',
      price: 49.99,
      features: [
        'Todo lo del Plan Básico',
        'Schedule',
        'Chat',
        'Reportes',
        'Clock In/Out',
        'Proyectos Ilimitados',
      ],
    },
  };

  const handleTestPayment = async () => {
    try {
      setIsProcessing(true);
      setTestResult('Iniciando prueba de pago...');

      console.log('[Stripe Test] Starting payment test...');
      console.log('[Stripe Test] Selected plan:', selectedPlan);
      console.log('[Stripe Test] Amount:', plans[selectedPlan].price);

      setTestResult('Creando Payment Intent en Stripe...');
      const paymentIntent = await trpcClient.stripe.createPaymentIntent.mutate({
        amount: plans[selectedPlan].price,
        currency: 'usd',
        companyName: 'Test Company',
        email: 'test@example.com',
        subscriptionPlan: selectedPlan,
      });

      console.log('[Stripe Test] Payment Intent created:', paymentIntent);
      setTestResult(`✅ Payment Intent creado exitosamente!\n\nID: ${paymentIntent.paymentIntentId}\n\nClient Secret: ${paymentIntent.clientSecret?.substring(0, 30)}...`);

      Alert.alert(
        '✅ Prueba Exitosa',
        `Payment Intent creado correctamente.\n\nID: ${paymentIntent.paymentIntentId}\n\nEsto significa que tu integración con Stripe está funcionando. En producción, aquí se abriría el Payment Sheet para que el usuario ingrese su tarjeta.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('[Stripe Test] Error:', error);
      const errorMessage = error?.message || 'Error desconocido';
      setTestResult(`❌ Error: ${errorMessage}`);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (Platform.OS === 'web') {
      const paymentIntentId = prompt('Ingresa el Payment Intent ID (pi_...):');
      if (!paymentIntentId) return;

      try {
        setIsProcessing(true);
        setTestResult('Verificando pago...');
        const result = await trpcClient.stripe.verifyPayment.query({
          paymentIntentId,
        });

        console.log('[Stripe Test] Payment verification:', result);
        setTestResult(
          `✅ Pago verificado!\n\nEstado: ${result.status}\nMonto: $${result.amount}\nMoneda: ${result.currency.toUpperCase()}`
        );

        Alert.alert(
          'Pago Verificado',
          `Estado: ${result.status}\nMonto: $${result.amount} ${result.currency.toUpperCase()}`,
          [{ text: 'OK' }]
        );
      } catch (err: any) {
        const errMsg = err?.message || 'Error al verificar';
        setTestResult(`❌ Error: ${errMsg}`);
        Alert.alert('Error', errMsg);
      } finally {
        setIsProcessing(false);
      }
    } else {
      Alert.prompt(
        'Verificar Pago',
        'Ingresa el Payment Intent ID (pi_...):',
        async (paymentIntentId) => {
          if (!paymentIntentId) return;

          try {
            setIsProcessing(true);
            setTestResult('Verificando pago...');
            const result = await trpcClient.stripe.verifyPayment.query({
              paymentIntentId,
            });

            console.log('[Stripe Test] Payment verification:', result);
            setTestResult(
              `✅ Pago verificado!\n\nEstado: ${result.status}\nMonto: $${result.amount}\nMoneda: ${result.currency.toUpperCase()}`
            );

            Alert.alert(
              'Pago Verificado',
              `Estado: ${result.status}\nMonto: $${result.amount} ${result.currency.toUpperCase()}`,
              [{ text: 'OK' }]
            );
          } catch (err: any) {
            const errMsg = err?.message || 'Error al verificar';
            setTestResult(`❌ Error: ${errMsg}`);
            Alert.alert('Error', errMsg);
          } finally {
            setIsProcessing(false);
          }
        }
      );
    }
  };

  const handleTestSubscription = async () => {
    Alert.alert(
      'Test de Suscripción',
      'Para probar suscripciones, primero necesitas:\n\n1. Crear productos y precios en el Dashboard de Stripe\n2. Obtener el Price ID (price_...)\n3. Probar el flujo completo con una tarjeta de prueba\n\n¿Quieres continuar con un test básico?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            setTestResult(
              'Para probar suscripciones:\n\n1. Ve a tu Dashboard de Stripe\n2. Crea un producto en Products\n3. Agrega un precio recurrente\n4. Usa el Price ID en la app'
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prueba de Stripe</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <CreditCard size={48} color="#2563EB" />
          <Text style={styles.infoTitle}>Modo Test Activo</Text>
          <Text style={styles.infoText}>
            Estás usando las API keys de Stripe en modo test. Todos los pagos son simulados.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Selecciona un Plan</Text>

        {(['basic', 'premium'] as const).map((plan) => (
          <TouchableOpacity
            key={plan}
            style={[styles.planCard, selectedPlan === plan && styles.planCardSelected]}
            onPress={() => setSelectedPlan(plan)}
          >
            {selectedPlan === plan && (
              <View style={styles.checkmark}>
                <Check size={20} color="#FFFFFF" />
              </View>
            )}
            <Text style={styles.planName}>{plans[plan].name}</Text>
            <Text style={styles.planPrice}>${plans[plan].price}/mes</Text>
            <View style={styles.featuresContainer}>
              {plans[plan].features.map((feature, index) => (
                <Text key={index} style={styles.feature}>
                  ✓ {feature}
                </Text>
              ))}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Acciones de Prueba</Text>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleTestPayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <CreditCard size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Crear Payment Intent</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleVerifyPayment}
          disabled={isProcessing}
        >
          <Text style={styles.secondaryButtonText}>Verificar Pago Existente</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestSubscription}
          disabled={isProcessing}
        >
          <Text style={styles.secondaryButtonText}>Test Suscripción</Text>
        </TouchableOpacity>

        {testResult !== '' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Resultado:</Text>
            <Text style={styles.resultText}>{testResult}</Text>
          </View>
        )}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Tarjetas de Prueba</Text>
          <Text style={styles.tipsText}>
            <Text style={{ fontWeight: '700' }}>Pago Exitoso:</Text>
            {'\n'}4242 4242 4242 4242{'\n'}Fecha: Cualquier futura{'\n'}CVC: Cualquier 3 dígitos
            {'\n\n'}
            <Text style={{ fontWeight: '700' }}>Pago Rechazado:</Text>
            {'\n'}4000 0000 0000 0002
            {'\n\n'}
            <Text style={{ fontWeight: '700' }}>Requiere 3D Secure:</Text>
            {'\n'}4000 0025 0000 3155
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.open('https://dashboard.stripe.com/test/payments', '_blank');
            } else {
              Alert.alert(
                'Dashboard de Stripe',
                'Abre https://dashboard.stripe.com/test/payments en tu navegador para ver los pagos.'
              );
            }
          }}
        >
          <Text style={styles.dashboardButtonText}>
            Ver Dashboard de Stripe
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1E40AF',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
    marginTop: 8,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative' as const,
  },
  planCardSelected: {
    borderColor: '#2563EB',
  },
  checkmark: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 12,
  },
  featuresContainer: {
    gap: 6,
  },
  feature: {
    fontSize: 14,
    color: '#6B7280',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  tipsCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  dashboardButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  dashboardButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
