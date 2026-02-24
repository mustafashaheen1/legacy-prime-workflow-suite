import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, DollarSign, Clock, Users, Receipt } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useMemo, useState, useEffect } from 'react';

export default function ProjectCostsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { projects } = useApp();

  const project = useMemo(() =>
    projects.find(p => p.id === id),
    [projects, id]
  );

  const [costs, setCosts] = useState<any>(null);
  const [costsLoading, setCostsLoading] = useState(true);
  const [costsError, setCostsError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setCostsLoading(true);
    setCostsError(null);
    Promise.all([
      supabase.from('expenses').select('*').eq('project_id', id as string),
      supabase.from('clock_entries').select('*').eq('project_id', id as string),
      supabase.from('users').select('id, name, hourly_rate'),
    ]).then(([{ data: expensesData, error: expErr }, { data: clockData, error: clockErr }, { data: usersData, error: usersErr }]) => {
      if (expErr || clockErr || usersErr) {
        setCostsError((expErr || clockErr || usersErr)!.message);
        setCostsLoading(false);
        return;
      }
      const projectExpenses = expensesData || [];
      const projectClockEntries = clockData || [];
      const users = usersData || [];

      const totalExpenses = projectExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
      const expensesByCategory = projectExpenses.reduce((acc: Record<string, number>, e: any) => {
        const cat = e.subcategory || e.type;
        acc[cat] = (acc[cat] || 0) + e.amount;
        return acc;
      }, {} as Record<string, number>);

      const laborMap = new Map<string, any>();
      projectClockEntries.forEach((entry: any) => {
        if (!entry.clock_out) return;
        const user = users.find((u: any) => u.id === entry.employee_id);
        const rate = user?.hourly_rate || 0;
        let hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000;
        if (entry.lunch_breaks) {
          entry.lunch_breaks.forEach((lunch: any) => {
            if (lunch.end_time) hours -= (new Date(lunch.end_time).getTime() - new Date(lunch.start_time).getTime()) / 3600000;
          });
        }
        const existing = laborMap.get(entry.employee_id);
        if (existing) { existing.totalHours += hours; existing.totalCost = existing.totalHours * existing.hourlyRate; }
        else laborMap.set(entry.employee_id, { employeeId: entry.employee_id, employeeName: user?.name || 'Unknown', totalHours: hours, hourlyRate: rate, totalCost: hours * rate });
      });

      const laborByEmployee = Array.from(laborMap.values());
      const totalLaborCost = laborByEmployee.reduce((sum: number, e: any) => sum + e.totalCost, 0);
      const totalSubcontractorCost = projectExpenses
        .filter((e: any) => e.type?.toLowerCase() === 'subcontractor' || e.subcategory?.toLowerCase().includes('subcontractor'))
        .reduce((sum: number, e: any) => sum + e.amount, 0);

      setCosts({
        totalExpenses, totalLaborCost, totalSubcontractorCost,
        totalCost: totalExpenses + totalLaborCost,
        expensesByCategory, laborByEmployee,
        expensesBreakdown: projectExpenses.map((e: any) => ({
          id: e.id, type: e.type, subcategory: e.subcategory,
          amount: e.amount, store: e.store, date: e.date,
        })),
      });
      setCostsLoading(false);
    });
  }, [id]);

  if (!project) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Project not found</Text>
      </View>
    );
  }

  if (costsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading project costs...</Text>
      </View>
    );
  }

  if (costsError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading costs: {costsError}</Text>
      </View>
    );
  }

  if (!costs) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Project Costs</Text>
            <Text style={styles.headerSubtitle}>{project.name}</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Cost Summary</Text>
            
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
                <View style={styles.summaryIconContainer}>
                  <Receipt size={24} color="#2563EB" />
                </View>
                <Text style={styles.summaryLabel}>Total Expenses</Text>
                <Text style={[styles.summaryValue, { color: '#2563EB' }]}>
                  ${costs.totalExpenses.toLocaleString()}
                </Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: '#F0FDF4' }]}>
                <View style={[styles.summaryIconContainer, { backgroundColor: '#10B981' }]}>
                  <Clock size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.summaryLabel}>Labor Cost</Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                  ${costs.totalLaborCost.toLocaleString()}
                </Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
                <View style={[styles.summaryIconContainer, { backgroundColor: '#F59E0B' }]}>
                  <Users size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.summaryLabel}>Subcontractors</Text>
                <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                  ${costs.totalSubcontractorCost.toLocaleString()}
                </Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: '#FEE2E2' }]}>
                <View style={[styles.summaryIconContainer, { backgroundColor: '#EF4444' }]}>
                  <DollarSign size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.summaryLabel}>Total Cost</Text>
                <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                  ${costs.totalCost.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.budgetComparison}>
              <View style={styles.budgetComparisonRow}>
                <Text style={styles.budgetComparisonLabel}>Project Budget:</Text>
                <Text style={styles.budgetComparisonValue}>
                  ${project.budget.toLocaleString()}
                </Text>
              </View>
              <View style={styles.budgetComparisonRow}>
                <Text style={styles.budgetComparisonLabel}>Total Spent:</Text>
                <Text style={[styles.budgetComparisonValue, { color: '#EF4444' }]}>
                  ${costs.totalCost.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.budgetComparisonRow, styles.budgetComparisonTotal]}>
                <Text style={styles.budgetComparisonTotalLabel}>Remaining:</Text>
                <Text style={[
                  styles.budgetComparisonTotalValue,
                  { color: project.budget - costs.totalCost >= 0 ? '#10B981' : '#EF4444' }
                ]}>
                  ${(project.budget - costs.totalCost).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {costs.laborByEmployee.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Labor Costs by Employee</Text>
              {costs.laborByEmployee.map((emp) => (
                <View key={emp.employeeId} style={styles.employeeCard}>
                  <View style={styles.employeeHeader}>
                    <Text style={styles.employeeName}>{emp.employeeName}</Text>
                    <Text style={styles.employeeCost}>${emp.totalCost.toLocaleString()}</Text>
                  </View>
                  <View style={styles.employeeDetails}>
                    <View style={styles.employeeDetailItem}>
                      <Text style={styles.employeeDetailLabel}>Hours:</Text>
                      <Text style={styles.employeeDetailValue}>{emp.totalHours.toFixed(2)}h</Text>
                    </View>
                    <View style={styles.employeeDetailItem}>
                      <Text style={styles.employeeDetailLabel}>Rate:</Text>
                      <Text style={styles.employeeDetailValue}>${emp.hourlyRate}/hr</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {Object.keys(costs.expensesByCategory).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Expenses by Category</Text>
              {Object.entries(costs.expensesByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <View key={category} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{category}</Text>
                    <Text style={styles.categoryAmount}>${amount.toLocaleString()}</Text>
                  </View>
                ))}
            </View>
          )}

          {costs.expensesBreakdown.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Expenses</Text>
              {costs.expensesBreakdown.slice(-10).reverse().map((expense) => (
                <View key={expense.id} style={styles.expenseCard}>
                  <View style={styles.expenseHeader}>
                    <View>
                      <Text style={styles.expenseType}>{expense.type}</Text>
                      {expense.subcategory && expense.subcategory !== expense.type && (
                        <Text style={styles.expenseSubcategory}>{expense.subcategory}</Text>
                      )}
                    </View>
                    <Text style={styles.expenseAmount}>${expense.amount.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.expenseStore}>{expense.store}</Text>
                  <Text style={styles.expenseDate}>
                    {new Date(expense.date).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  summarySection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  budgetComparison: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  budgetComparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  budgetComparisonLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  budgetComparisonValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  budgetComparisonTotal: {
    borderBottomWidth: 0,
    paddingTop: 12,
    marginTop: 4,
  },
  budgetComparisonTotalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  budgetComparisonTotalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
  },
  employeeCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  employeeCost: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  employeeDetails: {
    flexDirection: 'row',
    gap: 24,
  },
  employeeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  employeeDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  employeeDetailValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryName: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600' as const,
    flex: 1,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  expenseCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  expenseSubcategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  expenseStore: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 40,
  },
});
