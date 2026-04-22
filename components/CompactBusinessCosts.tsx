import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Briefcase, TrendingUp, Calendar } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import type { ClockEntry, Expense } from '@/types';

interface Props {
  expenses: Expense[];
  clockEntries?: ClockEntry[];
  hoursWorked?: number;
  onDetails?: () => void;
  usersMap?: Map<string, { name: string; avatar?: string }>;
}

export default function CompactBusinessCosts({ expenses, clockEntries = [], hoursWorked = 0, onDetails, usersMap }: Props) {
  const inOfficeEntries = useMemo(
    () => clockEntries.filter(e => e.officeRole && !e.clockOut),
    [clockEntries]
  );
  const inOfficeCount = inOfficeEntries.length;

  const businessExpenses = useMemo(
    () => expenses.filter(e => e.isCompanyCost),
    [expenses]
  );

  const now = new Date();
  const thisMonthTotal = useMemo(() => {
    return businessExpenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [businessExpenses]);

  // Rolling 6-month average
  const overheadPerMonth = useMemo(() => {
    if (businessExpenses.length === 0) return 0;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recent = businessExpenses.filter(e => new Date(e.date) >= sixMonthsAgo);
    if (recent.length === 0) return 0;
    const total = recent.reduce((sum, e) => sum + e.amount, 0);
    return total / 6;
  }, [businessExpenses]);

  // Recommended rate = overhead/mo ÷ hours worked this month
  const recRate = useMemo(() => {
    if (hoursWorked <= 0 || overheadPerMonth <= 0) return 0;
    return overheadPerMonth / hoursWorked;
  }, [overheadPerMonth, hoursWorked]);

  // Yearly forecast
  const yearlyForecast = useMemo(() => overheadPerMonth * 12, [overheadPerMonth]);

  // Trend: compare this month vs overhead average
  const trendLabel = useMemo(() => {
    if (overheadPerMonth === 0) return 'Stable';
    const diff = thisMonthTotal - overheadPerMonth;
    const pct = Math.abs(diff / overheadPerMonth);
    if (pct < 0.1) return 'Stable';
    return diff > 0 ? 'Rising' : 'Falling';
  }, [thisMonthTotal, overheadPerMonth]);

  const fmt = (n: number) =>
    n === 0 ? '$0' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const visibleAvatars = inOfficeEntries.slice(0, 3);
  const extraAvatarCount = Math.max(0, inOfficeCount - 3);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onDetails} disabled={!onDetails}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Briefcase size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Business Costs</Text>
        </View>
        <View style={styles.headerRight}>
          {inOfficeCount > 0 && (
            <View style={styles.avatarSection}>
              {visibleAvatars.map((entry, idx) => {
                const userData = usersMap?.get(entry.employeeId);
                const displayName = userData?.name || entry.employeeName || '?';
                const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <View
                    key={entry.id}
                    style={[styles.avatarWrapper, { marginLeft: idx === 0 ? 0 : -8, zIndex: 3 - idx }]}
                  >
                    <View style={styles.avatar}>
                      {userData?.avatar ? (
                        <Image source={{ uri: userData.avatar }} style={styles.avatarImg} contentFit="cover" />
                      ) : (
                        <Text style={styles.avatarInitials}>{initials}</Text>
                      )}
                    </View>
                    <View style={styles.onlineDot} />
                  </View>
                );
              })}
              {extraAvatarCount > 0 && (
                <View style={[styles.avatar, styles.avatarExtra, { marginLeft: -8, zIndex: 0 }]}>
                  <Text style={styles.avatarExtraText}>+{extraAvatarCount}</Text>
                </View>
              )}
              <Text style={styles.inOfficeText}>{inOfficeCount} in office</Text>
            </View>
          )}
          {onDetails && (
            <TouchableOpacity onPress={onDetails} style={styles.detailsBtn}>
              <Text style={styles.detailsText}>Details &gt;</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3-column metrics */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <View style={styles.metricHeader}>
            <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.metricLabel}>This Month</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#2563EB' }]}>{fmt(thisMonthTotal)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <View style={styles.metricHeader}>
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.metricLabel}>Overhead/mo</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#10B981' }]}>{fmt(overheadPerMonth)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <View style={styles.metricHeader}>
            <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />
            <Text style={styles.metricLabel}>Rec. Rate</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#7C3AED' }]}>
            {recRate > 0 ? `$${recRate.toFixed(0)}/hr` : '$0/hr'}
          </Text>
        </View>
      </View>

      {/* Yearly Forecast row */}
      <View style={styles.forecastRow}>
        <View style={styles.forecastLeft}>
          <TrendingUp size={14} color="#64748B" />
          <Text style={styles.forecastLabel}>Yearly Forecast</Text>
        </View>
        <Text style={styles.forecastValue}>{fmt(yearlyForecast)}</Text>
        <View style={[
          styles.trendBadge,
          trendLabel === 'Rising' && styles.trendRising,
          trendLabel === 'Falling' && styles.trendFalling,
        ]}>
          <Text style={[
            styles.trendText,
            trendLabel === 'Rising' && styles.trendTextRising,
            trendLabel === 'Falling' && styles.trendTextFalling,
          ]}>{trendLabel}</Text>
        </View>
        <View style={styles.yearBadge}>
          <Calendar size={10} color="#64748B" />
          <Text style={styles.yearText}>{now.getFullYear()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 26,
    height: 26,
  },
  avatarInitials: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarExtra: {
    backgroundColor: '#94A3B8',
  },
  avatarExtraText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  inOfficeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  detailsBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  detailsText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metric: {
    flex: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    paddingLeft: 12,
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  forecastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  forecastLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  forecastValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  trendBadge: {
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  trendRising: {
    backgroundColor: '#FEF2F2',
  },
  trendFalling: {
    backgroundColor: '#EFF6FF',
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  trendTextRising: {
    color: '#DC2626',
  },
  trendTextFalling: {
    color: '#2563EB',
  },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  yearText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});
