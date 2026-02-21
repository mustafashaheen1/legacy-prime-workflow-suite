import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, RefreshControl } from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { User, ClockEntry } from '@/types';
import { Clock, DollarSign, CheckCircle, XCircle, FileText, Edit2 } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

export default function EmployeeManagementScreen() {
  const { user: currentUser, clockEntries } = useApp();
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  const [showTimecardModal, setShowTimecardModal] = useState<boolean>(false);
  const [timecardPeriod, setTimecardPeriod] = useState<'weekly' | 'bi-weekly' | 'custom'>('weekly');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showEditRateModal, setShowEditRateModal] = useState<boolean>(false);
  const [editingRate, setEditingRate] = useState<string>('');

  const [refreshing, setRefreshing] = useState(false);

  const { data: usersData, refetch } = trpc.users.getUsers.useQuery({
    companyId: currentUser?.companyId || '',
  });

  // Refetch every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const employees = useMemo(() => {
    const allUsers = usersData?.users || [];
    return allUsers.filter((u: User) => 
      u.role === 'employee' || u.role === 'field-employee'
    );
  }, [usersData]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const query = searchQuery.toLowerCase();
    return employees.filter((emp: User) => 
      emp.name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      emp.phone?.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  const employeesWithRateChangeRequests = useMemo(() => {
    return employees.filter((emp: User) => 
      emp.rateChangeRequest && emp.rateChangeRequest.status === 'pending'
    );
  }, [employees]);

  const approveRateChangeMutation = trpc.users.approveRateChange.useMutation({
    onSuccess: () => {
      Alert.alert('Success', 'Rate change approved successfully');
      setSelectedEmployee(null);
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to approve rate change');
    },
  });

  const updateUserMutation = trpc.users.updateUser.useMutation({
    onSuccess: () => {
      Alert.alert('Success', 'Hourly rate updated successfully');
      setShowEditRateModal(false);
      setSelectedEmployee(null);
      setEditingRate('');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to update hourly rate');
    },
  });

  const handleApproveRateChange = async (employee: User, approve: boolean) => {
    if (!currentUser) return;

    try {
      await approveRateChangeMutation.mutateAsync({
        userId: employee.id,
        approved: approve,
        reviewedBy: currentUser.id,
      });
    } catch (error) {
      console.error('[Admin] Error handling rate change:', error);
    }
  };

  const openEditRateModal = (employee: User) => {
    setSelectedEmployee(employee);
    setEditingRate(employee.hourlyRate?.toString() || '');
    setShowEditRateModal(true);
  };

  const handleUpdateRate = async () => {
    if (!selectedEmployee) return;

    const rate = parseFloat(editingRate);
    if (isNaN(rate) || rate < 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid hourly rate');
      return;
    }

    try {
      await updateUserMutation.mutateAsync({
        userId: selectedEmployee.id,
        updates: {
          hourlyRate: rate,
          rateChangeRequest: undefined, // Clear any pending rate change requests
        },
      });
    } catch (error) {
      console.error('[Admin] Error updating rate:', error);
    }
  };

  const getEmployeeStats = (employeeId: string) => {
    const employeeEntries = clockEntries.filter(e => e.employeeId === employeeId);
    const today = new Date().toDateString();
    const todayEntries = employeeEntries.filter(e => 
      new Date(e.clockIn).toDateString() === today
    );
    
    const calculateHours = (entries: ClockEntry[]) => {
      return entries.reduce((sum, entry) => {
        if (!entry.clockOut) return sum;
        const start = new Date(entry.clockIn).getTime();
        const end = new Date(entry.clockOut).getTime();
        let totalMs = end - start;
        
        if (entry.lunchBreaks) {
          entry.lunchBreaks.forEach(lunch => {
            if (lunch.endTime) {
              const lunchStart = new Date(lunch.startTime).getTime();
              const lunchEnd = new Date(lunch.endTime).getTime();
              totalMs -= (lunchEnd - lunchStart);
            }
          });
        }
        
        return sum + totalMs / (1000 * 60 * 60);
      }, 0);
    };

    const todayHours = calculateHours(todayEntries);
    const totalHours = calculateHours(employeeEntries);
    const isClockedIn = employeeEntries.some(e => e.employeeId === employeeId && !e.clockOut);

    return { todayHours, totalHours, isClockedIn };
  };

  const generateTimecard = async (employee: User) => {
    setSelectedEmployee(employee);
    setShowTimecardModal(true);
  };

  const getWeekDates = (weeksAgo: number = 0) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff - (weeksAgo * 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday.toISOString(), end: sunday.toISOString() };
  };

  const confirmGenerateTimecard = async () => {
    if (!selectedEmployee) return;

    const { start, end } = getWeekDates(0);
    
    const employeeEntries = clockEntries.filter(entry => {
      const entryDate = new Date(entry.clockIn);
      return entry.employeeId === selectedEmployee.id && 
             entryDate >= new Date(start) && 
             entryDate <= new Date(end) &&
             entry.clockOut;
    });

    const calculateHours = (entry: ClockEntry) => {
      if (!entry.clockOut) return 0;
      const clockStart = new Date(entry.clockIn).getTime();
      const clockEnd = new Date(entry.clockOut).getTime();
      let totalMs = clockEnd - clockStart;

      if (entry.lunchBreaks) {
        entry.lunchBreaks.forEach(lunch => {
          if (lunch.endTime) {
            const lunchStart = new Date(lunch.startTime).getTime();
            const lunchEnd = new Date(lunch.endTime).getTime();
            totalMs -= (lunchEnd - lunchStart);
          }
        });
      }

      return totalMs / (1000 * 60 * 60);
    };

    const totalHours = employeeEntries.reduce((sum, entry) => sum + calculateHours(entry), 0);
    const regularHours = Math.min(totalHours, 40);
    const overtimeHours = Math.max(0, totalHours - 40);
    const totalEarnings = selectedEmployee.hourlyRate 
      ? (regularHours * selectedEmployee.hourlyRate) + (overtimeHours * selectedEmployee.hourlyRate * 1.5)
      : 0;

    const uniqueDays = new Set(
      employeeEntries.map(entry => new Date(entry.clockIn).toDateString())
    ).size;

    console.log('[Admin] Timecard Generated');
    console.log(`  Employee: ${selectedEmployee.name}`);
    console.log(`  Period: ${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`);
    console.log(`  Total Hours: ${totalHours.toFixed(2)}h`);
    console.log(`  Regular Hours: ${regularHours.toFixed(2)}h`);
    console.log(`  Overtime Hours: ${overtimeHours.toFixed(2)}h`);
    console.log(`  Total Earnings: $${totalEarnings.toFixed(2)}`);
    console.log(`  Days Worked: ${uniqueDays}`);

    Alert.alert(
      'Timecard Generated',
      `Employee: ${selectedEmployee.name}\n\nTotal Hours: ${totalHours.toFixed(2)}h\nRegular: ${regularHours.toFixed(2)}h\nOvertime: ${overtimeHours.toFixed(2)}h\n\nTotal Earnings: $${totalEarnings.toFixed(2)}`,
      [{ text: 'OK', onPress: () => setShowTimecardModal(false) }]
    );
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super-admin')) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Access Denied' }} />
        <View style={styles.centerContent}>
          <XCircle size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>You don&apos;t have permission to access this page.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Employee Management',
        headerShown: true,
      }} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10B981" colors={['#10B981']} />
        }
      >
        {employeesWithRateChangeRequests.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <DollarSign size={24} color="#F59E0B" />
              <Text style={styles.alertTitle}>Pending Rate Change Requests</Text>
            </View>
            {employeesWithRateChangeRequests.map((emp: User) => (
              <View key={emp.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestName}>{emp.name}</Text>
                  <Text style={styles.requestDate}>
                    {new Date(emp.rateChangeRequest!.requestDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.requestDetails}>
                  <Text style={styles.requestLabel}>Current Rate: ${emp.hourlyRate?.toFixed(2) || '0.00'}/hr</Text>
                  <Text style={styles.requestLabelNew}>New Rate: ${emp.rateChangeRequest!.newRate.toFixed(2)}/hr</Text>
                </View>
                {emp.rateChangeRequest!.reason && (
                  <Text style={styles.requestReason}>Reason: {emp.rateChangeRequest!.reason}</Text>
                )}
                <View style={styles.requestActions}>
                  <TouchableOpacity 
                    style={styles.rejectButton}
                    onPress={() => handleApproveRateChange(emp, false)}
                  >
                    <XCircle size={18} color="#FFFFFF" />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.approveButton}
                    onPress={() => handleApproveRateChange(emp, true)}
                  >
                    <CheckCircle size={18} color="#FFFFFF" />
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.employeesSection}>
          <Text style={styles.sectionTitle}>All Employees ({filteredEmployees.length})</Text>
          
          {filteredEmployees.map((employee: User) => {
            const stats = getEmployeeStats(employee.id);
            
            return (
              <View key={employee.id} style={styles.employeeCard}>
                <View style={styles.employeeHeader}>
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{employee.name}</Text>
                    <Text style={styles.employeeEmail}>{employee.email}</Text>
                    {employee.phone && (
                      <Text style={styles.employeePhone}>{employee.phone}</Text>
                    )}
                  </View>
                  {stats.isClockedIn && (
                    <View style={styles.clockedInBadge}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.clockedInText}>Active</Text>
                    </View>
                  )}
                </View>

                <View style={styles.employeeStats}>
                  <View style={styles.statItem}>
                    <Clock size={16} color="#6B7280" />
                    <Text style={styles.statText}>Today: {stats.todayHours.toFixed(1)}h</Text>
                  </View>
                  {employee.hourlyRate && (
                    <View style={styles.statItem}>
                      <DollarSign size={16} color="#6B7280" />
                      <Text style={styles.statText}>${employee.hourlyRate.toFixed(2)}/hr</Text>
                    </View>
                  )}
                </View>

                <View style={styles.employeeActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditRateModal(employee)}
                  >
                    <Edit2 size={16} color="#10B981" />
                    <Text style={[styles.actionButtonText, { color: '#10B981' }]}>Edit Rate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => generateTimecard(employee)}
                  >
                    <FileText size={16} color="#2563EB" />
                    <Text style={styles.actionButtonText}>Generate Timecard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={showTimecardModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTimecardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate Timecard</Text>
            
            {selectedEmployee && (
              <>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoLabel}>Employee:</Text>
                  <Text style={styles.modalInfoValue}>{selectedEmployee.name}</Text>
                </View>

                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoLabel}>Hourly Rate:</Text>
                  <Text style={styles.modalInfoValue}>
                    ${selectedEmployee.hourlyRate?.toFixed(2) || '0.00'}/hr
                  </Text>
                </View>

                <View style={styles.periodSelector}>
                  <Text style={styles.periodLabel}>Period:</Text>
                  <View style={styles.periodButtons}>
                    <TouchableOpacity
                      style={[
                        styles.periodButton,
                        timecardPeriod === 'weekly' && styles.periodButtonActive,
                      ]}
                      onPress={() => setTimecardPeriod('weekly')}
                    >
                      <Text style={[
                        styles.periodButtonText,
                        timecardPeriod === 'weekly' && styles.periodButtonTextActive,
                      ]}>
                        Weekly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.periodButton,
                        timecardPeriod === 'bi-weekly' && styles.periodButtonActive,
                      ]}
                      onPress={() => setTimecardPeriod('bi-weekly')}
                    >
                      <Text style={[
                        styles.periodButtonText,
                        timecardPeriod === 'bi-weekly' && styles.periodButtonTextActive,
                      ]}>
                        Bi-Weekly
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowTimecardModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={confirmGenerateTimecard}
              >
                <Text style={styles.modalConfirmButtonText}>Generate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditRateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditRateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Hourly Rate</Text>

            {selectedEmployee && (
              <>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoLabel}>Employee:</Text>
                  <Text style={styles.modalInfoValue}>{selectedEmployee.name}</Text>
                </View>

                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoLabel}>Current Hourly Rate:</Text>
                  <Text style={styles.modalInfoValue}>
                    ${selectedEmployee.hourlyRate?.toFixed(2) || '0.00'}/hr
                  </Text>
                </View>

                <View style={styles.rateInputSection}>
                  <Text style={styles.rateInputLabel}>New Hourly Rate:</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={editingRate}
                    onChangeText={(text) => {
                      // Only allow numbers and decimal point
                      const filtered = text.replace(/[^0-9.]/g, '');
                      // Ensure only one decimal point
                      const parts = filtered.split('.');
                      if (parts.length > 2) return;
                      setEditingRate(filtered);
                    }}
                    placeholder="25.50"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowEditRateModal(false);
                  setSelectedEmployee(null);
                  setEditingRate('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleUpdateRate}
                disabled={updateUserMutation.isPending}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {updateUserMutation.isPending ? 'Updating...' : 'Update Rate'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  alertCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  requestDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  requestDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  requestLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  requestLabelNew: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#059669',
  },
  requestReason: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 6,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  searchInput: {
    fontSize: 16,
    color: '#1F2937',
  },
  employeesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  employeeEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  employeePhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  clockedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  clockedInText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#059669',
  },
  employeeStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#4B5563',
  },
  employeeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 20,
  },
  modalInfo: {
    marginBottom: 16,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  modalInfoValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  periodSelector: {
    marginBottom: 24,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#2563EB',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  rateInputSection: {
    marginBottom: 24,
  },
  rateInputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  rateInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
  },
});
