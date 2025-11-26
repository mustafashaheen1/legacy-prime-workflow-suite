import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect } from 'react';
import { Check } from 'lucide-react-native';

function SubscriptionContent() {
  const { setSubscription, setUser, setCompany } = useApp();
  const insets = useSafeAreaInsets();
  
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
      console.log('[Subscription] Creating company account...');
      
      const companyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const newCompany = {
        id: companyCode,
        name: params.companyName || 'New Company',
        logo: undefined,
        brandColor: '#2563EB',
        subscriptionStatus: 'active' as const,
        subscriptionPlan: selectedPlan === 'premium' ? 'pro' as const : 'basic' as const,
        subscriptionStartDate: new Date().toISOString(),
        subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        companyCode,
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newUser = {
        id: `user-${Date.now()}`,
        name: params.name || 'Admin',
        email: params.email || 'admin@example.com',
        role: 'admin' as const,
        companyId: companyCode,
        avatar: undefined,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      console.log('[Subscription] Saving company to storage...');
      await setCompany(newCompany);

      console.log('[Subscription] Saving user to storage...');
      await setUser(newUser);

      console.log('[Subscription] Saving subscription to storage...');
      await setSubscription({
        type: selectedPlan,
        startDate: new Date().toISOString(),
      });

      console.log('[Subscription] Account created successfully');

      Alert.alert(
        'Cuenta Creada Exitosamente',
        `Tu cuenta empresarial ha sido creada.\n\nCódigo de compañía: ${companyCode}\n\nComparte este código con tus empleados para que puedan registrarse.`,
        [
          {
            text: 'Entendido',
            onPress: () => router.replace('/dashboard'),
          },
        ]
      );
    } catch (error: any) {
      console.error('[Subscription] Error:', error);
      Alert.alert('Error', error?.message || 'Error al crear la cuenta');
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

        <Text style={styles.disclaimer}>
          Modo de prueba - Los pagos se integrarán próximamente
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
});
