import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubscriptionScreen() {
  const { setSubscription } = useApp();
  const insets = useSafeAreaInsets();

  const handleSelectPlan = (type: 'free-trial' | 'basic' | 'premium') => {
    setSubscription({
      type,
      startDate: new Date().toISOString(),
      endDate: type === 'free-trial' 
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    });
    router.replace('/dashboard');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Text style={styles.title}>Choose Your Plan</Text>

      <View style={styles.plansContainer}>
        <View style={styles.planCard}>
          <Text style={styles.planTitle}>Free Trial</Text>
          <Text style={styles.planDescription}>7-Day Access</Text>
          <TouchableOpacity 
            style={styles.planButton}
            onPress={() => handleSelectPlan('free-trial')}
          >
            <Text style={styles.planButtonText}>Start</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.planCard}>
          <Text style={styles.planTitle}>Subscription</Text>
          <Text style={styles.planDescription}>$10 Basic: Expenses + Photos</Text>
          <Text style={styles.planDescription}>$20 Premium: All Features</Text>
          <TouchableOpacity 
            style={styles.planButton}
            onPress={() => handleSelectPlan('premium')}
          >
            <Text style={styles.planButtonText}>Choose Plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 48,
  },
  plansContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'space-between',
  },
  planTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  planDescription: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 8,
  },
  planButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 16,
  },
  planButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
