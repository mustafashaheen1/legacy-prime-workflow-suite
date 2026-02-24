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
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
import { Check, CreditCard, ArrowLeft } from 'lucide-react-native';

export default function StripeTestScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const plans = {
    basic: {
      name: 'Basic Plan',
      price: 29.99,
      features: ['Dashboard', 'CRM', 'Estimates', 'Photos', 'Expenses'],
    },
    premium: {
      name: 'Premium Plan',
      price: 49.99,
      features: [
        'Everything in Basic Plan',
        'Schedule',
        'Chat',
        'Reports',
        'Clock In/Out',
        'Unlimited Projects',
      ],
    },
  };

  const handleTestPayment = async () => {
    try {
      setIsProcessing(true);
      setTestResult('Starting payment test...');

      console.log('[Stripe Test] Starting payment test...');
      console.log('[Stripe Test] Selected plan:', selectedPlan);
      console.log('[Stripe Test] Amount:', plans[selectedPlan].price);

      setTestResult('Creating Payment Intent in Stripe...');
      const piRes = await fetch(`${API_BASE}/api/stripe-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: plans[selectedPlan].price, currency: 'usd', companyName: 'Test Company', email: 'test@example.com', subscriptionPlan: selectedPlan }),
      });
      const paymentIntent = await piRes.json();
      if (!piRes.ok) throw new Error(paymentIntent.error || 'Failed to create payment intent');

      console.log('[Stripe Test] Payment Intent created:', paymentIntent);
      setTestResult(`✅ Payment Intent created successfully!\n\nID: ${paymentIntent.paymentIntentId}\n\nClient Secret: ${paymentIntent.clientSecret?.substring(0, 30)}...`);

      Alert.alert(
        '✅ Test Successful',
        `Payment Intent created successfully.\n\nID: ${paymentIntent.paymentIntentId}\n\nThis means your Stripe integration is working. In production, the Payment Sheet would open here for the user to enter their card.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('[Stripe Test] Error:', error);
      const errorMessage = error?.message || 'Unknown error';
      setTestResult(`❌ Error: ${errorMessage}`);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (Platform.OS === 'web') {
      const paymentIntentId = prompt('Enter the Payment Intent ID (pi_...):');
      if (!paymentIntentId) return;

      try {
        setIsProcessing(true);
        setTestResult('Verifying payment...');
        const verifyRes = await fetch(`${API_BASE}/api/verify-stripe-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentIntentId }) });
        const result = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(result.error || 'Verification failed');

        console.log('[Stripe Test] Payment verification:', result);
        setTestResult(
          `✅ Payment verified!\n\nStatus: ${result.status}\nAmount: $${result.amount}\nCurrency: ${result.currency.toUpperCase()}`
        );

        Alert.alert(
          'Payment Verified',
          `Status: ${result.status}\nAmount: $${result.amount} ${result.currency.toUpperCase()}`,
          [{ text: 'OK' }]
        );
      } catch (err: any) {
        const errMsg = err?.message || 'Verification error';
        setTestResult(`❌ Error: ${errMsg}`);
        Alert.alert('Error', errMsg);
      } finally {
        setIsProcessing(false);
      }
    } else {
      Alert.prompt(
        'Verify Payment',
        'Enter the Payment Intent ID (pi_...):',
        async (paymentIntentId) => {
          if (!paymentIntentId) return;

          try {
            setIsProcessing(true);
            setTestResult('Verifying payment...');
            const result = await trpcClient.stripe.verifyPayment.query({
              paymentIntentId,
            });

            console.log('[Stripe Test] Payment verification:', result);
            setTestResult(
              `✅ Payment verified!\n\nStatus: ${result.status}\nAmount: $${result.amount}\nCurrency: ${result.currency.toUpperCase()}`
            );

            Alert.alert(
              'Payment Verified',
              `Status: ${result.status}\nAmount: $${result.amount} ${result.currency.toUpperCase()}`,
              [{ text: 'OK' }]
            );
          } catch (err: any) {
            const errMsg = err?.message || 'Verification error';
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
      'Subscription Test',
      'To test subscriptions, you first need to:\n\n1. Create products and prices in the Stripe Dashboard\n2. Get the Price ID (price_...)\n3. Test the complete flow with a test card\n\nDo you want to continue with a basic test?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            setTestResult(
              'To test subscriptions:\n\n1. Go to your Stripe Dashboard\n2. Create a product in Products\n3. Add a recurring price\n4. Use the Price ID in the app'
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
        <Text style={styles.headerTitle}>Stripe Test</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <CreditCard size={48} color="#2563EB" />
          <Text style={styles.infoTitle}>Test Mode Active</Text>
          <Text style={styles.infoText}>
            You are using Stripe API keys in test mode. All payments are simulated.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Select a Plan</Text>

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
            <Text style={styles.planPrice}>${plans[plan].price}/month</Text>
            <View style={styles.featuresContainer}>
              {plans[plan].features.map((feature, index) => (
                <Text key={index} style={styles.feature}>
                  ✓ {feature}
                </Text>
              ))}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Test Actions</Text>

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
              <Text style={styles.buttonText}>Create Payment Intent</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleVerifyPayment}
          disabled={isProcessing}
        >
          <Text style={styles.secondaryButtonText}>Verify Existing Payment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestSubscription}
          disabled={isProcessing}
        >
          <Text style={styles.secondaryButtonText}>Test Subscription</Text>
        </TouchableOpacity>

        {testResult !== '' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Result:</Text>
            <Text style={styles.resultText}>{testResult}</Text>
          </View>
        )}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Test Cards</Text>
          <Text style={styles.tipsText}>
            <Text style={{ fontWeight: '700' }}>Successful Payment:</Text>
            {'\n'}4242 4242 4242 4242{'\n'}Exp: Any future date{'\n'}CVC: Any 3 digits
            {'\n\n'}
            <Text style={{ fontWeight: '700' }}>Declined Payment:</Text>
            {'\n'}4000 0000 0000 0002
            {'\n\n'}
            <Text style={{ fontWeight: '700' }}>Requires 3D Secure:</Text>
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
                'Stripe Dashboard',
                'Open https://dashboard.stripe.com/test/payments in your browser to view payments.'
              );
            }
          }}
        >
          <Text style={styles.dashboardButtonText}>
            View Stripe Dashboard
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
