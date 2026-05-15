import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Pressable, Platform, Linking, useWindowDimensions } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image } from 'expo-image';
import {
  DollarSign, Layers, TrendingUp, Grid3X3, Users, BarChart3,
  Clock, ChevronDown, ChevronUp, ArrowLeft, X, Image as ImageIcon, File, ChevronRight, ChevronLeft, Calendar
} from 'lucide-react-native';
import type { Expense } from '@/types';

function getPeriodBounds(
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  anchor: Date
): [Date, Date] {
  if (period === 'weekly') return getWeekBounds(anchor);
  const start = new Date(anchor);
  const end = new Date(anchor);
  if (period === 'monthly') {
    start.setDate(1); start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
  } else if (period === 'quarterly') {
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1); start.setHours(0, 0, 0, 0);
    end.setMonth(q * 3 + 3, 0); end.setHours(23, 59, 59, 999);
  } else {
    start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31); end.setHours(23, 59, 59, 999);
  }
  return [start, end];
}

function getWeekBounds(d: Date): [Date, Date] {
  const start = new Date(d);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

export default function BusinessCostsScreen() {
  const { expenses, clockEntries, company, refreshClockEntries, refreshExpenses } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;

  // Accordion state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const [overheadPeriod, setOverheadPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Rate period selector
  const [ratePeriod, setRatePeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [ratePeriodDate, setRatePeriodDate] = useState<Date>(new Date());
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 220 });
  const filterBtnRef = useRef<View>(null);

  // Expense detail modal
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);

  // Receipt viewer
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);

  // Labor detail modal
  const [selectedLaborRow, setSelectedLaborRow] = useState<EmployeeLaborRow | null>(null);
  const [showLaborDetail, setShowLaborDetail] = useState(false);
  const [laborFilter, setLaborFilter] = useState<'all' | 'month' | 'week'>('all');
  const [laborFilterDate, setLaborFilterDate] = useState<Date>(new Date());

  const handleViewReceipt = (url: string) => {
    setViewingReceiptUrl(url);
    setShowReceiptViewer(true);
  };

  // When screen comes into focus: immediate refresh + start a 10-second
  // Fetch fresh data on screen focus. Live updates arrive via AppContext Realtime
  // channels (clock-entries + expenses) — no polling interval needed.
  // Functions intentionally excluded from deps to prevent double-fetch on re-render.
  useFocusEffect(useCallback(() => {
    refreshClockEntries();
    refreshExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  // Tick every 10s so live labor costs (active sessions) update their hours
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // ─── Data calculations ───────────────────────────────────────────────────
  // Business Costs = ONLY indirect company overhead.
  // Project labor and project expenses must NEVER be included here.

  const now = new Date();

  // Net milliseconds for a clock entry (subtracting lunch breaks)
  const calcNetMs = (e: typeof clockEntries[0]): number => {
    const start = new Date(e.clockIn).getTime();
    const end = e.clockOut ? new Date(e.clockOut).getTime() : Date.now();
    let ms = end - start;
    (e.lunchBreaks ?? []).forEach(lb => {
      const ls = new Date(lb.startTime).getTime();
      const le = lb.endTime ? new Date(lb.endTime).getTime() : (e.clockOut ? new Date(e.clockOut).getTime() : Date.now());
      if (!isNaN(ls) && !isNaN(le)) ms -= (le - ls);
    });
    return Math.max(0, ms);
  };

  // Company/office expenses only — those marked "not tied to a project"
  const businessExpenses = useMemo(() =>
    [...expenses]
      .filter(e => e.isCompanyCost === true)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  , [expenses]);

  // Recurring overhead expenses (for Overhead Breakdown accordion)
  const overheadExpenses = useMemo(() => expenses.filter(e => e.isOverhead), [expenses]);

  // Office clock-ins only — entries NOT tied to any project
  const officeClockEntries = useMemo(
    () => clockEntries.filter(e => !e.projectId),
    [clockEntries]
  );

  // This month: company expenses total
  const thisMonthExpenseTotal = useMemo(() => {
    return businessExpenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessExpenses]);

  // This month: office labor cost (hours × rate, no project entries)
  const officeLaborThisMonth = useMemo(() => {
    const n = new Date();
    return officeClockEntries
      .filter(e => {
        const d = new Date(e.clockIn);
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
      })
      .reduce((sum, e) => {
        if (!e.hourlyRate) return sum;
        return sum + calcNetMs(e) / 3_600_000 * e.hourlyRate;
      }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeClockEntries, tick]);

  // This month combined total (used for summary card + yearly forecast)
  const thisMonthTotal = thisMonthExpenseTotal + officeLaborThisMonth;

  // Yearly forecast = This Month × 12
  const yearlyForecast = thisMonthTotal * 12;

  // Company expenses list for display (all time, newest first)
  const thisMonthExpenses = businessExpenses;

  // 6-month rolling average (expenses + office labor combined per month)
  const overheadPerMonth = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthMap: Record<string, number> = {};
    businessExpenses
      .filter(e => new Date(e.date) >= sixMonthsAgo)
      .forEach(e => {
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthMap[key] = (monthMap[key] || 0) + e.amount;
      });
    officeClockEntries
      .filter(e => e.clockOut && new Date(e.clockIn) >= sixMonthsAgo)
      .forEach(e => {
        if (!e.hourlyRate) return;
        const cost = calcNetMs(e) / 3_600_000 * e.hourlyRate;
        const d = new Date(e.clockIn);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthMap[key] = (monthMap[key] || 0) + cost;
      });
    const totals = Object.values(monthMap);
    if (totals.length === 0) return 0;
    return totals.reduce((s, v) => s + v, 0) / 6;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessExpenses, officeClockEntries]);

  // Minimum monthly spend (expenses + office labor)
  const minMonthly = useMemo(() => {
    const byMonth: Record<string, number> = {};
    businessExpenses.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth[key] = (byMonth[key] || 0) + e.amount;
    });
    officeClockEntries.filter(e => e.clockOut).forEach(e => {
      if (!e.hourlyRate) return;
      const cost = calcNetMs(e) / 3_600_000 * e.hourlyRate;
      const d = new Date(e.clockIn);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth[key] = (byMonth[key] || 0) + cost;
    });
    const months = Object.values(byMonth);
    return months.length > 0 ? Math.min(...months) : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessExpenses, officeClockEntries]);

  // Office staff count (employees who have any office clock-in)
  const officeStaffCount = useMemo(() => {
    const ids = new Set<string>();
    officeClockEntries.forEach(e => ids.add(e.employeeId));
    return ids.size;
  }, [officeClockEntries]);

  // ─── Labor cost calculations (office-only) ──────────────────────────────

  interface EmployeeLaborRow {
    employeeId: string;
    name: string;
    totalHours: number;
    totalCost: number;
    rate: number | null;
    isActive: boolean;
  }

  interface DailyLaborRow {
    date: string;      // YYYY-MM-DD
    hours: number;
    rate: number | null; // -1 = varies
    cost: number;
    sessions: number;
  }

  // Aggregate office clock entries by employee (all time, for history accordion)
  const laborRows = useMemo((): EmployeeLaborRow[] => {
    const map = new Map<string, EmployeeLaborRow>();
    const twentyFourHoursAgo = Date.now() - 24 * 3_600_000;
    officeClockEntries.forEach((e: typeof clockEntries[0]) => {
        const netHours = calcNetMs(e) / 3_600_000;
        const rate = e.hourlyRate ?? null;
        const cost = rate != null ? netHours * rate : 0;
        const isActive = !e.clockOut && new Date(e.clockIn).getTime() > twentyFourHoursAgo;
        const existing = map.get(e.employeeId);
        if (existing) {
          existing.totalHours += netHours;
          existing.totalCost += cost;
          if (isActive) existing.isActive = true;
          if (existing.rate !== rate && existing.rate !== -1) existing.rate = -1;
        } else {
          map.set(e.employeeId, {
            employeeId: e.employeeId,
            name: e.employeeName || 'Unknown',
            totalHours: netHours,
            totalCost: cost,
            rate,
            isActive,
          });
        }
      });
    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeClockEntries, tick]);

  const laborTotalAllTime = useMemo(
    () => laborRows.reduce((s, r) => s + r.totalCost, 0),
    [laborRows]
  );

  // Daily breakdown for the selected employee (office entries only)
  const selectedEmployeeDailyRows = useMemo((): DailyLaborRow[] => {
    if (!selectedLaborRow) return [];
    const [weekStart, weekEnd] = laborFilter === 'week' ? getWeekBounds(laborFilterDate) : [null, null];
    const map = new Map<string, DailyLaborRow>();
    officeClockEntries
      .filter(e => {
        if (e.employeeId !== selectedLaborRow.employeeId) return false;
        if (laborFilter === 'month') {
          const d = new Date(e.clockIn);
          return d.getFullYear() === laborFilterDate.getFullYear() && d.getMonth() === laborFilterDate.getMonth();
        }
        if (laborFilter === 'week') {
          const d = new Date(e.clockIn);
          return d >= weekStart! && d <= weekEnd!;
        }
        return true;
      })
      .forEach(e => {
        const dateKey = e.clockIn.slice(0, 10);
        const netHours = calcNetMs(e) / 3_600_000;
        const rate = e.hourlyRate ?? null;
        const cost = rate != null ? netHours * rate : 0;
        const existing = map.get(dateKey);
        if (existing) {
          existing.hours += netHours;
          existing.cost += cost;
          existing.sessions += 1;
          if (existing.rate !== rate && existing.rate !== -1) existing.rate = -1;
        } else {
          map.set(dateKey, { date: dateKey, hours: netHours, rate, cost, sessions: 1 });
        }
      });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLaborRow, officeClockEntries, laborFilter, laborFilterDate, tick]);

  const laborHoursAllTime = useMemo(
    () => laborRows.reduce((s, r) => s + r.totalHours, 0),
    [laborRows]
  );

  // ─── Rate period bounds ──────────────────────────────────────────────────
  const periodBounds = useMemo(
    () => getPeriodBounds(ratePeriod, ratePeriodDate),
    [ratePeriod, ratePeriodDate]
  );

  const allPeriodEntries = useMemo(() => {
    const [start, end] = periodBounds;
    return clockEntries.filter(e => { const d = new Date(e.clockIn); return d >= start && d <= end; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockEntries, periodBounds]);

  // All employee hours in period (field + office) — used as divisor for indirect cost rate
  const totalEmployeeHoursInPeriod = useMemo(
    () => allPeriodEntries.reduce((s, e) => s + calcNetMs(e) / 3_600_000, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPeriodEntries, tick]
  );

  // Field/project employees only — their cost forms the average labor rate baseline.
  // Office labor is intentionally excluded here; it appears in totalIndirectCostsInPeriod
  // as overhead, so counting it here would double-count it in the recommended rate.
  const fieldPeriodEntries = useMemo(
    () => allPeriodEntries.filter(e => !!e.projectId),
    [allPeriodEntries]
  );

  const fieldHoursInPeriod = useMemo(
    () => fieldPeriodEntries.reduce((s, e) => s + calcNetMs(e) / 3_600_000, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldPeriodEntries, tick]
  );

  const fieldPayrollCostInPeriod = useMemo(
    () => fieldPeriodEntries.reduce((s, e) => e.hourlyRate ? s + calcNetMs(e) / 3_600_000 * e.hourlyRate : s, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldPeriodEntries, tick]
  );

  // Average field labor cost per field hour worked
  const avgLaborCostPerHour = useMemo(
    () => fieldHoursInPeriod > 0 ? fieldPayrollCostInPeriod / fieldHoursInPeriod : 0,
    [fieldPayrollCostInPeriod, fieldHoursInPeriod]
  );

  const totalIndirectCostsInPeriod = useMemo(() => {
    const [start, end] = periodBounds;
    const expCost = businessExpenses.filter(e => { const d = new Date(e.date); return d >= start && d <= end; }).reduce((s, e) => s + e.amount, 0);
    const officeLaborCost = officeClockEntries.filter(e => { const d = new Date(e.clockIn); return d >= start && d <= end; }).reduce((s, e) => e.hourlyRate ? s + calcNetMs(e) / 3_600_000 * e.hourlyRate : s, 0);
    return expCost + officeLaborCost;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessExpenses, officeClockEntries, periodBounds, tick]);

  const indirectCostPerHour = useMemo(
    () => totalEmployeeHoursInPeriod > 0 ? totalIndirectCostsInPeriod / totalEmployeeHoursInPeriod : 0,
    [totalIndirectCostsInPeriod, totalEmployeeHoursInPeriod]
  );

  const ratePeriodLabel = useMemo(() => {
    const [start, end] = periodBounds;
    const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (ratePeriod === 'yearly') return `${start.getFullYear()}`;
    return `${f(start)} – ${f(end)}, ${end.getFullYear()}`;
  }, [periodBounds, ratePeriod]);

  const navigatePeriod = (dir: -1 | 1) => {
    setRatePeriodDate(prev => {
      const d = new Date(prev);
      if (ratePeriod === 'weekly') d.setDate(d.getDate() + dir * 7);
      else if (ratePeriod === 'monthly') d.setMonth(d.getMonth() + dir);
      else if (ratePeriod === 'quarterly') d.setMonth(d.getMonth() + dir * 3);
      else d.setFullYear(d.getFullYear() + dir);
      return d;
    });
  };

  const recommendedRate = useMemo(
    () => avgLaborCostPerHour + indirectCostPerHour,
    [avgLaborCostPerHour, indirectCostPerHour]
  );

  // 3-month average (expenses + office labor)
  const avg3mo = useMemo(() => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const expenseTotal = businessExpenses
      .filter(e => new Date(e.date) >= threeMonthsAgo)
      .reduce((s, e) => s + e.amount, 0);
    const laborTotal = officeClockEntries
      .filter(e => e.clockOut && new Date(e.clockIn) >= threeMonthsAgo)
      .reduce((sum, e) => {
        if (!e.hourlyRate) return sum;
        return sum + calcNetMs(e) / 3_600_000 * e.hourlyRate;
      }, 0);
    return (expenseTotal + laborTotal) / 3;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessExpenses, officeClockEntries]);

  const avg6mo = overheadPerMonth;
  const fixedMonthlyOverhead = useMemo(() => overheadExpenses.reduce((s, e) => s + e.amount, 0) / Math.max(1, (() => {
    const months = new Set<string>();
    overheadExpenses.forEach(e => { const d = new Date(e.date); months.add(`${d.getFullYear()}-${d.getMonth()}`); });
    return months.size || 1;
  })()), [overheadExpenses]);
  const annualFixedOverhead = fixedMonthlyOverhead * 12;

  // Monthly totals for bar chart (6 months) — expenses + office labor combined
  const monthlyTotals = useMemo(() => {
    const months: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const expenseTotal = businessExpenses
        .filter(e => {
          const ed = new Date(e.date);
          return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
        })
        .reduce((sum, e) => sum + e.amount, 0);
      const laborTotal = officeClockEntries
        .filter(e => {
          const ed = new Date(e.clockIn);
          return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth() && !!e.clockOut;
        })
        .reduce((sum, e) => {
          if (!e.hourlyRate) return sum;
          return sum + calcNetMs(e) / 3_600_000 * e.hourlyRate;
        }, 0);
      months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), total: expenseTotal + laborTotal });
    }
    return months;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessExpenses, officeClockEntries]);

  // Category breakdown for company expenses
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthExpenses.forEach(e => {
      const cat = e.subcategory || e.type || 'Other';
      map[cat] = (map[cat] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [thisMonthExpenses]);

  const fmt = (n: number) =>
    n === 0 ? '$0.00' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
            <Text style={styles.cardLabel}>This Month (Total)</Text>
            <Text style={[styles.cardValue, { color: '#2563EB' }]}>{fmt(thisMonthTotal)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#10B981' }]}>
            <View style={[styles.cardIcon, { backgroundColor: '#10B981' }]}>
              <Layers size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.cardLabel}>Fixed Overhead / mo</Text>
            <Text style={[styles.cardValue, { color: '#10B981' }]}>{fmtDec(overheadPerMonth)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
            <View style={[styles.cardIcon, { backgroundColor: '#F59E0B' }]}>
              <TrendingUp size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.cardLabel}>Yearly Forecast</Text>
            <Text style={[styles.cardValue, { color: '#F59E0B' }]}>{fmt(yearlyForecast)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#7C3AED' }]}>
            <View style={[styles.cardIcon, { backgroundColor: '#7C3AED' }]}>
              <Grid3X3 size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.cardLabel}>Recommended Rate</Text>

            {/* Filter pill — right-aligned, shrinks to content */}
            <TouchableOpacity
              ref={filterBtnRef as any}
              style={styles.rateFilterRow}
              onPress={() => {
                filterBtnRef.current?.measureInWindow((x, y, w, h) => {
                  const dropW = 220;
                  setDropdownPos({ top: y + h + 6, left: x + w - dropW, width: dropW });
                  setShowPeriodDropdown(true);
                });
              }}
              activeOpacity={0.75}
            >
              <Calendar size={11} color="#2563EB" />
              <Text style={styles.rateFilterDate} numberOfLines={1}>{ratePeriodLabel}</Text>
              <View style={styles.rateFilterBadge}>
                <Text style={styles.rateFilterBadgeText}>
                  {ratePeriod.charAt(0).toUpperCase() + ratePeriod.slice(1)}
                </Text>
              </View>
              <ChevronDown size={11} color="#6B7280" />
            </TouchableOpacity>

            <Text
              style={[styles.cardValue, { color: '#7C3AED' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {recommendedRate > 0 ? `${fmtDec(recommendedRate)}/hr` : '$0/hr'}
            </Text>
            {recommendedRate > 0 && (
              <Text style={styles.cardSubValue} numberOfLines={2}>
                L: ${avgLaborCostPerHour.toFixed(2)} + O: ${indirectCostPerHour.toFixed(2)}/hr
              </Text>
            )}
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
                    <Text style={styles.classifyBtnText}>Classify Employees</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ─── Section 2: Office Labor Costs ─── */}
        <View style={styles.accordionCard}>
          {renderSection('labor',
            <Users size={22} color="#10B981" style={{ marginRight: 12 }} />,
            'Office Labor Costs',
            null
          )}
          {expanded['labor'] && (
            <View style={styles.accordionContent}>
              {/* Summary strip */}
              <View style={styles.laborSummary}>
                <View style={styles.laborSummaryItem}>
                  <Text style={styles.laborSummaryValue}>{laborRows.length}</Text>
                  <Text style={styles.laborSummaryLabel}>Employees</Text>
                </View>
                <View style={styles.laborSummaryDivider} />
                <View style={styles.laborSummaryItem}>
                  <Text style={styles.laborSummaryValue}>
                    {laborHoursAllTime < 1
                      ? `${Math.round(laborHoursAllTime * 60)}m`
                      : `${laborHoursAllTime.toFixed(1)}h`}
                  </Text>
                  <Text style={styles.laborSummaryLabel}>Total Hours</Text>
                </View>
                <View style={styles.laborSummaryDivider} />
                <View style={styles.laborSummaryItem}>
                  <Text style={[styles.laborSummaryValue, { color: '#10B981' }]}>${laborTotalAllTime.toFixed(2)}</Text>
                  <Text style={styles.laborSummaryLabel}>Total Cost</Text>
                </View>
              </View>

              {laborRows.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptyText}>No office clock entries found.</Text>
                </View>
              ) : (
                laborRows.map(row => (
                  <TouchableOpacity
                    key={row.employeeId}
                    style={styles.laborRow}
                    activeOpacity={0.7}
                    onPress={() => { setSelectedLaborRow(row); setShowLaborDetail(true); }}
                  >
                    <View style={[styles.laborAvatar, row.isActive && styles.laborAvatarActive]}>
                      <Text style={styles.laborAvatarText}>{row.name.charAt(0).toUpperCase()}</Text>
                      {row.isActive && <View style={styles.laborActiveDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.laborName}>{row.name}</Text>
                      <Text style={styles.laborMeta}>
                        {row.totalHours < 1
                          ? `${Math.round(row.totalHours * 60)}m`
                          : `${row.totalHours.toFixed(1)}h`}
                        {row.rate != null && row.rate !== -1 ? ` · $${(row.rate as number).toFixed(2)}/hr` : ''}
                        {row.rate === -1 ? ' · Varies' : ''}
                      </Text>
                    </View>
                    <Text style={styles.laborCost}>
                      {row.rate != null ? `$${row.totalCost.toFixed(2)}` : 'No rate'}
                    </Text>
                    <ChevronRight size={16} color="#D1D5DB" />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* ─── Section 3: Averages & Trends ─── */}
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
                    <TouchableOpacity
                      key={e.id}
                      style={styles.expenseRow}
                      activeOpacity={0.7}
                      onPress={() => { setSelectedExpense(e); setShowExpenseDetail(true); }}
                    >
                      <Text style={styles.expenseRowCat}>{e.subcategory || e.type}</Text>
                      <Text style={styles.expenseRowAmount}>{fmt(e.amount)}</Text>
                      {e.receiptUrl ? (
                        <ImageIcon size={14} color="#10B981" style={{ marginLeft: 8 }} />
                      ) : (
                        <ChevronRight size={14} color="#D1D5DB" style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
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
            'Company Expenses',
            null
          )}
          {expanded['monthExpenses'] && (
            <View style={styles.accordionContent}>
              {categoryBreakdown.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptyText}>No company expenses found.</Text>
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
                    <TouchableOpacity
                      key={e.id}
                      style={styles.recentEntry}
                      activeOpacity={0.7}
                      onPress={() => { setSelectedExpense(e); setShowExpenseDetail(true); }}
                    >
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
                      {e.receiptUrl ? (
                        <ImageIcon size={14} color="#10B981" style={{ marginLeft: 8 }} />
                      ) : (
                        <ChevronRight size={14} color="#D1D5DB" style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        {/* ─── Section 5: Overhead & Rate Calculator ─── */}
        <View style={styles.accordionCard}>
          <View style={styles.accordionHeader}>
            <Grid3X3 size={22} color="#7C3AED" style={{ marginRight: 12 }} />
            <Text style={styles.accordionTitle}>Overhead & Rate Calculator</Text>
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => router.push('/rate-calculator' as any)}
            >
              <Text style={styles.openBtnText}>Open</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      {/* ─── Expense Detail Modal ─── */}
      <Modal
        visible={showExpenseDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExpenseDetail(false)}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={() => setShowExpenseDetail(false)}
        />
        <View
          style={[styles.modalOverlay, { backgroundColor: 'transparent' }, isTablet && styles.modalOverlayTablet]}
          pointerEvents="box-none"
        >
          <View style={[
            styles.detailSheet,
            isTablet && {
              alignSelf: 'center',
              width: Math.min(screenWidth * 0.65, 680),
              maxHeight: '80%',
              borderRadius: 20,
            }
          ]}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Expense Details</Text>
              <TouchableOpacity onPress={() => setShowExpenseDetail(false)} style={styles.iconBtn}>
                <X size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {selectedExpense && (
              <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
                {/* Amount + receipt button */}
                <View style={styles.detailAmountRow}>
                  <Text style={styles.detailAmount}>${Number(selectedExpense.amount).toLocaleString()}</Text>
                  {selectedExpense.receiptUrl && (
                    <TouchableOpacity
                      style={styles.detailReceiptBtn}
                      onPress={() => { setShowExpenseDetail(false); handleViewReceipt(selectedExpense.receiptUrl!); }}
                    >
                      <ImageIcon size={14} color="#10B981" />
                      <Text style={styles.detailReceiptBtnText}>View Receipt</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Added by */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { flexShrink: 0 }]}>Added by</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                    {selectedExpense.uploader?.avatar ? (
                      <Image source={{ uri: selectedExpense.uploader.avatar }} style={styles.detailAvatar} contentFit="cover" />
                    ) : selectedExpense.uploader ? (
                      <View style={[styles.detailAvatar, { backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }]}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                          {selectedExpense.uploader.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.detailValue, { flexShrink: 1 }]} numberOfLines={2}>
                      {selectedExpense.uploader?.name ?? 'Unknown'}
                    </Text>
                  </View>
                </View>

                {/* Store */}
                {!!selectedExpense.store && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Store / Invoice</Text>
                    <Text style={styles.detailValue}>{selectedExpense.store}</Text>
                  </View>
                )}

                {/* Date */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {selectedExpense.date
                      ? new Date(selectedExpense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                      : '—'}
                  </Text>
                </View>

                {/* Type */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{selectedExpense.type}</Text>
                </View>

                {/* Category */}
                {selectedExpense.subcategory && selectedExpense.subcategory !== selectedExpense.type && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{selectedExpense.subcategory}</Text>
                  </View>
                )}

                {/* Notes */}
                {!!selectedExpense.notes && (
                  <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                    <Text style={styles.detailLabel}>Notes</Text>
                    <Text style={[styles.detailValue, { flex: 1 }]}>{selectedExpense.notes}</Text>
                  </View>
                )}

                {/* Receipt thumbnail / file indicator */}
                {selectedExpense.receiptUrl && !selectedExpense.receiptUrl.startsWith('blob:') && (() => {
                  const url = selectedExpense.receiptUrl!.toLowerCase();
                  const isPdf = url.includes('.pdf');
                  const isDocx = url.includes('.docx') || url.includes('.doc');
                  if (isPdf || isDocx) {
                    return (
                      <TouchableOpacity
                        style={styles.noReceiptRow}
                        activeOpacity={0.7}
                        onPress={() => { setShowExpenseDetail(false); handleViewReceipt(selectedExpense.receiptUrl!); }}
                      >
                        <File size={16} color="#2563EB" />
                        <Text style={[styles.noReceiptText, { color: '#2563EB' }]}>
                          {isDocx ? 'View Word Document' : 'View PDF'}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => { setShowExpenseDetail(false); handleViewReceipt(selectedExpense.receiptUrl!); }}
                    >
                      <Image
                        source={{ uri: selectedExpense.receiptUrl }}
                        style={styles.detailReceiptPreview}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                  );
                })()}

                {/* No receipt message */}
                {!selectedExpense.receiptUrl && (
                  <View style={styles.noReceiptRow}>
                    <File size={16} color="#9CA3AF" />
                    <Text style={styles.noReceiptText}>No receipt attached</Text>
                  </View>
                )}

                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Employee Labor Detail Modal ─── */}
      <Modal
        visible={showLaborDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLaborDetail(false)}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={() => setShowLaborDetail(false)}
        />
        <View
          style={[styles.modalOverlay, { backgroundColor: 'transparent' }, isTablet && styles.modalOverlayTablet]}
          pointerEvents="box-none"
        >
          <View style={[
            styles.detailSheet,
            isTablet && {
              alignSelf: 'center',
              width: Math.min(screenWidth * 0.65, 680),
              maxHeight: '80%',
              borderRadius: 20,
              marginBottom: 0,
            }
          ]}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selectedLaborRow?.name}</Text>
              <TouchableOpacity onPress={() => setShowLaborDetail(false)} style={styles.iconBtn}>
                <X size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {/* Filter tabs */}
            <View style={styles.laborFilterRow}>
              {(['all', 'month', 'week'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.laborFilterTab, laborFilter === f && styles.laborFilterTabActive]}
                  onPress={() => { setLaborFilter(f); setLaborFilterDate(new Date()); }}
                >
                  <Text style={[styles.laborFilterTabText, laborFilter === f && styles.laborFilterTabTextActive]}>
                    {f === 'all' ? 'All Time' : f === 'month' ? 'Monthly' : 'Weekly'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date navigator (monthly / weekly) */}
            {laborFilter !== 'all' && (() => {
              let label = '';
              if (laborFilter === 'month') {
                label = laborFilterDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              } else {
                const [ws, we] = getWeekBounds(laborFilterDate);
                const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                label = `${fmt(ws)} – ${fmt(we)}`;
              }
              return (
                <View style={styles.laborDateNav}>
                  <TouchableOpacity
                    style={styles.laborDateNavBtn}
                    onPress={() => setLaborFilterDate(prev => {
                      const next = new Date(prev);
                      if (laborFilter === 'month') next.setMonth(next.getMonth() - 1);
                      else next.setDate(next.getDate() - 7);
                      return next;
                    })}
                  >
                    <ChevronLeft size={18} color="#6B7280" />
                  </TouchableOpacity>
                  <Text style={styles.laborDateNavLabel}>{label}</Text>
                  <TouchableOpacity
                    style={styles.laborDateNavBtn}
                    onPress={() => setLaborFilterDate(prev => {
                      const next = new Date(prev);
                      if (laborFilter === 'month') next.setMonth(next.getMonth() + 1);
                      else next.setDate(next.getDate() + 7);
                      return next;
                    })}
                  >
                    <ChevronRight size={18} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              );
            })()}

            {selectedLaborRow && (
              <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
                {/* Summary strip */}
                {(() => {
                  const totalH = selectedEmployeeDailyRows.reduce((s, d) => s + d.hours, 0);
                  const totalCost = selectedEmployeeDailyRows.reduce((s, d) => s + d.cost, 0);
                  return (
                    <View style={styles.laborSummary}>
                      <View style={styles.laborSummaryItem}>
                        <Text style={styles.laborSummaryValue}>
                          {totalH < 1 ? `${Math.round(totalH * 60)}m` : `${totalH.toFixed(1)}h`}
                        </Text>
                        <Text style={styles.laborSummaryLabel}>Total Hours</Text>
                      </View>
                      <View style={styles.laborSummaryDivider} />
                      <View style={styles.laborSummaryItem}>
                        <Text style={[styles.laborSummaryValue, { color: '#10B981' }]}>
                          {selectedLaborRow.rate != null ? `$${totalCost.toFixed(2)}` : '—'}
                        </Text>
                        <Text style={styles.laborSummaryLabel}>Total Cost</Text>
                      </View>
                      <View style={styles.laborSummaryDivider} />
                      <View style={styles.laborSummaryItem}>
                        <Text style={styles.laborSummaryValue}>{selectedEmployeeDailyRows.length}</Text>
                        <Text style={styles.laborSummaryLabel}>Days Worked</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Column headers */}
                {selectedEmployeeDailyRows.length > 0 && (
                  <View style={styles.laborDailyHeader}>
                    <Text style={[styles.laborDailyHeaderText, { flex: 2 }]}>Date</Text>
                    <Text style={[styles.laborDailyHeaderText, { flex: 1, textAlign: 'center' }]}>Hours</Text>
                    <Text style={[styles.laborDailyHeaderText, { flex: 1, textAlign: 'center' }]}>Rate</Text>
                    <Text style={[styles.laborDailyHeaderText, { flex: 1, textAlign: 'right' }]}>Cost</Text>
                  </View>
                )}

                {selectedEmployeeDailyRows.length === 0 ? (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptyText}>
                      {laborFilter === 'all'
                        ? 'No clock entries found.'
                        : laborFilter === 'month'
                        ? `No entries for ${laborFilterDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`
                        : 'No entries for this week.'}
                    </Text>
                  </View>
                ) : (
                  selectedEmployeeDailyRows.map(day => (
                    <View key={day.date} style={styles.laborDailyRow}>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.laborDailyDate}>
                          {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                        {day.sessions > 1 && (
                          <Text style={styles.laborDailySessions}>{day.sessions} sessions</Text>
                        )}
                      </View>
                      <Text style={[styles.laborDailyCell, { flex: 1, textAlign: 'center' }]}>
                        {day.hours < 1 ? `${Math.round(day.hours * 60)}m` : `${day.hours.toFixed(1)}h`}
                      </Text>
                      <Text style={[styles.laborDailyCell, { flex: 1, textAlign: 'center' }]}>
                        {day.rate === -1 ? 'Varies' : day.rate != null ? `$${day.rate.toFixed(0)}/hr` : '—'}
                      </Text>
                      <Text style={[styles.laborDailyCost, { flex: 1, textAlign: 'right' }]}>
                        {day.rate != null ? `$${day.cost.toFixed(2)}` : '—'}
                      </Text>
                    </View>
                  ))
                )}

                {/* Total row */}
                {selectedEmployeeDailyRows.length > 0 && (() => {
                  const totalH = selectedEmployeeDailyRows.reduce((s, d) => s + d.hours, 0);
                  const totalCost = selectedEmployeeDailyRows.reduce((s, d) => s + d.cost, 0);
                  return (
                    <View style={styles.laborDetailTotalRow}>
                      <Text style={[styles.laborDetailTotalLabel, { flex: 2 }]}>Total</Text>
                      <Text style={[styles.laborDetailTotalLabel, { flex: 1, textAlign: 'center' }]}>
                        {totalH < 1 ? `${Math.round(totalH * 60)}m` : `${totalH.toFixed(1)}h`}
                      </Text>
                      <Text style={[styles.laborDetailTotalLabel, { flex: 1, textAlign: 'center' }]}></Text>
                      <Text style={[styles.laborDetailTotalCost, { flex: 1, textAlign: 'right' }]}>
                        {selectedLaborRow.rate != null ? `$${totalCost.toFixed(2)}` : '—'}
                      </Text>
                    </View>
                  );
                })()}

                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Period Dropdown Modal ─── */}
      <Modal
        visible={showPeriodDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPeriodDropdown(false)}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          onPress={() => setShowPeriodDropdown(false)}
        />
        <View style={[styles.rateDropdownModal, { top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }]}>
          <Text style={styles.rateDropdownTitle}>Period</Text>
          {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.rateDropdownOption, ratePeriod === p && styles.rateDropdownOptionActive]}
              activeOpacity={0.7}
              onPress={() => { setRatePeriod(p); setRatePeriodDate(new Date()); }}
            >
              <Text style={[styles.rateDropdownOptionText, ratePeriod === p && styles.rateDropdownOptionTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
              {ratePeriod === p && <View style={styles.rateDropdownCheck} />}
            </TouchableOpacity>
          ))}
          <View style={styles.rateDropdownDivider} />
          <View style={styles.rateDropdownDateNav}>
            <TouchableOpacity style={styles.rateDropdownNavBtn} onPress={() => navigatePeriod(-1)} activeOpacity={0.7}>
              <ChevronLeft size={16} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.rateDropdownDateLabel} numberOfLines={1}>{ratePeriodLabel}</Text>
            <TouchableOpacity style={styles.rateDropdownNavBtn} onPress={() => navigatePeriod(1)} activeOpacity={0.7}>
              <ChevronRight size={16} color="#374151" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.rateDropdownDone} onPress={() => setShowPeriodDropdown(false)} activeOpacity={0.8}>
            <Text style={styles.rateDropdownDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ─── Receipt Viewer Modal ─── */}
      <Modal
        visible={showReceiptViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceiptViewer(false)}
      >
        <View style={styles.receiptViewerOverlay}>
          <View style={styles.receiptViewerContent}>
            <View style={styles.receiptViewerHeader}>
              <Text style={styles.receiptViewerTitle}>Receipt</Text>
              <TouchableOpacity style={styles.receiptViewerClose} onPress={() => setShowReceiptViewer(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            {viewingReceiptUrl && (() => {
              const url = viewingReceiptUrl.toLowerCase();
              const isPdf = url.includes('.pdf');
              const isDocx = url.includes('.docx') || url.includes('.doc');

              if (isPdf) {
                return Platform.OS === 'web' ? (
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore — iframe is valid on web
                  <iframe
                    src={viewingReceiptUrl}
                    style={{ width: '100%', height: 500, border: 'none' }}
                    title="PDF Receipt"
                  />
                ) : (
                  <View style={styles.pdfViewerContainer}>
                    <File size={60} color="#2563EB" />
                    <Text style={styles.pdfViewerText}>PDF Document</Text>
                    <TouchableOpacity
                      style={styles.openPdfButton}
                      onPress={() => Linking.openURL(viewingReceiptUrl!).catch(() => {})}
                    >
                      <Text style={styles.openPdfButtonText}>Open PDF</Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              if (isDocx) {
                return (
                  <View style={styles.pdfViewerContainer}>
                    <File size={60} color="#2563EB" />
                    <Text style={styles.pdfViewerText}>Word Document</Text>
                    <TouchableOpacity
                      style={styles.openPdfButton}
                      onPress={() => Linking.openURL(viewingReceiptUrl!).catch(() => {})}
                    >
                      <Text style={styles.openPdfButtonText}>Open Document</Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              return (
                <Image
                  source={{ uri: viewingReceiptUrl }}
                  style={styles.receiptViewerImage}
                  contentFit="contain"
                />
              );
            })()}
          </View>
        </View>
      </Modal>
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
    overflow: 'hidden',
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

  // Open button
  openBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  openBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  // Labor section
  laborSummary: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 16,
  },
  laborSummaryItem: { flex: 1, alignItems: 'center' },
  laborSummaryDivider: { width: 1, backgroundColor: '#D1FAE5', marginVertical: 4 },
  laborSummaryValue: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  laborSummaryLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  laborRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  laborAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center',
  },
  laborAvatarActive: {
    backgroundColor: '#D1FAE5',
    borderWidth: 2, borderColor: '#10B981',
  },
  laborActiveDot: {
    position: 'absolute', top: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  laborAvatarText: { fontSize: 16, fontWeight: '700', color: '#2563EB' },
  laborName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  laborMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  laborCost: { fontSize: 15, fontWeight: '700', color: '#10B981' },

  // Employee labor detail modal
  laborDetailMonth: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  laborFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  laborFilterTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  laborFilterTabActive: { backgroundColor: '#1F2937' },
  laborFilterTabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  laborFilterTabTextActive: { color: '#FFFFFF' },
  laborDateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  laborDateNavBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  laborDateNavLabel: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  laborDailyHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 2,
  },
  laborDailyHeaderText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  laborDailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  laborDailyDate: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  laborDailySessions: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  laborDailyCell: { fontSize: 13, color: '#4B5563' },
  laborDailyCost: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  laborDetailTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  laborDetailTotalLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  laborDetailTotalCost: { fontSize: 15, fontWeight: '700', color: '#10B981' },

  // Expense detail modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalOverlayTablet: {
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  detailSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  iconBtn: { padding: 4 },
  detailBody: { paddingHorizontal: 18 },
  detailAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailAmount: { fontSize: 28, fontWeight: '700', color: '#1F2937' },
  detailReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  detailReceiptBtnText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  detailLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#1F2937', fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 12 },
  detailAvatar: { width: 26, height: 26, borderRadius: 13 },
  detailReceiptPreview: {
    width: '100%', height: 220,
    borderRadius: 12,
    marginTop: 16,
  },
  noReceiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  noReceiptText: { fontSize: 13, color: '#9CA3AF' },

  // Receipt viewer modal
  receiptViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptViewerContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  receiptViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  receiptViewerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  receiptViewerClose: { padding: 4 },
  receiptViewerImage: { width: '100%', height: 500 },
  pdfViewerContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  pdfViewerText: { fontSize: 16, color: '#374151', fontWeight: '600' },
  openPdfButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  openPdfButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // Recommended Rate card — filter pill
  cardSubValue: { fontSize: 10, color: '#9CA3AF', marginTop: 3 },
  rateFilterRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
    marginBottom: 8,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  rateFilterDate: { fontSize: 10, fontWeight: '600', color: '#1F2937', flexShrink: 1 },
  rateFilterBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rateFilterBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },

  // Period dropdown modal
  rateDropdownModal: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  rateDropdownTitle: {
    fontSize: 12, fontWeight: '600', color: '#9CA3AF',
    textTransform: 'uppercase', paddingHorizontal: 12, paddingVertical: 6,
  },
  rateDropdownOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8,
  },
  rateDropdownOptionActive: { backgroundColor: '#F3E8FF' },
  rateDropdownOptionText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  rateDropdownOptionTextActive: { color: '#7C3AED', fontWeight: '700' },
  rateDropdownCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  rateDropdownDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 8, marginVertical: 6 },
  rateDropdownDateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 6,
  },
  rateDropdownNavBtn: { padding: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  rateDropdownDateLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  rateDropdownDone: {
    backgroundColor: '#7C3AED', borderRadius: 10,
    marginHorizontal: 8, marginTop: 6, marginBottom: 4,
    paddingVertical: 11, alignItems: 'center',
  },
  rateDropdownDoneText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
