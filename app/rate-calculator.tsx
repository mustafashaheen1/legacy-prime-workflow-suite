import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Platform } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Stack } from 'expo-router';
import {
  ArrowLeft, TrendingUp, Grid3X3, Plus, Building,
} from 'lucide-react-native';

interface RateCalcSettings {
  desiredSalary: number;
  billableHoursPerWeek: number;
  workingWeeksPerYear: number;
  profitMargin: number;
}

const DEFAULT_SETTINGS: RateCalcSettings = {
  desiredSalary: 80000,
  billableHoursPerWeek: 30,
  workingWeeksPerYear: 50,
  profitMargin: 20,
};

export default function RateCalculatorScreen() {
  const { expenses, company } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Rate calculator settings
  const [settings, setSettings] = useState<RateCalcSettings>(DEFAULT_SETTINGS);
  const [settingsInputs, setSettingsInputs] = useState({
    desiredSalary: String(DEFAULT_SETTINGS.desiredSalary),
    billableHoursPerWeek: String(DEFAULT_SETTINGS.billableHoursPerWeek),
    workingWeeksPerYear: String(DEFAULT_SETTINGS.workingWeeksPerYear),
    profitMargin: String(DEFAULT_SETTINGS.profitMargin),
  });
  const [rateTab, setRateTab] = useState<'expenses' | 'calculator'>('expenses');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Load rate settings from AsyncStorage
  useEffect(() => {
    if (!company?.id) return;
    AsyncStorage.getItem(`rate_calc_${company.id}`).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings(parsed);
        setSettingsInputs({
          desiredSalary: String(parsed.desiredSalary),
          billableHoursPerWeek: String(parsed.billableHoursPerWeek),
          workingWeeksPerYear: String(parsed.workingWeeksPerYear),
          profitMargin: String(parsed.profitMargin),
        });
      }
    });
  }, [company?.id]);

  const saveSettings = useCallback(async () => {
    const parsed: RateCalcSettings = {
      desiredSalary: parseFloat(settingsInputs.desiredSalary) || DEFAULT_SETTINGS.desiredSalary,
      billableHoursPerWeek: parseFloat(settingsInputs.billableHoursPerWeek) || DEFAULT_SETTINGS.billableHoursPerWeek,
      workingWeeksPerYear: parseFloat(settingsInputs.workingWeeksPerYear) || DEFAULT_SETTINGS.workingWeeksPerYear,
      profitMargin: parseFloat(settingsInputs.profitMargin) || DEFAULT_SETTINGS.profitMargin,
    };
    setSettings(parsed);
    if (company?.id) {
      await AsyncStorage.setItem(`rate_calc_${company.id}`, JSON.stringify(parsed));
    }
    if (Platform.OS === 'web') {
      window.alert('Settings saved!');
    } else {
      Alert.alert('Saved', 'Rate calculator settings saved.');
    }
  }, [settingsInputs, company?.id]);

  // ─── Data calculations ───
  const businessExpenses = useMemo(() => expenses.filter(e => e.isCompanyCost), [expenses]);
  const overheadExpenses = useMemo(() => expenses.filter(e => e.isOverhead), [expenses]);

  // 6-month rolling average
  const overheadPerMonth = useMemo(() => {
    if (businessExpenses.length === 0) return 0;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recent = businessExpenses.filter(e => new Date(e.date) >= sixMonthsAgo);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, e) => sum + e.amount, 0) / 6;
  }, [businessExpenses]);

  // Rate calculator
  const recommendedRate = useMemo(() => {
    const totalAnnualCost = settings.desiredSalary + (overheadPerMonth * 12);
    const billableHoursPerYear = settings.billableHoursPerWeek * settings.workingWeeksPerYear;
    if (billableHoursPerYear <= 0) return 0;
    const baseRate = totalAnnualCost / billableHoursPerYear;
    return baseRate * (1 + settings.profitMargin / 100);
  }, [settings, overheadPerMonth]);

  const dailyRate = useMemo(() => recommendedRate * (settings.billableHoursPerWeek / 5), [recommendedRate, settings]);
  const weeklyRate = useMemo(() => recommendedRate * settings.billableHoursPerWeek, [recommendedRate, settings]);
  const yearlyRate = useMemo(() => recommendedRate * settings.billableHoursPerWeek * settings.workingWeeksPerYear, [recommendedRate, settings]);

  const fmt = (n: number) =>
    n === 0 ? '$0' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fmtDec = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const overheadDisplay = period === 'monthly' ? overheadPerMonth : overheadPerMonth * 12;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Overhead & Rate Calculator</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Total Business Overhead */}
        <View style={styles.overheadSection}>
          <Text style={styles.overheadLabel}>TOTAL BUSINESS OVERHEAD</Text>
          <Text style={styles.overheadValue}>
            ${Math.round(overheadDisplay).toLocaleString()}
            <Text style={styles.overheadUnit}> /{period === 'monthly' ? 'mo' : 'yr'}</Text>
          </Text>
        </View>

        {/* Monthly/Yearly toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleTab, period === 'monthly' && styles.toggleTabActive]}
            onPress={() => setPeriod('monthly')}
          >
            <Text style={[styles.toggleText, period === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleTab, period === 'yearly' && styles.toggleTabActive]}
            onPress={() => setPeriod('yearly')}
          >
            <Text style={[styles.toggleText, period === 'yearly' && styles.toggleTextActive]}>Yearly</Text>
          </TouchableOpacity>
        </View>

        {/* Sub-tabs: Expenses | Rate Calculator */}
        <View style={styles.subTabRow}>
          <TouchableOpacity
            style={[styles.subTab, rateTab === 'expenses' && styles.subTabActive]}
            onPress={() => setRateTab('expenses')}
          >
            <Building size={14} color={rateTab === 'expenses' ? '#1F2937' : '#9CA3AF'} />
            <Text style={[styles.subTabText, rateTab === 'expenses' && styles.subTabTextActive]}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, rateTab === 'calculator' && styles.subTabActive]}
            onPress={() => setRateTab('calculator')}
          >
            <Grid3X3 size={14} color={rateTab === 'calculator' ? '#1F2937' : '#9CA3AF'} />
            <Text style={[styles.subTabText, rateTab === 'calculator' && styles.subTabTextActive]}>Rate Calculator</Text>
          </TouchableOpacity>
        </View>

        {rateTab === 'expenses' ? (
          <View style={styles.contentSection}>
            {/* Header row */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>All Overhead Expenses</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push('/(tabs)/expenses?companyExpense=true' as any)}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {overheadExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Building size={48} color="#6B7280" />
                <Text style={styles.emptyTitle}>No Overhead Expenses Yet</Text>
                <Text style={styles.emptyDesc}>
                  Add your business expenses like rent, insurance, vehicle payments, and more to calculate your ideal hourly rate.
                </Text>
                <TouchableOpacity
                  style={styles.addFirstBtn}
                  onPress={() => router.push('/(tabs)/expenses?companyExpense=true' as any)}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addFirstBtnText}>Add First Expense</Text>
                </TouchableOpacity>
              </View>
            ) : (
              overheadExpenses.map(e => (
                <View key={e.id} style={styles.expenseRow}>
                  <Text style={styles.expenseCat}>{e.subcategory || e.type}</Text>
                  <Text style={styles.expenseAmount}>{fmt(e.amount)}</Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.contentSection}>
            {/* Rate Hero */}
            <View style={styles.rateHero}>
              <TrendingUp size={20} color="#10B981" />
              <Text style={styles.rateHeroLabel}>Recommended Hourly Rate</Text>
              <Text style={styles.rateHeroValue}>{fmtDec(recommendedRate)}</Text>
              <Text style={styles.rateHeroSub}>per billable hour</Text>
            </View>

            {/* Daily / Weekly / Yearly */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{fmt(Math.round(dailyRate))}</Text>
                <Text style={styles.breakdownLabel}>Daily</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{fmt(Math.round(weeklyRate))}</Text>
                <Text style={styles.breakdownLabel}>Weekly</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{fmt(Math.round(yearlyRate))}</Text>
                <Text style={styles.breakdownLabel}>Yearly</Text>
              </View>
            </View>

            {/* How it's calculated */}
            <View style={styles.calcCard}>
              <Text style={styles.calcCardTitle}>How it's calculated</Text>
              <View style={styles.calcRow}>
                <View style={[styles.calcDot, { backgroundColor: '#2563EB' }]} />
                <Text style={styles.calcLabel}>Desired Salary</Text>
                <Text style={styles.calcValue}>{fmt(settings.desiredSalary)}</Text>
              </View>
              <Text style={styles.calcOperator}>+</Text>
              <View style={styles.calcRow}>
                <View style={[styles.calcDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.calcLabel}>Annual Overhead</Text>
                <Text style={styles.calcValue}>{fmt(Math.round(overheadPerMonth * 12))}</Text>
              </View>
              <Text style={styles.calcOperator}>=</Text>
              <View style={styles.calcRow}>
                <View style={[styles.calcDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.calcLabel}>Total Annual Cost</Text>
                <Text style={styles.calcValue}>{fmt(Math.round(settings.desiredSalary + overheadPerMonth * 12))}</Text>
              </View>
              <Text style={styles.calcOperator}>÷</Text>
              <View style={styles.calcRow}>
                <View style={[styles.calcDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.calcLabel}>Billable Hours/Year</Text>
                <Text style={styles.calcValue}>{(settings.billableHoursPerWeek * settings.workingWeeksPerYear).toLocaleString()}</Text>
              </View>
              <Text style={styles.calcOperator}>→</Text>
              <View style={styles.calcRow}>
                <View style={[styles.calcDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.calcLabel, { color: '#10B981' }]}>+ {settings.profitMargin}% Profit Margin</Text>
                <Text style={[styles.calcValue, { color: '#10B981' }]}>{fmtDec(recommendedRate)}/hr</Text>
              </View>
            </View>

            {/* Your Settings */}
            <View style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>Your Settings</Text>
              <Text style={styles.settingsLabel}>Desired Annual Salary ($)</Text>
              <TextInput
                style={styles.settingsInput}
                value={settingsInputs.desiredSalary}
                onChangeText={v => setSettingsInputs(p => ({ ...p, desiredSalary: v }))}
                keyboardType="numeric"
                placeholderTextColor="#6B7280"
              />
              <Text style={styles.settingsLabel}>Billable Hours per Week</Text>
              <TextInput
                style={styles.settingsInput}
                value={settingsInputs.billableHoursPerWeek}
                onChangeText={v => setSettingsInputs(p => ({ ...p, billableHoursPerWeek: v }))}
                keyboardType="numeric"
                placeholderTextColor="#6B7280"
              />
              <Text style={styles.settingsLabel}>Working Weeks per Year</Text>
              <TextInput
                style={styles.settingsInput}
                value={settingsInputs.workingWeeksPerYear}
                onChangeText={v => setSettingsInputs(p => ({ ...p, workingWeeksPerYear: v }))}
                keyboardType="numeric"
                placeholderTextColor="#6B7280"
              />
              <Text style={styles.settingsLabel}>Profit Margin (%)</Text>
              <TextInput
                style={styles.settingsInput}
                value={settingsInputs.profitMargin}
                onChangeText={v => setSettingsInputs(p => ({ ...p, profitMargin: v }))}
                keyboardType="numeric"
                placeholderTextColor="#6B7280"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E293B' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  scroll: { flex: 1 },

  // Overhead hero
  overheadSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  overheadLabel: { fontSize: 12, color: '#94A3B8', letterSpacing: 1, fontWeight: '600' },
  overheadValue: { fontSize: 38, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  overheadUnit: { fontSize: 16, fontWeight: '400', color: '#94A3B8' },

  // Period toggle
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: '#334155',
    borderRadius: 10,
    padding: 3,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleTabActive: { backgroundColor: '#4F6BF5' },
  toggleText: { fontSize: 14, fontWeight: '500', color: '#94A3B8' },
  toggleTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Sub-tabs
  subTabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#334155',
    borderRadius: 10,
    padding: 3,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  subTabActive: { backgroundColor: '#FFFFFF' },
  subTabText: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  subTabTextActive: { color: '#1F2937', fontWeight: '600' },

  // Content
  contentSection: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 16 },
  emptyDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 20 },
  addFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    marginTop: 20,
  },
  addFirstBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // Expense rows
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  expenseCat: { fontSize: 14, color: '#CBD5E1' },
  expenseAmount: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // Rate hero
  rateHero: {
    backgroundColor: '#334155',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  rateHeroLabel: { fontSize: 13, color: '#10B981', fontWeight: '600', marginTop: 8 },
  rateHeroValue: { fontSize: 42, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  rateHeroSub: { fontSize: 14, color: '#94A3B8', marginTop: 2 },

  // Breakdown
  breakdownRow: {
    flexDirection: 'row',
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownValue: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  breakdownLabel: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  breakdownDivider: { width: 1, backgroundColor: '#475569' },

  // Calc card
  calcCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  calcCardTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
  },
  calcDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  calcLabel: { flex: 1, fontSize: 13, color: '#CBD5E1' },
  calcValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  calcOperator: { fontSize: 14, color: '#64748B', textAlign: 'center', paddingVertical: 4 },

  // Settings
  settingsCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 20,
  },
  settingsTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  settingsLabel: { fontSize: 13, color: '#94A3B8', marginBottom: 6, marginTop: 12 },
  settingsInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#475569',
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
