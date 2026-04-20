import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Platform } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Stack } from 'expo-router';
import {
  DollarSign, Layers, TrendingUp, Grid3X3, Users, BarChart3,
  Clock, ChevronDown, ChevronUp, Plus, ArrowLeft, Building,
} from 'lucide-react-native';
import type { Expense } from '@/types';

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

export default function BusinessCostsScreen() {
  const { expenses, clockEntries, company } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Accordion state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // Rate calculator
  const [settings, setSettings] = useState<RateCalcSettings>(DEFAULT_SETTINGS);
  const [settingsInputs, setSettingsInputs] = useState({
    desiredSalary: String(DEFAULT_SETTINGS.desiredSalary),
    billableHoursPerWeek: String(DEFAULT_SETTINGS.billableHoursPerWeek),
    workingWeeksPerYear: String(DEFAULT_SETTINGS.workingWeeksPerYear),
    profitMargin: String(DEFAULT_SETTINGS.profitMargin),
  });
  const [rateTab, setRateTab] = useState<'expenses' | 'calculator'>('expenses');
  const [overheadPeriod, setOverheadPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [calcOverheadPeriod, setCalcOverheadPeriod] = useState<'monthly' | 'yearly'>('monthly');

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

  // ─── Data calculations (reused from CompactBusinessCosts) ───
  const businessExpenses = useMemo(() => expenses.filter(e => e.isCompanyCost), [expenses]);
  const overheadExpenses = useMemo(() => expenses.filter(e => e.isOverhead), [expenses]);

  const now = new Date();

  const thisMonthTotal = useMemo(() => {
    return businessExpenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [businessExpenses]);

  const thisMonthExpenses = useMemo(() => {
    return businessExpenses.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [businessExpenses]);

  // 6-month rolling average
  const overheadPerMonth = useMemo(() => {
    if (businessExpenses.length === 0) return 0;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recent = businessExpenses.filter(e => new Date(e.date) >= sixMonthsAgo);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, e) => sum + e.amount, 0) / 6;
  }, [businessExpenses]);

  // Minimum monthly spend
  const minMonthly = useMemo(() => {
    if (businessExpenses.length === 0) return 0;
    const byMonth: Record<string, number> = {};
    businessExpenses.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth[key] = (byMonth[key] || 0) + e.amount;
    });
    const months = Object.values(byMonth);
    return months.length > 0 ? Math.min(...months) : 0;
  }, [businessExpenses]);

  // Office staff count
  const officeStaffCount = useMemo(() => {
    const ids = new Set<string>();
    clockEntries.forEach(e => { if (e.officeRole) ids.add(e.employeeId); });
    return ids.size;
  }, [clockEntries]);

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

  // Averages
  const avg3mo = useMemo(() => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recent = businessExpenses.filter(e => new Date(e.date) >= threeMonthsAgo);
    return recent.length > 0 ? recent.reduce((s, e) => s + e.amount, 0) / 3 : 0;
  }, [businessExpenses]);

  const avg6mo = overheadPerMonth;
  const fixedMonthlyOverhead = useMemo(() => overheadExpenses.reduce((s, e) => s + e.amount, 0) / Math.max(1, (() => {
    const months = new Set<string>();
    overheadExpenses.forEach(e => { const d = new Date(e.date); months.add(`${d.getFullYear()}-${d.getMonth()}`); });
    return months.size || 1;
  })()), [overheadExpenses]);
  const annualFixedOverhead = fixedMonthlyOverhead * 12;

  // Monthly totals for bar chart (6 months)
  const monthlyTotals = useMemo(() => {
    const months: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const total = businessExpenses
        .filter(e => {
          const ed = new Date(e.date);
          return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
        })
        .reduce((sum, e) => sum + e.amount, 0);
      months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), total });
    }
    return months;
  }, [businessExpenses]);

  // Category breakdown for this month
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthExpenses.forEach(e => {
      const cat = e.subcategory || e.type || 'Other';
      map[cat] = (map[cat] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [thisMonthExpenses]);

  const fmt = (n: number) =>
    n === 0 ? '$0' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fmtDec = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ─── Accordion section helper ───
  const renderSection = (key: string, icon: React.ReactNode, title: string, children: React.ReactNode) => (
    <TouchableOpacity
      style={styles.accordionHeader}
      onPress={() => toggle(key)}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={styles.accordionTitle}>{title}</Text>
      {expanded[key] ? <ChevronUp size={20} color="#6B7280" /> : <ChevronDown size={20} color="#6B7280" />}
    </TouchableOpacity>
  );

  const maxChartTotal = Math.max(...monthlyTotals.map(m => m.total), 1);
  const chartHeight = 140;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Running Costs</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── 4 Summary Cards ─── */}
        <View style={styles.cardsGrid}>
          <View style={[styles.summaryCard, { borderLeftColor: '#2563EB' }]}>
            <View style={[styles.cardIcon, { backgroundColor: '#2563EB' }]}>
              <DollarSign size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.cardLabel}>This Month (Expenses)</Text>
            <Text style={[styles.cardValue, { color: '#2563EB' }]}>{fmt(thisMonthTotal)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#10B981' }]}>
            <View style={[styles.cardIcon, { backgroundColor: '#10B981' }]}>
              <Layers size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.cardLabel}>Fixed Overhead / mo</Text>
            <Text style={[styles.cardValue, { color: '#10B981' }]}>{fmt(overheadPerMonth)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
            <View style={[styles.cardIcon, { backgroundColor: '#F59E0B' }]}>
              <TrendingUp size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.cardLabel}>Est. Min. Monthly</Text>
            <Text style={[styles.cardValue, { color: '#F59E0B' }]}>{fmt(minMonthly)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#7C3AED' }]}>
            <View style={[styles.cardIcon, { backgroundColor: '#7C3AED' }]}>
              <Grid3X3 size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.cardLabel}>Recommended Rate</Text>
            <Text style={[styles.cardValue, { color: '#7C3AED' }]}>
              {recommendedRate > 0 ? `${fmtDec(recommendedRate)}/hr` : '$0/hr'}
            </Text>
          </View>
        </View>

        {/* ─── Yellow Info Banner ─── */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Based on your overhead, office payroll ({officeStaffCount} staff), and recent expenses, your business needs approximately{' '}
            <Text style={styles.infoBannerHighlight}>{fmt(Math.round(overheadPerMonth || minMonthly))}</Text>
            {' '}per month to operate.
          </Text>
        </View>

        {/* ─── Section 1: Office Payroll ─── */}
        <View style={styles.accordionCard}>
          {renderSection('payroll',
            <Users size={22} color="#7C3AED" style={{ marginRight: 12 }} />,
            'Office Payroll',
            null
          )}
          {expanded['payroll'] && (
            <View style={styles.accordionContent}>
              {officeStaffCount === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptyText}>No office employees classified yet.</Text>
                  <TouchableOpacity
                    style={styles.classifyBtn}
                    onPress={() => router.push('/admin/employee-management' as any)}
                  >
                    <Text style={styles.classifyBtnText}>Classify Employees</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptySection}>
                  <Text style={styles.emptyText}>{officeStaffCount} office employee{officeStaffCount !== 1 ? 's' : ''} classified.</Text>
                  <TouchableOpacity
                    style={styles.classifyBtn}
                    onPress={() => router.push('/admin/employee-management' as any)}
                  >
                    <Text style={styles.classifyBtnText}>Manage Employees</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ─── Section 2: Averages & Trends ─── */}
        <View style={styles.accordionCard}>
          {renderSection('trends',
            <BarChart3 size={22} color="#2563EB" style={{ marginRight: 12 }} />,
            'Averages & Trends',
            null
          )}
          {expanded['trends'] && (
            <View style={styles.accordionContent}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Avg. Monthly (Last 3 months)</Text>
                <Text style={styles.statValue}>{fmt(Math.round(avg3mo))}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Avg. Monthly (Last 6 months)</Text>
                <Text style={styles.statValue}>{fmt(Math.round(avg6mo))}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Fixed Monthly Overhead</Text>
                <Text style={styles.statValue}>{fmt(Math.round(fixedMonthlyOverhead))}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Annual Fixed Overhead</Text>
                <Text style={styles.statValue}>{fmt(Math.round(annualFixedOverhead))}</Text>
              </View>

              {/* Bar Chart */}
              <Text style={styles.chartTitle}>Monthly Operating Cost Trend</Text>
              <View style={styles.chartContainer}>
                {monthlyTotals.map((m, i) => {
                  const barHeight = maxChartTotal > 0 ? (m.total / maxChartTotal) * chartHeight : 0;
                  return (
                    <View key={i} style={styles.chartBarCol}>
                      <Text style={styles.chartBarValue}>
                        {m.total > 0 ? fmt(Math.round(m.total)) : '-'}
                      </Text>
                      <View style={[styles.chartBarBg, { height: chartHeight }]}>
                        <View style={[styles.chartBar, { height: Math.max(barHeight, 2) }]} />
                      </View>
                      <View style={styles.chartBarLabelLine} />
                      <Text style={styles.chartBarLabel}>{m.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* ─── Section 3: Overhead Breakdown ─── */}
        <View style={styles.accordionCard}>
          {renderSection('overhead',
            <Clock size={22} color="#2563EB" style={{ marginRight: 12 }} />,
            'Overhead Breakdown',
            null
          )}
          {expanded['overhead'] && (
            <View style={styles.accordionContent}>
              {/* Monthly/Yearly toggle */}
              <View style={styles.periodToggle}>
                <TouchableOpacity
                  style={[styles.periodTab, overheadPeriod === 'monthly' && styles.periodTabActive]}
                  onPress={() => setOverheadPeriod('monthly')}
                >
                  <Text style={[styles.periodTabText, overheadPeriod === 'monthly' && styles.periodTabTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodTab, overheadPeriod === 'yearly' && styles.periodTabActive]}
                  onPress={() => setOverheadPeriod('yearly')}
                >
                  <Text style={[styles.periodTabText, overheadPeriod === 'yearly' && styles.periodTabTextActive]}>Yearly</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.overheadTotalLabel}>Total {overheadPeriod === 'monthly' ? 'Monthly' : 'Yearly'} Overhead</Text>
              <Text style={styles.overheadTotalValue}>
                {fmt(Math.round(overheadPeriod === 'monthly' ? fixedMonthlyOverhead : annualFixedOverhead))}
              </Text>

              {overheadExpenses.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptyText}>No overhead expenses recorded yet.</Text>
                  <TouchableOpacity
                    style={styles.classifyBtn}
                    onPress={() => router.push('/(tabs)/expenses?companyExpense=true' as any)}
                  >
                    <Text style={styles.classifyBtnText}>Add Overhead Expenses</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  {overheadExpenses.slice(0, 10).map(e => (
                    <View key={e.id} style={styles.expenseRow}>
                      <Text style={styles.expenseRowCat}>{e.subcategory || e.type}</Text>
                      <Text style={styles.expenseRowAmount}>{fmt(e.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ─── Section 4: This Month's Company Expenses ─── */}
        <View style={styles.accordionCard}>
          {renderSection('monthExpenses',
            <DollarSign size={22} color="#2563EB" style={{ marginRight: 12 }} />,
            "This Month's Company Expenses",
            null
          )}
          {expanded['monthExpenses'] && (
            <View style={styles.accordionContent}>
              {categoryBreakdown.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptyText}>No company expenses this month.</Text>
                </View>
              ) : (
                <>
                  {categoryBreakdown.map(([cat, total]) => (
                    <View key={cat}>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>{cat}</Text>
                        <Text style={styles.statValue}>{fmt(total)}</Text>
                      </View>
                      <View style={styles.statDivider} />
                    </View>
                  ))}

                  <Text style={styles.recentEntriesTitle}>Recent Entries</Text>
                  {thisMonthExpenses.slice(0, 20).map(e => (
                    <View key={e.id} style={styles.recentEntry}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recentEntryCat}>{e.subcategory || e.type}</Text>
                        <Text style={styles.recentEntryStore}>{e.store}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.recentEntryAmount}>{fmt(e.amount)}</Text>
                        <Text style={styles.recentEntryDate}>
                          {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        {/* ─── Section 5: Overhead & Rate Calculator ─── */}
        <View style={styles.accordionCard}>
          {renderSection('rateCalc',
            <Grid3X3 size={22} color="#7C3AED" style={{ marginRight: 12 }} />,
            'Overhead & Rate Calculator',
            null
          )}
          {expanded['rateCalc'] && (
            <View style={styles.darkSection}>
              {/* Dark header */}
              <Text style={styles.darkLabel}>TOTAL BUSINESS OVERHEAD</Text>
              <Text style={styles.darkBigValue}>
                ${Math.round(calcOverheadPeriod === 'monthly' ? overheadPerMonth : overheadPerMonth * 12).toLocaleString()}
                <Text style={styles.darkBigUnit}> /{calcOverheadPeriod === 'monthly' ? 'mo' : 'yr'}</Text>
              </Text>
              <View style={[styles.periodToggle, { marginVertical: 12 }]}>
                <TouchableOpacity
                  style={[styles.darkPeriodTab, calcOverheadPeriod === 'monthly' && styles.darkPeriodTabActive]}
                  onPress={() => setCalcOverheadPeriod('monthly')}
                >
                  <Text style={[styles.darkPeriodText, calcOverheadPeriod === 'monthly' && styles.darkPeriodTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.darkPeriodTab, calcOverheadPeriod === 'yearly' && styles.darkPeriodTabActive]}
                  onPress={() => setCalcOverheadPeriod('yearly')}
                >
                  <Text style={[styles.darkPeriodText, calcOverheadPeriod === 'yearly' && styles.darkPeriodTextActive]}>Yearly</Text>
                </TouchableOpacity>
              </View>

              {/* Sub-tabs */}
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
                <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.darkSectionTitle}>All Overhead Expenses</Text>
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => router.push('/(tabs)/expenses?companyExpense=true' as any)}
                    >
                      <Plus size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {overheadExpenses.length === 0 ? (
                    <View style={styles.darkEmpty}>
                      <Building size={48} color="#6B7280" />
                      <Text style={styles.darkEmptyTitle}>No Overhead Expenses Yet</Text>
                      <Text style={styles.darkEmptyDesc}>
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
                      <View key={e.id} style={styles.darkExpenseRow}>
                        <Text style={styles.darkExpenseCat}>{e.subcategory || e.type}</Text>
                        <Text style={styles.darkExpenseAmount}>{fmt(e.amount)}</Text>
                      </View>
                    ))
                  )}
                </View>
              ) : (
                <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                  {/* Rate Hero */}
                  <View style={styles.rateHero}>
                    <TrendingUp size={20} color="#10B981" />
                    <Text style={styles.rateHeroLabel}>Recommended Hourly Rate</Text>
                    <Text style={styles.rateHeroValue}>{fmtDec(recommendedRate)}</Text>
                    <Text style={styles.rateHeroSub}>per billable hour</Text>
                  </View>

                  {/* Daily / Weekly / Yearly */}
                  <View style={styles.rateBreakdownRow}>
                    <View style={styles.rateBreakdownItem}>
                      <Text style={styles.rateBreakdownValue}>{fmt(Math.round(dailyRate))}</Text>
                      <Text style={styles.rateBreakdownLabel}>Daily</Text>
                    </View>
                    <View style={styles.rateBreakdownDivider} />
                    <View style={styles.rateBreakdownItem}>
                      <Text style={styles.rateBreakdownValue}>{fmt(Math.round(weeklyRate))}</Text>
                      <Text style={styles.rateBreakdownLabel}>Weekly</Text>
                    </View>
                    <View style={styles.rateBreakdownDivider} />
                    <View style={styles.rateBreakdownItem}>
                      <Text style={styles.rateBreakdownValue}>{fmt(Math.round(yearlyRate))}</Text>
                      <Text style={styles.rateBreakdownLabel}>Yearly</Text>
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
                    <TouchableOpacity style={styles.saveSettingsBtn} onPress={saveSettings}>
                      <Text style={styles.saveSettingsBtnText}>Save Settings</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  scroll: { flex: 1 },

  // Summary cards
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardLabel: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: '700' },

  // Info banner
  infoBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoBannerText: { fontSize: 14, color: '#92400E', lineHeight: 20 },
  infoBannerHighlight: { fontWeight: '700', color: '#D97706' },

  // Accordion
  accordionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  accordionTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1F2937' },
  accordionContent: { paddingHorizontal: 18, paddingBottom: 18 },

  // Stats
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  statLabel: { fontSize: 14, color: '#4B5563' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  statDivider: { height: 1, backgroundColor: '#F3F4F6' },

  // Empty states
  emptySection: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginBottom: 16 },
  classifyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
  },
  classifyBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },

  // Chart
  chartTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 20, marginBottom: 16 },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  chartBarCol: { flex: 1, alignItems: 'center' },
  chartBarValue: { fontSize: 10, color: '#6B7280', marginBottom: 4, fontWeight: '600' },
  chartBarBg: {
    width: '80%',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  chartBarLabelLine: { height: 2, width: '80%', backgroundColor: '#2563EB', marginTop: 2 },
  chartBarLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },

  // Period toggle
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodTabActive: { backgroundColor: '#FFFFFF' },
  periodTabText: { fontSize: 14, fontWeight: '500', color: '#64748B' },
  periodTabTextActive: { color: '#2563EB', fontWeight: '600' },

  // Overhead
  overheadTotalLabel: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 4 },
  overheadTotalValue: { fontSize: 28, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginBottom: 16 },

  // Expense rows
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  expenseRowCat: { fontSize: 14, color: '#4B5563' },
  expenseRowAmount: { fontSize: 14, fontWeight: '600', color: '#1F2937' },

  // Recent entries
  recentEntriesTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 16, marginBottom: 8 },
  recentEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recentEntryCat: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  recentEntryStore: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  recentEntryAmount: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  recentEntryDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Dark section (Rate Calculator)
  darkSection: { backgroundColor: '#1E293B', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingTop: 20 },
  darkLabel: { fontSize: 12, color: '#94A3B8', letterSpacing: 1, paddingHorizontal: 16 },
  darkBigValue: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', paddingHorizontal: 16, marginTop: 4 },
  darkBigUnit: { fontSize: 16, fontWeight: '400', color: '#94A3B8' },

  darkPeriodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  darkPeriodTabActive: { backgroundColor: '#334155' },
  darkPeriodText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  darkPeriodTextActive: { color: '#FFFFFF' },

  subTabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
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

  darkSectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
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

  darkEmpty: { alignItems: 'center', paddingVertical: 40 },
  darkEmptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 16 },
  darkEmptyDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 20 },
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

  darkExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  darkExpenseCat: { fontSize: 14, color: '#CBD5E1' },
  darkExpenseAmount: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

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

  rateBreakdownRow: {
    flexDirection: 'row',
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  rateBreakdownItem: { flex: 1, alignItems: 'center' },
  rateBreakdownValue: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  rateBreakdownLabel: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  rateBreakdownDivider: { width: 1, backgroundColor: '#475569' },

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
    fontWeight: '600',
  },
  saveSettingsBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveSettingsBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
